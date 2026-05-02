---
def:
  tier: component
  id: logger-contract
  address: def_document:v2:412817
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [observability]
  links:
    - target: platform-logger-spec
      type: refines
---

# 로거 계약

## 목적 ^purpose

QaLogger의 인터페이스, 설정 객체, 기록 파라미터를 분리해 이벤트 수집의 핵심 진입점 계약을 명확히 한다.

## 구성 ^overview

- `QaLogger 클래스`: log/startSpan/metric 3종 기록 메서드와 생명주기(flush/shutdown)를 정의한다.
- `QaLoggerConfig`: transport, owner, source, runtime, build, masking 등 설정 객체를 기술한다.
- `TraceContext`: trace_id, span stack, qa_session_id를 관리하는 컨텍스트를 정의한다.
- `Transport 인터페이스`: send/flush/shutdown 3 메서드의 전송 추상화를 명시한다.
- `Actor 주입`: setActor/clearActor로 모든 레코드에 행위 주체 정보를 자동 주입하는 계약을 기술한다.

## QaLogger 클래스

packages/logger/src/logger.ts에 구현된 핵심 기록 인터페이스. 이벤트 생성 코드가 transport/저장 구현을 몰라도 된다.

**3종 기록 메서드:**

| 메서드 | record_kind | 핵심 파라미터 |
|--------|-------------|---------------|
| `log(params)` | "log" | event_key, event_version, payload, address_context |
| `startSpan(params)` → SpanHandle | "span" | span_name + end() 호출 시 status_code |
| `metric(name, value, opts)` | "metric" | metric_type, unit, labels, buckets |

모든 메서드는 EventRecord를 생성하여 내부 버퍼에 추가하고, batchSize 도달 시 자동 flush를 트리거한다.

## QaLoggerConfig

```typescript
// logger/src/config.ts
interface QaLoggerConfig {
  transport: Transport;              // 전송 계층 (필수)
  owner: TransmissionOwner;         // tenant/workspace/user/agent
  source: TransmissionSource;       // service_name, sdk_name, sdk_version
  runtime: TransmissionRuntime;     // platform, device_ref, os_version
  build: TransmissionBuild;         // env, build_ref, release_version
  actor?: ActorContext;             // 전역 행위 주체
  maskingRules?: MaskingRule[];     // 페이로드 마스킹 규칙
  batchSize?: number;               // 기본 50
  flushIntervalMs?: number;         // 기본 5,000ms (0=비활성)
  maxBufferSize?: number;           // 기본 500, 초과 시 oldest 드롭
  onError?: (err, ctx) => void;     // 에러 핸들러 (기본 console.error)
  infraContext?: Record<string, string>;  // envelope 전체 적용 주소
  entrySnapshot?: string;           // 배포 시점 entry snapshot ID
}
```

## TraceContext

logger/src/context.ts에 구현. trace_id 생성, span stack push/pop, qa_session_id 관리.

- `pushSpan()`: 새 span을 스택에 추가, span_id 반환
- `popSpan()`: 현재 span 종료, 스택에서 제거
- `currentSpanId`: 스택이 비면 자동 생성
- `parentSpanId`: 스택 깊이 < 2이면 undefined

## Transport 인터페이스

```typescript
// logger/src/transport/transport.ts
interface Transport {
  send(envelope: TransmissionEnvelope): Promise<void>;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}
```

구현체 7종: HttpTransport, ProtobufTransport, OtlpTransport, MsgpackTransport, DebugWsTransport, NoopTransport, IngestForwarder.

- HttpTransport: JSON Content-Type, AbortController 기반 timeout
- ProtobufTransport: QAPB magic header + JSON-in-binary (application/x-protobuf)
- IngestForwarder: pino destination으로 동작. addressContext 포함 로그만 필터 → EventRecord 변환 → ingest-server 전달 (상세: `log-ingest-bridge`)
- NoopTransport: 테스트용 빈 구현

## Actor 주입

`setActor(actor)` → 이후 emit되는 모든 레코드에 actor_id, user_id, user_attributes를 자동 주입한다. `clearActor()`로 해제. ActorContext는 @qa-sdk/core에서 정의한 행위 주체 식별 타입이다.
