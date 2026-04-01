---
def:
  id: infra-logger-spec
  address: def_document:v2:343176
  scope: data
  aspect: system_data
  depth: specification
  svc: cli
  lifecycle: approved
  layer: domain
  tags: [observability]
  links:
    - target: logger-contract
      type: depends_on
---

# Logger

## 목적 ^purpose

구조화 JSON 로깅. npm `pino` 기반 + `@qa-sdk/core`의 `createLogger` 팩토리 제공.

## 구성 ^overview

- **팩토리**: `createLogger("서비스명", options?)` — 서비스별 pino 인스턴스 생성
- **로그 레벨**: trace(10) ~ fatal(60) + silent, 환경별 자동 결정 (prod: info, dev: debug)
- **multi-destination**: stdout + 추가 destination (IngestForwarder 등) 동시 출력
- **child logger**: 부모 바인딩 상속 + 추가 바인딩 병합, 체이닝 가능
- **Transport**: `@qa-sdk/logger`에서 Http/Protobuf/OTLP/DebugWebSocket/IngestForwarder 제공

## 상태

implemented — `@qa-sdk/core` createLogger + `@qa-sdk/logger` Transport 체계로 운영 중.
레거시 `@qa-sdk/pino` 래퍼는 미채택, 제거 대상.

## 팩토리

```typescript
// @qa-sdk/core
import { createLogger } from "@qa-sdk/core";

const logger = createLogger("ingest-server");
const logger = createLogger("ingest-server", {
  destinations: [{ stream: createIngestForwarder({...}), level: "info" }],
});
```

- 서비스에서는 `createLogger("서비스명")` 필수. `console.log/warn/error` 사용 금지
- 라이브러리에서는 `createLogger` 사용 또는 생성자로 logger 주입

## Logger 인터페이스

npm `pino`의 Logger 타입을 그대로 사용:

```typescript
import type { Logger } from "pino";
// re-export: import type { Logger } from "@qa-sdk/core";
```

## 로그 레벨

| 레벨 | 우선순위 |
|---|---|
| trace | 10 |
| debug | 20 |
| info | 30 |
| warn | 40 |
| error | 50 |
| fatal | 60 |
| silent | Infinity |

## 에러 로깅 규칙

- `logger.error({ err }, "설명")` — `err` 키 사용 (pino 자동 직렬화)
- `error` 키 사용 금지 (`{}`로 출력됨)
- 빈 catch 블록 금지 — 최소 `logger.warn`

## Transport 체계 (@qa-sdk/logger)

| Transport | 용도 |
|-----------|------|
| `HttpTransport` | HTTP 전송 |
| `ProtobufTransport` | Protobuf 인코딩 전송 |
| `OtlpTransport` | OpenTelemetry 로그 전송 |
| `DebugWebSocketTransport` | 개발 디버그 WS |
| `IngestForwarder` | addressContext 있는 로그 → ingest 파이프라인 전달 |
| `NoopTransport` | 테스트용 |

## 관련 소스

| 파일 | 역할 |
|------|------|
| `packages/core/src/lib/create-logger.ts` | createLogger 팩토리 (npm pino 기반) |
| `packages/logger/src/` | Transport 구현체 (Http, Protobuf, OTLP, IngestForwarder) |
| `packages/logger/src/transport/ingest-forwarder.ts` | 로그 → Ingest 브릿지 |
