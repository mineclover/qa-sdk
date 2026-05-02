# @qa-sdk/logger

`@qa-sdk/logger`는 구조화 로깅과 transport 구현체를 제공한다. logger/transport 의미는 중앙 APM 문서가 SSOT다.

## 먼저 볼 문서

- [logger.spec.md](../../docs/specs/apm-system/logger.spec.md) — 로거와 transport 체계 전체
- [transport.spec.md](../../docs/specs/apm-system/transport.spec.md) — 전송 계층 공통 계약
- [platform-logger-spec.md](../../docs/specs/platform-chain/platform-logger-spec.md) — 플랫폼 체인에서의 logger 위치

## 패키지 역할

- QaLogger 구현과 masking/context/config를 제공한다.
- Http, Protobuf, OTLP, DebugWebSocket, IngestForwarder, Noop transport를 제공한다.
- 서비스별 `createLogger()` 팩토리와 결합되는 transport 구현층이다.

## 코드 진입점

- `src/index.ts` — public export
- `src/logger.ts` — logger 구현
- `src/context.ts`, `src/config.ts`, `src/masking.ts` — 보조 surface
- `src/transport/http.ts`, `src/transport/protobuf.ts`, `src/transport/otlp.ts`, `src/transport/debug-ws.ts`, `src/transport/ingest-forwarder.ts`, `src/transport/noop.ts` — transport 구현

## 실행

```bash
pnpm --filter @qa-sdk/logger build
pnpm --filter @qa-sdk/logger test
```
