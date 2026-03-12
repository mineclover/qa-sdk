# qa-sdk

**Trace-based QA Observability Platform**

QA 세션이 주입된 실행 흐름의 trace를 수집하고,
Spec Graph와 Runtime Graph를 비교하여
시스템 동작이 의도한 로직·정책·행동 구조와 일치하는지 자동 검증하는 플랫폼.

---

## 모노레포 구조

```text
packages/
  core/               @qa-sdk/core             공유 타입 · 스키마 · 유틸리티
  sdk/                @qa-sdk/sdk              이벤트 수집 SDK (브라우저/Node/Edge)
  registry-server/    @qa-sdk/registry-server  서비스·이벤트 메타데이터 Registry API
```

---

## 패키지 요약

### `@qa-sdk/core`

모든 패키지가 공유하는 **타입 정의, Zod 검증 스키마, ID/clock 유틸리티**.

| 분류 | 내용 |
|---|---|
| types/envelope | `TransmissionEnvelope`, `TransmissionOwner`, `TransmissionSource`, `TransmissionRuntime`, `TransmissionBuild` |
| types/record | `EventRecord`, `RecordKind`(log/span), `SpanStatusCode` |
| types/payload | `PayloadFormat`, `PayloadEncoding`, `MaskingMode`, `MaskedFieldMarker` |
| types/session | `QaSession` |
| types/scenario | `ScenarioSpec`, `ScenarioStep`, `StepConstraint`, `BranchDef` — Scenario Spec DSL |
| types/graph | `SpecGraph`, `SpecNode`, `SpecEdge` — 기대 행동 그래프 / `RuntimeGraph`, `RuntimeNode`, `RuntimeEdge` — 실제 실행 그래프 |
| types/verdict | `Verdict`, `MatchResult`, `VerdictReport`, `LatencyViolation` |
| types/registry | `ServiceEntry`, `EventEntry`, `EventCategory`, `EventLifecycleStage` |
| schema/ | Zod 스키마 — `transmissionEnvelopeSchema`, `eventRecordSchema`, `scenarioSpecSchema` 등 |
| lib/ | `newTransmissionId()`, `newLogId()`, `newTraceId()`, `newSpanId()`, `newQaSessionId()`, `now()` |

의존: `zod`, `ulid`

---

### `@qa-sdk/sdk`

브라우저·Node·Edge 환경에 부착하는 **QA 로깅 SDK**.
trace 기반 이벤트 수집, 배치 전송, 클라이언트 마스킹을 담당한다.

| 모듈 | 역할 |
|---|---|
| `QaLogger` | 핵심 로거 — `log()`, `startSpan()`, `flush()`, `shutdown()` |
| `TraceContext` | trace_id / span stack / qa_session_id 관리 |
| `applyMasking()` | payload 마스킹 엔진 — raw, mask, drop, hash 모드 |
| `HttpTransport` | HTTP POST 전송 (fetch 기반, timeout, custom headers) |
| `NoopTransport` | 메모리 전송 — 테스트/dry-run용 |
| `Transport` interface | 커스텀 전송 구현용 인터페이스 |

의존: `@qa-sdk/core`

상세 사용법: [`packages/sdk/README.md`](packages/sdk/README.md)

---

### `@qa-sdk/registry-server`

서비스·이벤트 메타데이터를 관리하는 **Registry HTTP API**.
SDK와 Scenario Engine이 이벤트 의미를 참조하는 기준점.

| 구성 | 설명 |
|---|---|
| 프레임워크 | Hono + @hono/node-server |
| DB | PostgreSQL + Drizzle ORM |
| 테이블 | `services`, `service_events` |
| ID | ULID 기반 (`svc_`, `evt_` prefix) |
| 버전관리 | `event_version` 3자리 자동 증가, advisory lock으로 동시성 보장 |

**도메인 규칙:**

- `service_name`은 전역 유니크, snake_case
- `event_key`는 서비스 내 유니크, snake_case
- 유니크 키: `(service_id, event_key, event_version)`
- SDK lookup 키: `(service_name, event_key, event_version)`

**API 엔드포인트:**

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | 헬스체크 |
| POST | `/services` | 서비스 생성 |
| GET | `/services/:serviceName` | 서비스 조회 |
| PATCH | `/services/:serviceId` | 서비스 수정 |
| POST | `/services/:serviceId/events` | 이벤트 생성 (버전 자동 발급) |
| GET | `/services/:serviceName/events/:eventKey` | 이벤트 버전 목록 |
| GET | `/services/:serviceName/events/:eventKey/versions/:eventVersion` | 특정 버전 조회 |
| PATCH | `/events/:eventId` | 이벤트 수정 |

**에러 코드:** `INVALID_INPUT`, `SERVICE_NOT_FOUND`, `SERVICE_NAME_CONFLICT`, `EVENT_NOT_FOUND`, `EVENT_VERSION_OVERFLOW`, `INTERNAL_ERROR`

---

## 전체 파이프라인

```text
QA Session Injection
  → @qa-sdk/sdk (QaLogger)
    → Transmission Envelope 전송
      → Trace Reconstruction
        → Runtime Graph 생성
          → Spec Graph 로딩 (Scenario DSL)
            → Graph Matching
              → Verdict 판정
                → Insight / Report
```

---

## 개발

```bash
# 의존성 설치
pnpm install

# 전체 빌드
pnpm run build

# 개별 패키지 빌드
pnpm --filter @qa-sdk/core run build
pnpm --filter @qa-sdk/sdk run build
pnpm --filter @qa-sdk/registry-server run build

# registry-server 개발 모드
pnpm --filter @qa-sdk/registry-server run dev

# 전체 클린
pnpm run clean
```

---

## 기술 스택

| 항목 | 선택 |
|---|---|
| 언어 | TypeScript (ES2022, NodeNext) |
| 패키지 매니저 | pnpm workspace |
| 검증 | Zod |
| ID | ULID |
| HTTP 프레임워크 | Hono |
| DB | PostgreSQL |
| ORM | Drizzle |
