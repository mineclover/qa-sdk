---
def:
  id: platform-logger-spec
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: logger
  tags: [observability]
  links:
    - target: platform-chain-system
      type: refines
    - target: platform-core-spec
      type: depends_on
sources:
  - packages/logger/src/index.ts
  - packages/logger/src/logger.ts
  - packages/logger/src/context.ts
  - packages/logger/src/transport/http.ts
  - packages/logger/src/transport/noop.ts
  - packages/logger/src/transport/debug-ws.ts
  - packages/logger/src/transport/ingest-forwarder.ts
  - packages/sdk/src/logger.test.ts
  - packages/sdk/src/transport/transport.test.ts
---
# @qa-sdk/logger — 구조화 로깅

## 목적 ^purpose

`QaLogger` 기반 이벤트/스팬/메트릭 buffering과 transport 전송 계층을 제공한다. pino 호환 서비스 로거 팩토리는 `@qa-sdk/core`의 `createLogger()` 책임이고, 이 패키지는 수집 SDK용 `TransmissionEnvelope` 생성과 transport 계약을 소유한다.

소스: `packages/logger/src/logger.ts`, `packages/logger/src/transport/http.ts`, `packages/logger/src/transport/noop.ts`, `packages/logger/src/transport/debug-ws.ts`, `packages/logger/src/transport/ingest-forwarder.ts`

## 정의 ^defines

- QaLogger — log/span/metric record를 buffer하고 flush 시 TransmissionEnvelope로 전송
- TraceContext — trace/span/session context 관리
- Transport — `send(envelope)`, optional `flush()`/`shutdown()` 계약
- HttpTransport, NoopTransport, MsgpackTransport, ProtobufTransport, OtlpTransport, DebugWebSocketTransport — transport 구현
- applyMasking() / MaskingRule — payload masking 규칙
- IngestForwarder — pino destination에서 ingest pipeline으로 전달하는 bridge

## 경계 ^boundary

- `QaLogger`는 `info/warn/error/debug` pino logger가 아니라 SDK event recorder다.
- `DebugWebSocketTransport`는 개발용 실시간 디버깅 transport이고, 연결 실패 시 내부 buffer와 reconnect backoff를 사용한다.
- flush 실패 시 buffer cap 안에서 record를 재삽입하고, 초과분은 oldest-drop 정책으로 처리한다.

## 소비 ^consumes

- @qa-sdk/core — EventRecord, TransmissionEnvelope, ID/time helper, msgpack frame helper

## 관련 소스

- `packages/logger/src/logger.ts` — QaLogger 구현
- `packages/logger/src/transport/*.ts` — transport 구현
