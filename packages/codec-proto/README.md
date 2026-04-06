# @qa-sdk/codec-proto

`@qa-sdk/codec-proto`는 envelope의 protobuf 전송 계층을 담당한다. 패키지 목적은 APM transport와 ingest 계약에서 읽는 것이 맞다.

## 먼저 볼 문서

- [transport.spec.md](../../docs/specs/apm-system/transport.spec.md) — 전송 계층 공통 계약
- [ingest-interface-contract.spec.md](../../docs/specs/ingest/ingest-api-system/ingest-interface-contract.spec.md) — protobuf payload가 ingest에서 해석되는 방식
- [infra-service-operations.md](../../docs/specs/infra-engine/infra-service-operations.md) — protobuf 전송 사용 맥락
- [system-packages.spec.md](../../docs/specs/system/system-packages.spec.md) — codec-proto의 플랫폼 체인 위치

## 패키지 역할

- JSON envelope을 protobuf 바이트로 encode/decode한다.
- transport bridge가 protobuf 경로를 택할 때 사용하는 얇은 codec 레이어다.
- `@qa-sdk/core` 타입 위에서 동작하는 zero-dependency 전송 보조층이다.

## 코드 진입점

- `src/index.ts` — public export
- `src/codec.ts` — protobuf codec
- `src/transport.ts` — 전송 보조

## 실행

```bash
pnpm --filter @qa-sdk/codec-proto build
pnpm --filter @qa-sdk/codec-proto test
```
