# spec-transition

`spec-transition`은 raw coordinate 위에 상태 의미를 덧씌우는 Transition Spec DSL 엔진이다.

## 먼저 볼 문서

- [Transition Spec DSL README](../../docs/plan/transition-spec-dsl/README.md) — 전체 설계
- [tier-1-types-and-schema.md](../../docs/plan/transition-spec-dsl/tier-1-types-and-schema.md) — 타입/스키마
- [tier-2-state-and-engine.md](../../docs/plan/transition-spec-dsl/tier-2-state-and-engine.md) — 상태/엔진
- [tier-3-pipeline-integration.md](../../docs/plan/transition-spec-dsl/tier-3-pipeline-integration.md) — pipeline 통합

## 패키지 역할

- transition schema, registry, state store, engine, decode adapter를 제공한다.
- 좌표 패턴을 상태 전이 의미로 해석한다.
- ingest/query/spec-core가 이 패키지를 transition kernel로 소비한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/transition.types.ts`, `src/transition.schema.ts`, `src/transition.registry.ts` — 모델
- `src/transition-engine.ts` — 엔진
- `src/state-store.ts`, `src/sqlite-state-store.ts` — 상태 저장소
- `src/decode-adapter.ts`, `src/match-adapter.ts`, `src/output-applier.ts`, `src/input-validator.ts` — adapter 계층

## 실행

```bash
pnpm --filter spec-transition build
pnpm --filter spec-transition test
```
