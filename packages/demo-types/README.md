# demo-types

`demo-types`는 `DEMO_CATALOG`에서 파생된 타입과 SDK 팩토리 산출물 묶음이다. 사람이 직접 설계하기보다 codegen 결과를 읽는 패키지로 보는 편이 맞다.

## 먼저 볼 문서

- [dsl-schema-versioning.spec.md](../../docs/specs/apm-system/apm-schema-system/dsl-schema-versioning.spec.md) — `DEMO_CATALOG → demo-types` 파생 체인
- [sdk-vite-onboarding-guide.md](../../docs/specs/guides-system/sdk-vite-onboarding-guide.md) — 소비처에서 demo-types를 어떻게 쓰는지
- [system-overview.md](../../docs/system-overview.md) — `demo-snapshot, demo-types`의 위치

## 패키지 역할

- prefix/axis/dims/context/dsl 타입과 `sdk-factory`를 제공한다.
- `qa-sdk codegen --output ./src` 결과가 이 패키지의 본체다.
- consumer 앱이 하드코딩 대신 typed prefix surface를 쓰게 하는 목적의 산출물 패키지다.

## 코드 진입점

- `src/index.ts` — barrel export
- `src/prefix-ids.ts`, `src/axes.ts`, `src/dims.ts` — 핵심 타입 산출물
- `src/context-types.ts`, `src/sdk-factory.ts`, `src/dsl.ts` — SDK/DSL 보조 산출물

## 실행

```bash
pnpm --filter demo-types build
pnpm --filter demo-types test
pnpm --filter demo-types generate
```
