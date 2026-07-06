---
def:
  id: definition-metadata-scope-aspect
  type: design
  tier: system
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [metadata, structural, coordinate-cluster]
  links:
    - target: definition-frontmatter-metadata-system
      type: refines
    - target: definition-taxonomy
      type: depends_on
sources:
  - packages/definition-catalog/src/types.ts
  - packages/definition-catalog/src/vocabulary.ts
  - packages/definition-catalog/src/taxonomy.ts
  - packages/definition-catalog/src/taxonomy.test.ts
  - packages/definition-catalog/src/frontmatter.test.ts
---

# Definition Metadata — `scope` / `aspect`

## 목적 ^purpose

`def.scope`와 `def.aspect`는 문서 좌표의 주제와 세부 측면을 정의한다. 주소 중복, graph grouping, search/filter의 핵심 축이다.

## 정의 ^defines

| scope | 대표 aspect | 질문 |
|-------|--------------|------|
| `ui` | layout, component, interaction | 화면/시각 표면인가 |
| `feature` | func_def, scenario | 기능/행동인가 |
| `flow` | user_scenario, process_flow, relation | 흐름/관계인가 |
| `state` | app_state, domain_state, system_state | 상태인가 |
| `constraint` | tech_constraint, biz_constraint, infra_constraint | 규칙/제약인가 |
| `data` | domain_data, system_data, external_data, prefix_schema, axis_catalog | 데이터/vocabulary인가 |
| `interface` | api_contract, cli_contract, event_contract | 소비 계약인가 |
| `meta` | proposal_design | 메타 설계인가 |

## 제약 ^constraint

- 유효한 scope/aspect 조합만 허용한다.
- Interface 책임은 `tier`가 아니라 `scope: interface`로 표현한다.
- 새 aspect 추가는 taxonomy 변경이다. 5Q checklist와 validator/test 갱신을 함께 수행한다.
