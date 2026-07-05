# codegen-core

`codegen-core`는 snapshot/catalog 입력에서 TypeScript/Proto 산출물을 만드는 순수 함수 라이브러리다. 구현 기준은 APM codegen 문서군이 맡는다.

## 먼저 볼 문서

- [apm-codegen-system.md](../../docs/specs/apm-system/apm-codegen-system.md) — codegen 상위 개요
- [codegen-schema-output.spec.md](../../docs/specs/apm-system/apm-codegen-system/codegen-schema-output.spec.md) — 산출물 구조 계약
- [spec-prop-codegen.spec.md](../../docs/specs/spec-engine-system/spec-prop-system/spec-prop-codegen.spec.md) — spec propagation과 codegen 연결

## 패키지 역할

- Catalog/SchemaSnapshot을 TS/Proto 코드로 변환한다.
- naming, event-track, data-object 코드 생성기를 순수 함수로 제공한다.
- CLI나 상위 publish 경로가 I/O를 맡고, 이 패키지는 생성 규칙만 담당한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/typescript.ts`, `src/catalog-typescript.ts` — TS 산출물
- `src/proto.ts` — Proto 산출물
- `src/event-track-typescript.ts` — event track 생성
- `src/data-object-typescript.ts` — data object 생성
- `src/naming.ts` — naming 규칙

## 실행

```bash
corepack pnpm --filter codegen-core build
corepack pnpm --filter codegen-core test
```
