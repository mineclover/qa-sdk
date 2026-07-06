---
def:
  tier: component
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
sources:
  - packages/pino/src/index.ts
  - packages/pino/src/index.test.ts
  - packages/core/src/lib/create-logger.ts
  - packages/core/src/lib/create-logger.test.ts
  - packages/logger/src/logger.ts
  - packages/logger/src/transport/ingest-forwarder.ts
  - packages/logger/src/transport/ingest-forwarder.test.ts
---

# Logger

## 목적 ^purpose

구조화 JSON 로깅. `@qa-sdk/pino` (zero-dependency pino 호환 래퍼) + `@qa-sdk/core`의 `createLogger` 팩토리 제공.

## 구성 ^overview

- **`@qa-sdk/pino`**: npm pino의 zero-dependency 순수 JS 구현체. pnpm workspace alias로 `from "pino"` import가 이 패키지를 resolve
- **팩토리**: `createLogger("서비스명", options?)` — 서비스별 logger 인스턴스 생성
- **로그 레벨**: trace(10) ~ fatal(60) + silent, 환경별 자동 결정 (prod: info, dev: debug)
- **multi-destination**: stdout + 추가 destination (IngestForwarder 등) 동시 출력
- **child logger**: 부모 바인딩 상속 + 추가 바인딩 병합, 체이닝 가능
- **Transport**: `@qa-sdk/logger`에서 Http/Protobuf/OTLP/DebugWebSocket/IngestForwarder 제공

## @qa-sdk/pino — pino 호환 래퍼

npm pino를 직접 쓰지 않고 자체 래퍼를 만든 이유:

- **zero-dependency**: npm pino는 sonic-boom, on-exit-leak-free 등 native C++ binding + worker thread 의존. CF Workers 등 native binding 불가 환경에서 동작 안 함
- **번들 크기**: npm pino + 의존성 트리 vs `@qa-sdk/pino` 단일 파일 (~250행)
- **drop-in 호환**: `"pino": "workspace:@qa-sdk/pino@^9.9.4"` alias로 코드 변경 없이 교체. `from "pino"` import가 자체 래퍼를 resolve

### npm pino vs @qa-sdk/pino

| 기능 | npm pino | @qa-sdk/pino |
|------|---------|-------------|
| `pino(opts?, dest?)` 팩토리 | ✓ | ✓ |
| Logger (trace~fatal + child) | ✓ | ✓ |
| LoggerOptions (level, base, mixin, serializers, formatters) | ✓ | ✓ |
| Destination (write) | ✓ | ✓ |
| stdSerializers.err | ✓ | ✓ |
| pino.transport() (worker thread) | ✓ | ✗ |
| pino.multistream() | ✓ | ✗ |
| Native C++ binding (sonic-boom) | ✓ | ✗ |
| 외부 의존성 | 다수 | **0개** |

사용하는 서비스 (8개):
core, decode-service, demo-tests, gate-service, ingest-server, query-service, registry-client, registry-service

### workspace alias 설정

```jsonc
// packages/*/package.json
{
  "dependencies": {
    "pino": "workspace:@qa-sdk/pino@^9.9.4"
  }
}
```

코드에서는 `from "pino"`로 import — pnpm이 `@qa-sdk/pino`로 resolve.

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

`@qa-sdk/pino`가 제공하는 Logger 타입:

```typescript
interface Logger {
  level: Level;
  trace(obj?: unknown, msg?: unknown, ...args: unknown[]): void;
  debug(obj?: unknown, msg?: unknown, ...args: unknown[]): void;
  info(obj?: unknown, msg?: unknown, ...args: unknown[]): void;
  warn(obj?: unknown, msg?: unknown, ...args: unknown[]): void;
  error(obj?: unknown, msg?: unknown, ...args: unknown[]): void;
  fatal(obj?: unknown, msg?: unknown, ...args: unknown[]): void;
  child(bindings: Record<string, unknown>): Logger;
}
```

re-export: `import type { Logger } from "@qa-sdk/core";`

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
| `packages/pino/src/index.ts` | @qa-sdk/pino — zero-dependency pino 호환 구현체 |
| `packages/core/src/lib/create-logger.ts` | createLogger 팩토리 |
| `packages/logger/src/` | Transport 구현체 (Http, Protobuf, OTLP, IngestForwarder) |
| `packages/logger/src/transport/ingest-forwarder.ts` | 로그 → Ingest 브릿지 |

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/pino test
corepack pnpm --filter @qa-sdk/core test create-logger
corepack pnpm --filter @qa-sdk/logger test ingest-forwarder
```
