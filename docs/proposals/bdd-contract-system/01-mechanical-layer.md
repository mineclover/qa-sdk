---
def:
  id: bdd-contract-system-01-mechanical-layer
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: meta-semantic-system
  projection_plane: intent
status: draft
date: 2026-04-20
part_of: bdd-contract-system
role: mechanical-layer
supersedes: ai-dlc-dspy-harness-05-bdd-mechanical-design
superseded_by: -
---

# BDD Mechanical Layer — 타입, 파서, 검증, 컴파일

## 목적 ^purpose

BDD contract를 사람이 읽는 문서 규칙에서 도구가 소비하는 read model로 끌어올린다.

## 구성 ^overview

현재 구현된 경로:

```text
.cases.md / .test.md fenced yaml bdd
  ↓ packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts
DocumentEnvelope.metadata.bdd
  ↓ qa-sdk docs bdd validate
BddContract[]
  ↓ packages/core/src/bdd-contract/compile-scenario.ts
ScenarioSpec[] / PipeGraph[]
```

---

## 1. Core IR

구현 파일:

- `packages/core/src/types/bdd-contract.ts`
- `packages/core/src/schema/bdd-contract.schema.ts`

핵심 타입:

- `BddContract`
- `BddTestUnit`
- `BddImplementationUnit`
- `BddGiven`
- `BddWhen`
- `BddThen`

YAML은 snake_case를 허용하고 TypeScript IR은 camelCase로 정규화한다.

---

## 2. Parser / Projection

구현 파일:

- `packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts`
- `packages/cli/src/lib/docs-control-plane/adapters/definition-markdown.ts`

지원 형식:

````markdown
```yaml bdd
bdd_contract: ...
test_unit: ...
implementation_unit: ...
```
````

Projection:

```ts
DocumentEnvelope.metadata.bdd = {
  contracts,
  testUnits,
  implementationUnits,
  diagnostics
}
```

---

## 3. Validation

검증 종류:

- parse/schema diagnostics
- duplicate contract id
- test/implementation unit references
- deterministic behavior key conflict
- write-mode missing failure path
- cross-owner implementation unit

`--family-only` 사용 시 같은 family 문서 간 contract/unit 참조도 검증한다.

---

## 4. Compile

구현 파일:

- `packages/core/src/bdd-contract/compile-scenario.ts`

Exports:

- `compileBddContractToScenarioSpec`
- `compileBddContractsToScenarioSpecs`
- `compileBddContractToPipeGraph`
- `compileBddContractsToPipeGraphs`

초기 매핑:

- `scenario_id` ← `bdd_contract.id`
- `domain` ← `owner_system`
- `entry_conditions` ← `given.state`, `given.predicates`
- required step `event_key` ← `when.event_key` 또는 `when.operation`
- constraints ← `when.actor`, `when.operation`, `then.*`

---

## 5. 남은 작업

- `def validate` warning integration
- test file scaffold write option
- implementation planner → PRD/JSON 변환
- dependency-contract cross-owner 예외 정책 확정
