---
def:
  id: bdd-contract-cli
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  tags: [testing, contract]
  links:
    - target: bdd-contract-system
      type: refines
    - target: docs-control-plane
      type: depends_on
sources:
  - packages/cli/src/command-groups/docs.commands.ts
  - packages/cli/src/commands/docs.ts
  - packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts
---

# BDD Contract CLI

## 목적 ^purpose

`qa-sdk docs bdd` 하위 명령이 BDD contract read model을 어떻게 노출하는지 정의한다.

## 명령 ^defines

| 명령 | 출력 |
|------|------|
| `list` | BDD contract 목록 |
| `validate` | BDD diagnostics |
| `units` | contract id 기준 test/implementation unit 그룹 |
| `compile` | ScenarioSpec 또는 PipeGraph |
| `test-plan` | test skeleton preview |
| `impl-plan` | source target별 implementation unit preview |

## 경계 ^constraint

- 이 문서는 **command surface inventory**만 소유한다.
- read-only / preview / family consumption / work-topic adjacency 판별 기준은 `bdd-contract-cli-rule`이 소유한다.
- 남은 실행 작업과 deferred 범위는 `bdd-contract-system.todo`가 소유한다.

즉, 이 spec은 "무슨 명령이 있는가"만 정의하고, "어떻게 소비하는가"와 "무엇이 아직 남았는가"는 종속 rule/todo를 참조한다.

## 관련 소스

- `packages/cli/src/command-groups/docs.commands.ts`
- `packages/cli/src/commands/docs.ts`
- `packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts`
