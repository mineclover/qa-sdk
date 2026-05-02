# @qa-sdk/definition-client

`@qa-sdk/definition-client`는 definition-service HTTP client다. 아직 전용 package spec은 없고, definition-service API 문서를 기준으로 읽는다.

## 먼저 볼 문서

- [definition-client.spec.md](../../docs/specs/definition-service/definition-client.spec.md) — 패키지 계약
- [definition-service-system.md](../../docs/specs/definition-service/definition-service-system.md) — 서비스 전체 개요
- [def-svc-api-contract.md](../../docs/specs/definition-service/def-svc-api-contract.md) — HTTP/GraphQL API 계약
- [definition-runtime-guide.md](../../docs/specs/guides-system/definition-runtime-guide.md) — 실제 서비스 연결/초기화 흐름
- [error-handling-convention.spec.md](../../docs/specs/system/system-support/error-handling-convention.spec.md) — 서비스 클라이언트 에러 처리 규칙

## 패키지 역할

- definition-service REST surface를 타입 있는 client로 감싼다.
- 일반 client와 NestJS 연동용 entrypoint를 함께 제공한다.
- 외부 서비스 호출 실패는 fail-open보다 throw가 기본이다.

## 코드 진입점

- `src/index.ts` — public export
- `src/client.ts` — 기본 HTTP client
- `src/nestjs.ts` — NestJS 연동 진입점
- `src/types.ts` — client 타입

## 실행

```bash
pnpm --filter @qa-sdk/definition-client build
pnpm --filter @qa-sdk/definition-client test
```
