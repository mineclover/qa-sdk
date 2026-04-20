---
def:
  id: meta-taxonomy
  type: knowledge
  knowledge_kind: concept
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural, entry-point]
  links:
    - target: taxonomy-boundaries
      type: refines
    - target: definition-taxonomy
      type: constrains
    - target: structural-taxonomy
      type: constrains
    - target: df-taxonomy
      type: constrains
    - target: observability-taxonomy
      type: constrains
    - target: pm-taxonomy
      type: constrains
---

# Meta-Taxonomy — taxonomy 분류군

## 목적 ^purpose

taxonomy 자체를 분류하는 상위 체계를 정의한다. 각 taxonomy가 제공하는 기능의 본질에 따라 분류군(family)을 부여하고, taxonomy 간 관계의 성격을 명시한다.

## 배경 ^overview

qa-sdk에는 5개의 taxonomy 패밀리가 있다(`taxonomy-boundaries` 참조). 각 taxonomy는 독립적으로 완전한 분류 체계이며, 자체 관점·계층·목표를 갖는다. 그러나 "이 taxonomy들이 서로 어떤 관계인가"를 답하는 체계는 없었다.

온톨로지에서 개념 간 관계가 개체의 의미를 결정하듯, taxonomy 간 연결이 문서의 의미를 특정 관점·계층에 안정적으로 고정시킨다. meta-taxonomy는 이 연결의 규칙을 정한다.

## 핵심 개념 ^defines

### taxonomy 분류군 (TaxonomyFamily)

taxonomy가 제공하는 기능의 본질에 따른 분류.

| 분류군 | 식별자 | 자체 좌표계 | 타 좌표계 연결 | 역할 |
|--------|--------|:---------:|:------------:|------|
| 위상 좌표계 | `topological` | O | — | 대상의 위치를 정의한다 |
| 기능 부여 | `functional` | — | — | 대상에 역할·기능을 부여한다 |
| 브릿지 | `bridge` | O | O | 자체 좌표계로 타 좌표계의 의도를 보존한다 |

### 분류 기준

1. **자체 좌표계 보유 여부**: taxonomy가 독자적인 주소 공간을 갖는가
2. **타 좌표계 연결 여부**: 다른 taxonomy의 좌표계와 명시적 연결점이 있는가

이 두 기준의 조합으로 분류군이 결정된다:
- 좌표계 O + 연결 X → `topological`
- 좌표계 X + 연결 X → `functional`
- 좌표계 O + 연결 O → `bridge`

### 기존 taxonomy 배치

| taxonomy | 분류군 | 자체 좌표계 | 연결 대상 | 1차 질문 |
|----------|--------|-----------|----------|---------|
| definition-taxonomy | `topological` | scope × aspect × depth × seq | — | 어떤 인지 관점으로 읽고 기록할 것인가 |
| structural-taxonomy | `topological` | facet, boundary, runtime scope | — | 실제로 어떤 단위가 존재하고 어떻게 배열되는가 |
| observability-taxonomy | `functional` | — | — | 무엇을 어떤 층위에서 관측하는가 |
| PM-taxonomy | `functional` | — | — | 무엇을 누가 언제 끝내는가 |
| decision-flow taxonomy | `bridge` | DecisionUnit, Evidence, verdict | definition-taxonomy | 왜 이런 판단을 했는가 |

### taxonomy 등록 메타데이터 (TaxonomyMeta)

taxonomy를 meta-taxonomy에 등록할 때 필요한 정보:

- **id**: taxonomy 고유 식별자
- **name**: 사람이 읽는 이름
- **family**: 분류군 (`topological` | `functional` | `bridge`)
- **primaryQuestion**: 이 taxonomy가 답하는 1차 질문
- **ownedConcepts**: 이 taxonomy가 소유하는 개념 목록
- **coordinateAxes**: 자체 좌표계의 축 목록 (topological, bridge만 해당)
- **bridgeTarget**: 연결 대상 taxonomy id (bridge만 해당)
- **bridgeRole**: 연결의 역할 설명 (bridge만 해당)

## 규칙 ^constraint

### 분류군 규칙

1. 모든 taxonomy는 정확히 하나의 분류군에 속한다.
2. `topological` taxonomy는 자체 좌표계를 반드시 명시해야 한다.
3. `functional` taxonomy는 좌표계를 소유하지 않는다. 좌표가 필요하면 `topological`이나 `bridge`로 재분류한다.
4. `bridge` taxonomy는 자체 좌표계와 연결 대상 taxonomy를 모두 명시해야 한다.

### 교차 규칙

5. 문서 주소 계약(document addressing contract)은 `topological` taxonomy들의 교차점으로 구성된다.
6. `functional` taxonomy는 교차점 위에 역할·기능을 부여한다. 교차점 자체를 정의하지 않는다.
7. `bridge` taxonomy는 교차점 간 의도를 보존한다. 교차점 자체를 변경하지 않는다.

### 독립성 규칙

8. 각 taxonomy는 자체 1차 질문만 답한다 (`taxonomy-boundaries` 경계 규칙 계승).
9. taxonomy 내부의 하위 기능들은 독립적으로 완성도를 유지한다.
10. 다른 taxonomy의 개념을 재사용할 수 있지만, 1차 질문까지 흡수해서는 안 된다.

## 관계 ^consumes

- `taxonomy-boundaries`의 5개 taxonomy 패밀리를 분류 대상으로 한다.
- 각 taxonomy의 1차 질문과 소유 개념은 `taxonomy-boundaries`에서 가져온다.
- `document-addressing-contract`은 이 분류를 전제로 주소 계약을 설계한다.

## 확장 규칙

새 taxonomy를 추가할 때:

1. 1차 질문을 정의한다.
2. 자체 좌표계 보유 여부를 판단한다.
3. 타 좌표계 연결 여부를 판단한다.
4. 분류군을 결정한다.
5. `TaxonomyMeta` 형식으로 등록한다.
6. `taxonomy-boundaries`에 경계 규칙을 추가한다.
