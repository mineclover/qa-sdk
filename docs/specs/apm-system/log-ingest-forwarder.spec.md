---
def:
  id: log-ingest-forwarder
  scope: constraint
  aspect: infra_constraint
  depth: specification
  level: leaf
  lifecycle: approved
  layer: operation
  tags: [logging, ingest, transport]
  links:
    - target: logger-contract
      type: depends_on
defines:
  - IngestForwarder
  - createIngestForwarder
  - LogIngestBridgeConfig
  - ForwarderStats
consumes:
  - "@qa-sdk/core :: EventRecord, TransmissionEnvelope, newLogId, newTransmissionId, newTraceId, newSpanId, now"
  - "ingest-server :: POST /v1/ingest"
---

# IngestForwarder 구현

## 목적 ^purpose

pino Destination 호환 객체로서, addressContext가 포함된 로그만 필터 → EventRecord 변환 → 배치 버퍼 → ingest-server HTTP 전송을 수행한다.

## 구성 ^overview

- `shouldForward`: addressContext 존재 여부로 필터링하는 판별 함수.
- `toEventRecord`: pino log object를 EventRecord로 변환하는 매핑 함수.
- `buildEnvelope`: EventRecord 배열을 TransmissionEnvelope로 래핑하는 구성 함수.
- `IngestForwarder`: write → 필터 → 변환 → 버퍼 → flush → HTTP 전송 전체 파이프라인.
- `ForwarderStats`: forwarded/filtered/dropped/flushCount 진단 카운터.

---

## 필터

```typescript
function shouldForward(log: Record<string, unknown>): boolean {
  const ctx = log.addressContext;
  return ctx != null
    && typeof ctx === "object"
    && Object.keys(ctx as object).length > 0;
}
```

| 로그 | 결과 |
|------|------|
| `{ addressContext: { service: "service:v1:42" } }` | 전달 |
| `{ addressContext: { permission: "permission:v1:7" }, userId: "u1" }` | 전달 |
| `{ }` (키 없음) | skip |
| `{ addressContext: {} }` (빈 객체) | skip |
| `{ addressContext: null }` | skip |

## 변환: pino log → EventRecord

```
pino log                                 EventRecord
────────────────────────────────────     ─────────────────────────────
.time (epoch ms)                    →    .timestamp (ISO-8601)
.level (string, @qa-sdk/pino)       →    .event_key = "svc_log.{level}"
.msg                                →    .payload.msg
.name                               →    .payload.service
.addressContext                     →    .address_context
.traceId (선택)                     →    .trace_id (없으면 auto-gen)
.spanId (선택)                      →    .span_id (없으면 auto-gen)
.parentSpanId (선택)                →    .parent_span_id
.qaSessionId (선택)                 →    .qa_session_id
.eventKey (선택, 명시)              →    .event_key (override)
나머지 필드                          →    .payload (rest spread)
```

### event_key 규칙

1. **명시**: `logger.info({ eventKey: "auth.login.success", addressContext: {...} }, "...")`
2. **자동**: `svc_log.info`, `svc_log.warn`, `svc_log.error`, `svc_log.fatal`

`svc_log` 네임스페이스로 기존 이벤트 prefix(`page_view`, `cart_event`)와 분리.

### 예약 필드 (payload에서 제외)

`addressContext`, `traceId`, `spanId`, `parentSpanId`, `qaSessionId`, `eventKey`, `time`, `level`, `pid`, `hostname`, `name`, `msg`, `timestamp`

## 설정

```typescript
interface LogIngestBridgeConfig {
  endpoint: string;          // ingest 엔드포인트 (필수)
  serviceName: string;       // envelope source 식별 (필수)
  buildEnv?: string;         // 기본: process.env.NODE_ENV ?? "local"
  batchSize?: number;        // 기본: 50
  flushIntervalMs?: number;  // 기본: 5,000 (0=비활성)
  maxBufferSize?: number;    // 기본: 500
  timeoutMs?: number;        // 기본: 10,000
  infraContext?: Record<string, string>;  // envelope infra_context
  onError?: (err: unknown) => void;       // 기본: silent drop
}
```

## 버퍼링

- ring buffer: maxBufferSize(500) 초과 시 oldest drop
- batch flush: buffer.length ≥ batchSize(50) 도달 시 즉시 flush
- interval flush: flushIntervalMs(5s) 경과 시 자동 flush (timer.unref로 프로세스 종료 미차단)
- concurrent 방지: `flushInProgress` flag
- shutdown: clearInterval → 잔여 버퍼 final flush

## Fail-open 규칙

| 실패 지점 | 동작 | 이유 |
|-----------|------|------|
| JSON parse (pino log) | skip, dropped++ | 깨진 로그 ≠ 서비스 장애 |
| 변환 예외 | skip, dropped++ | 좌표 인코딩 실패 ≠ 서비스 장애 |
| HTTP 전송 실패 | drop batch, dropped++ | ingest 다운 ≠ 서비스 다운 |
| HTTP timeout | drop batch, dropped++ | 네트워크 지연 ≠ 서비스 지연 |
| 버퍼 overflow | drop oldest, dropped++ | 메모리 보호 |

**절대 throw하지 않는다.** stdout 출력을 절대 차단하지 않는다.

## 진단 통계

```typescript
interface ForwarderStats {
  forwarded: number;     // ingest에 성공 전달된 record 수
  filtered: number;      // addressContext 없어서 skip된 수
  dropped: number;       // 에러/overflow로 유실된 수
  flushCount: number;    // flush 횟수
  lastFlushAt: string | null;  // 마지막 flush ISO-8601
}
```

`forwarder.getStats()`로 조회. health endpoint, 운영 진단용.

## Envelope 구성

```typescript
{
  transmission_id: "txm_...",
  sent_at: "2026-03-29T...",
  owner: { owner_type: "agent", owner_id: "svc:{serviceName}" },
  source: { service_name: "{serviceName}", sdk_name: "@qa-sdk/logger", sdk_version: "0.1.0" },
  runtime: { platform: "node" },
  build: { env: "{buildEnv}" },
  infra_context: { ... },
  records: EventRecord[],
}
```

## 테스트

### 유닛 (16건, ingest-forwarder.test.ts)

| 범주 | 검증 |
|------|------|
| 필터 | addressContext 없음/빈객체/null → skip, 있음 → 버퍼 |
| 변환 | event_key 자동/명시, address_context 전달, traceId/spanId 전달, 예약 필드 제외 |
| 배치 | batchSize 도달 시 자동 flush, shutdown drain |
| overflow | maxBufferSize 초과 시 oldest drop |
| fail-open | HTTP 에러/네트워크 에러 → throw 없이 drop, 카운터 증가 |
| envelope | 메타데이터(transmission_id, source, build, infra_context) 정확성 |

### 통합 (3건, ingest-forwarder.e2e.test.ts)

| 테스트 | 검증 |
|--------|------|
| 서비스 배선 패턴 | 실제 HTTP 서버 → createLogger + forwarder → 좌표 로그만 수신 확인 |
| 일반 로그 격리 | 좌표 없는 로그 10건 → ingest 0건 전달 |
| 명시 eventKey | `auth.login.success` 그대로 전달 |
