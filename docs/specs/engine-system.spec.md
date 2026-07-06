---
def:
  id: qa-sdk-engine-system
  type: spec
  tier: system
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: domain
  svc: engine
  tags: [structural, runtime]
  links:
    - target: spec-engine-system
      type: depends_on
    - target: analysis-system
      type: depends_on
    - target: definition-catalog-spec
      type: depends_on
    - target: dkg-system-root
      type: depends_on
    - target: df-system
      type: depends_on
    - target: ingest-engine
      type: refs
    - target: system-data-flow
      type: refs
    - target: gate-engine-group
      type: refs
    - target: spec-core-types-group
      type: refs
sources:
  - packages/engine/package.json
  - packages/engine/src/index.ts
  - packages/engine/test/pipeline.test.ts
  - packages/convergence/package.json
  - packages/convergence/src/index.ts
  - packages/convergence/src/convergence-runner.ts
  - packages/convergence/src/self-check-analyzer.ts
  - packages/convergence/src/smoke.test.ts
  - packages/spec-core/package.json
  - packages/spec-core/src/index.ts
  - packages/spec-core/src/dkg/index.ts
  - packages/spec-core/src/propagation/index.ts
  - packages/spec-core/src/transition/index.ts
  - packages/decision-flow/package.json
  - packages/decision-flow/src/index.ts
  - packages/decision-flow/src/engine.ts
  - packages/decision-flow/src/schema.ts
  - packages/decision-flow/src/coordinate.ts
  - packages/decision-flow/src/decision-flow.test.ts
  - packages/definition-catalog/package.json
  - packages/definition-catalog/src/index.ts
  - packages/definition-catalog/src/registry.ts
  - packages/definition-catalog/src/impact.ts
  - packages/dkg/package.json
  - packages/dkg/src/index.ts
  - packages/dkg/src/graph-registry.ts
  - packages/dkg/src/catalog-derive.ts
  - docs/specs/ingest/ingest-engine.spec.md
  - docs/specs/spec-engine-system/spec-engine-system.md
  - docs/specs/analysis-system/analysis-system.md
  - docs/specs/definition-catalog/definition-catalog.spec.md
  - docs/specs/dkg-system-root.spec.md
  - docs/specs/decision-flow/df-system.md
  - docs/specs/gate/gate-engine-group.md
  - docs/specs/spec-engine-system/spec-core-types-group.md
  - docs/specs/system/system-data-flow.spec.md
---

# QA-SDK Engine System

## 목적 ^purpose

문서 그래프 분석, ingest reconstruction/match/verdict, 수렴 분석, spec 전파, DKG 질의, decision-flow 실행을 한곳에서 찾기 위한 상위 engine entry 문서다. 실제 runtime ownership은 `@qa-sdk/engine`, `@qa-sdk/convergence`, `@qa-sdk/spec-core`, `definition-catalog`, `dkg`, `decision-flow`가 나눠 갖고, 이 문서는 그 추론/실행 경계를 라우팅한다.

## 구성 ^overview

- `ingest-engine`: `@qa-sdk/engine`의 reconstruction, spec compile, path matching, path observation, verdict 계산.
- `spec-engine-system`: 스펙 구조, reference, phase, convergence, propagation을 관리하는 설계 규칙 엔진.
- `analysis-system`: 수집된 이벤트/문서 데이터를 기반으로 수렴, 공출현, 상태 전이를 분석하는 관측 엔진.
- `definition-catalog-spec`: 문서 그래프와 definition metadata를 관리하는 정의 좌표계.
- `dkg-system-root`: 설계 지식 그래프의 노드/엣지/상태 저장/질의 경계.
- `df-system`: decision-flow 모델, 인터페이스, 분석, narrative 계층.
- `gate-engine-group`: 품질 게이트와 실행 aware query의 runtime engine.
- `system-data-flow`: SDK/ingest/engine/DKG까지 이어지는 runtime data-flow entry.

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/engine build
corepack pnpm --filter @qa-sdk/engine test
corepack pnpm --filter @qa-sdk/convergence build
corepack pnpm --filter @qa-sdk/convergence test
corepack pnpm --filter @qa-sdk/spec-core build
corepack pnpm --filter @qa-sdk/spec-core test
corepack pnpm --filter decision-flow typecheck
corepack pnpm --filter decision-flow test
corepack pnpm def:check
corepack pnpm arch:feedback
```
