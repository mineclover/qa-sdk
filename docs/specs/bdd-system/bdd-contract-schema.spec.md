---
def:
  id: bdd-contract-schema
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [testing, contract]
  links:
    - target: bdd-contract-system
      type: refines
    - target: scenario-api-spec
      type: depends_on
sources:
  - packages/core/src/types/bdd-contract.ts
  - packages/core/src/schema/bdd-contract.schema.ts
  - packages/core/src/bdd-contract/compile-scenario.ts
---

# BDD Contract Schema

## 목적 ^purpose

`BddContract`, `BddTestUnit`, `BddImplementationUnit`의 타입과 검증 규칙, ScenarioSpec/PipeGraph compile 규칙을 정의한다.

## 구성 ^overview

| 단위 | 역할 |
|------|------|
| `BddContract` | Given/When/Then 행동 계약 |
| `BddTestUnit` | contract를 검증하는 최소 테스트 단위 |
| `BddImplementationUnit` | contract를 만족시키는 최소 구현 단위 |
| `compileBddContractToScenarioSpec` | BDD를 ScenarioSpec으로 변환 |
| `compileBddContractToPipeGraph` | BDD를 PipeGraph로 변환 |

현재 구현 파일:

- `packages/core/src/types/bdd-contract.ts`
- `packages/core/src/schema/bdd-contract.schema.ts`
- `packages/core/src/bdd-contract/compile-scenario.ts`

## 정규형 ^defines

```yaml
bdd_contract:
  id: <entity>.<state-or-context>.<operation>.<outcome>.v1
  owner_system: <system-id>
  contract_kind: state-transition | query-projection | event-reaction | validation-failure | dependency-contract
  mode: read | write
  given: {}
  when: {}
  then: {}
```

YAML 입력은 snake_case를 허용하고, TypeScript IR은 camelCase로 정규화한다.

## Compile 규칙 ^constraint

- `scenario_id` ← `bdd_contract.id`
- `version` ← id suffix `.vN`, 없으면 `1`
- `domain` ← `owner_system`
- `entry_conditions` ← `given.state`, `given.predicates`
- single required step `event_key` ← `when.event_key` 또는 `when.operation`
- step constraints ← `when.actor`, `when.operation`, `then.state`, `then.emits`, `then.returns`, `then.egress`, `then.error`

현재 compile exports:

- `compileBddContractToScenarioSpec()`
- `compileBddContractsToScenarioSpecs()`
- `compileBddContractToPipeGraph()`
- `compileBddContractsToPipeGraphs()`

모든 compile 함수는 deterministic이며 LLM/DSPy를 호출하지 않는다.

## 관련 소스

- `packages/core/src/types/bdd-contract.ts`
- `packages/core/src/schema/bdd-contract.schema.ts`
- `packages/core/src/bdd-contract/compile-scenario.ts`
