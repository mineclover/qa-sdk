---
def:
  id: operational-ontology-definition-graph-requirements
  type: knowledge
  knowledge_kind: guide
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-validation-boundary
      type: depends_on
    - target: operational-ontology-design-change-validation-matrix
      type: traces_to
    - target: definition-management
      type: depends_on
    - target: definition-mgmt-graph-links
      type: depends_on
    - target: doc-type-convention
      type: depends_on
sources:
  - packages/definition-catalog/src/frontmatter.ts
  - packages/definition-catalog/src/validate.ts
  - packages/definition-catalog/src/large-leaf-split.test.ts
  - packages/definition-catalog/src/code-references.ts
  - packages/cli/src/commands/def.ts
---

# Operational Ontology Definition Graph Requirements — ontology 문서 graph 규칙

## 목적 ^purpose

operational ontology 문서를 구현 전에 검증 가능한 definition graph로 유지하기 위한 frontmatter, `contains`, leaf split, `sources` 규칙을 정의한다. 목표는 module/leaf/plan/todo/knowledge 문서가 같은 ontology 경계 안에서 drift 없이 연결되고, `def validate`가 구현 시작 전 graph 누락을 잡게 하는 것이다.

## 구성 ^overview

이 규칙은 operational ontology 문서에 대한 추가 계약이다.

- **Frontmatter contract** — 문서 종류별 필수 `def` 필드와 top-level `sources` 사용 여부.
- **Graph contract** — module은 구성원을 `contains`로 소유하고 leaf/plan/todo는 부모를 횡방향 링크로 추적한다.
- **Split contract** — leaf가 150줄 경고에 닿기 전에 module + leaf 구조로 나눈다.
- **Source contract** — 구현된 spec은 implementation file과 test file을 함께 가리킨다.

## Frontmatter Requirements

`def.type`은 `spec` 또는 `knowledge`만 사용한다. `.plan.md`와 `.todo.md`는 파일 확장자로 variant가 결정되며 `def.type: plan` 또는 `def.type: todo`를 쓰지 않는다.

| 문서 종류 | 필수 frontmatter | 필수 링크 | `sources` |
|-----------|------------------|-----------|-----------|
| ontology module | `def.id`, `def.level: module`, `def.scope`, `def.aspect`, `def.depth: overview`, `def.lifecycle`, `def.layer`, `def.tags`, `def.links` | 자식 문서마다 `contains`; 상위 문서가 있으면 `refines` 또는 `depends_on` | module 자체가 구현 경계를 소유할 때만 사용. 보통 leaf가 source를 소유한다. |
| ontology leaf | `def.id`, `def.level: leaf`, `def.scope`, `def.aspect`, `def.depth`, `def.lifecycle`, `def.layer`, `def.tags`, `def.links` | 상위 module/group으로 `refines` 또는 관련 계약으로 `depends_on`; `contains` 금지 | 구현된 동작을 설명하면 implementation file과 test file을 함께 명시한다. |
| ontology plan | `.plan.md`, `def.id`, `def.level: leaf`, `def.scope: flow`, `def.aspect: process_flow`, `def.depth: specification`, `def.lifecycle: draft`, `def.layer`, `def.links` | 소유 spec 또는 system에 `refines`; 실행 TODO가 있으면 TODO와 `traces_to` | 방향 계획이 이미 구현 파일을 handoff evidence로 삼을 때만 명시한다. |
| ontology todo | `.todo.md`, `def.id`, `def.level: leaf`, `def.scope: flow`, `def.aspect: process_flow`, `def.depth: specification`, `def.lifecycle: draft`, `def.layer`, `def.links` | 소유 plan/spec에 `refines` 또는 `depends_on`; sibling plan과는 `traces_to` 우선 | 체크리스트가 구체 구현 파일을 변경 대상으로 고정할 때만 명시한다. |
| ontology knowledge | `def.type: knowledge`, `def.knowledge_kind`, `def.id`, `def.level`, `def.scope`, `def.aspect`, `def.depth`, `def.lifecycle`, `def.layer`, `def.tags`, `def.links` | guide/concept가 system을 상세화하면 `refines`; 외부 boundary는 `depends_on` | 구현된 behavior guide이면 sources 필요. 판단/철학만 기록하면 생략 가능하다. |

## Contains Requirements

`level: module`인 ontology 문서는 단일 개념과 그 구성 요소를 정의하므로 항상 `contains` 자식이 필요하다. 문서 본문에 `## 구성 ^overview`, `## 위임 ^delegates`, phase/member list, projector family, schema plane처럼 하위 문서가 언급되면 frontmatter `def.links`에도 같은 하위 문서를 `contains`로 등록한다.

Module로 둘 수 없는 경우:

- 하위 문서가 아직 없고 한 문서 안에서 최종 동작을 정의한다면 `level: leaf`로 둔다.
- 같은 문서를 두 module이 함께 소유해야 하면 먼저 진짜 소속을 하나로 정하고, 공유가 의도된 경우에만 `cross-scope` 태그와 concept link 근거를 남긴다.
- 계획과 TODO는 실행 상태를 추적하는 leaf다. 여러 실행 문서를 구성원으로 소유해야 할 때만 별도 module spec을 만들고 그 module이 `contains`를 가진다.

## Leaf Split Rule

Ontology leaf는 최종 명세 단위다. 한 leaf가 120줄을 넘으면 다음 편집 전에 split 후보인지 확인하고, 140줄을 넘은 leaf에 새 섹션을 추가해야 한다면 먼저 module + leaf 구조로 분리한다. 150줄 이상 approved leaf는 `def validate`의 `leaf-too-long` warning 대상이므로 구현 시작 전에 `/def-split` 기준으로 나눈다.

줄 수와 무관하게 아래 신호가 있으면 즉시 split한다.

- 한 문서가 schema, allocation, registry lifecycle처럼 서로 다른 SSOT를 동시에 정의한다.
- 본문에 독립 테스트 gate가 둘 이상 있고 각각 다른 package source를 가진다.
- plan/todo가 장기 방향과 실행 체크박스를 함께 담아 현재 세션 작업 경계를 흐린다.

## Source Mapping Rule

`sources`는 frontmatter top-level에 둔다. `def:` 안에 넣지 않는다.

Spec이 구현된 behavior를 설명하면 최소 한 개의 implementation file과 해당 behavior를 검증하는 test file을 함께 가리킨다. 예시는 다음과 같다.

```yaml
sources:
  - packages/operational-ontology/src/internal/ontology-allocation-core.ts
  - packages/operational-ontology/src/allocation.ts
  - packages/operational-ontology/src/allocation.test.ts
```

Boundary guide나 handoff spec은 owned package source를 우선 넣고, registry-service/index-meta 같은 외부 lifecycle source는 그 문서가 실제 경계 증거로 해석할 때만 넣는다. 넓은 system overview가 모든 implementation file을 직접 소유하지 않도록, 구체 source link는 leaf spec으로 내린다.

## Validation Gate

Ontology graph requirement 변경은 아래 gate로 닫는다.

```bash
node packages/cli/dist/index.js def validate
pnpm --filter operational-ontology test
pnpm --filter operational-ontology typecheck
pnpm --filter operational-ontology build
```
