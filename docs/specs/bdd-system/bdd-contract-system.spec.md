---
def:
  id: bdd-contract-system
  type: design
  tier: system
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: harness_func
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [testing, contract, structural]
  links:
    - target: docs-control-plane
      type: depends_on
    - target: bdd-contract-schema
      type: contains
    - target: bdd-contract-cli
      type: contains
    - target: bdd-contract-system-todo
      type: traces_to
    - target: scenario-authoring-guide
      type: traces_to
sources:
  - packages/core/src/types/bdd-contract.ts
  - packages/core/src/schema/bdd-contract.schema.ts
  - packages/core/src/bdd-contract/compile-scenario.ts
  - packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts
  - packages/cli/src/commands/docs.ts
---

# BDD Contract System

## 목적 ^purpose

BDD의 `Given / When / Then`을 qa-sdk의 기계적 행동 계약으로 정의하고, 같은 contract id에서 test unit과 implementation unit을 함께 추적한다.

## 구성 ^overview

- `bdd-contract-schema`: BDD IR 타입, Zod schema, ScenarioSpec/PipeGraph compile
- `bdd-contract-cli`: `qa-sdk docs bdd` CLI 소비 표면
- `docs-control-plane` adapter: `.cases.md` / `.test.md` fenced `yaml bdd` block을 `DocumentEnvelope.metadata.bdd`로 투영

## 핵심 규칙 ^defines

- BDD core가 의미를 소유하고, CLI는 소비자다.
- `bdd_contract.id`가 `test_unit.contract`와 `implementation_unit.contract`의 연결 키다.
- BDD compile은 deterministic하며 LLM/DSPy를 호출하지 않는다.
- Phase 1에서 모든 BDD CLI 동작은 read-only다.

## 소비 표면 ^consumes

```bash
qa-sdk docs bdd list <target> [--family-only] [--json]
qa-sdk docs bdd validate <target> [--family-only] [--json]
qa-sdk docs bdd units <target> [--family-only] [--json]
qa-sdk docs bdd compile <target> [--format scenario|pipe|both] [--family-only] [--json]
qa-sdk docs bdd test-plan <target> [--family-only] [--json]
qa-sdk docs bdd impl-plan <target> [--family-only] [--json]
```

## 검증 참조

- `packages/core/src/schema/bdd-contract.schema.test.ts`
- `packages/core/src/bdd-contract/compile-scenario.test.ts`
- `packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts`
- `packages/cli/src/commands/docs.test.ts`
