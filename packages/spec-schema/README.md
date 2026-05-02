# spec-schema

`spec-schema`는 Layer 2 스키마 시스템과 검증 로직을 담는 패키지다. 전용 package spec은 약하고, spec-engine 구조 문서를 기준으로 읽는다.

## 먼저 볼 문서

- [spec-engine-system.md](../../docs/specs/spec-engine-system/spec-engine-system.md) — 상위 진입점
- [spec-arch-layers.spec.md](../../docs/specs/spec-engine-system/spec-arch-group/spec-arch-layers.spec.md) — spec-core 내부 schema 계층 위치
- [spec-architecture-stack.spec.md](../../docs/specs/spec-engine-system/spec-architecture-system/spec-architecture-stack.spec.md) — schema registry/validator 맥락

## 패키지 역할

- schema category, registry, validator, preset을 제공한다.
- validation error를 좌표화하는 보조 codec과 shared graph contract를 포함한다.
- spec-core와 convergence가 공통으로 사용하는 구조 스키마 레이어다.

## 코드 진입점

- `src/index.ts` — public export
- `src/schema.types.ts`, `src/schema.registry.ts`, `src/schema.validator.ts` — 핵심 스키마
- `src/category-rules.ts`, `src/presets.ts` — 규칙/프리셋
- `src/schema-validation-codec.ts` — validation coordinate codec
- `src/shared/*` — 공통 에러/결과/graph-port

## 실행

```bash
pnpm --filter spec-schema build
pnpm --filter spec-schema test
```
