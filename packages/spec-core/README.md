# @qa-sdk/spec-core

`@qa-sdk/spec-core`는 spec engine 커널이다. README는 기능 사용법보다 central spec 인덱스 역할을 한다.

## 먼저 볼 문서

- [spec-engine-system.md](../../docs/specs/spec-engine-system/spec-engine-system.md) — 전체 진입점
- [spec-core-types-group.md](../../docs/specs/spec-engine-system/spec-core-types-group.md) — 공개 타입/registry/IR
- [spec-prop-system.md](../../docs/specs/spec-engine-system/spec-prop-system.md) — publish/notify/codegen/DKG record 전파
- [convergence-layer-group.md](../../docs/specs/spec-engine-system/convergence-layer-group.md) — 수렴 계층
- [spec-architecture-stack.spec.md](../../docs/specs/spec-engine-system/spec-architecture-system/spec-architecture-stack.spec.md) — 패키지 내부 모듈 지도
- [realization-spec-core-improvement.md](../../docs/realization-spec-core-improvement.md) — 분리/정리 이력

## 패키지 역할

- PrefixSpec, spec registry, propagation, codegen, transition, visualization, DKG bridge를 순수 TS 커널로 제공한다.
- `@qa-sdk/convergence`, `dkg`, `spec-schema`, `spec-transition`을 묶는 상위 설계 엔진 역할을 맡는다.
- 서비스나 CLI는 이 패키지를 kernel로 소비하고, 프레임워크 의존은 바깥 계층에 둔다.

## 코드 진입점

- `src/index.ts` — 루트 export
- `src/spec/*` — spec/prefix 타입과 registry
- `src/loader/*` — catalog bridge와 spec loader
- `src/propagation/*` — publish/lifecycle/catalog writer
- `src/codegen/*` — IR과 언어별 generator
- `src/transition/*` — transition pipeline
- `src/visualization/*` — Mermaid/monitor query 계열
- `src/dkg/index.ts` — DKG bridge

## 실행

```bash
pnpm --filter @qa-sdk/spec-core build
pnpm --filter @qa-sdk/spec-core test
```
