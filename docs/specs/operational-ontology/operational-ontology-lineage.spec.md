---
def:
  id: operational-ontology-lineage
  type: knowledge
  knowledge_kind: concept
  scope: data
  aspect: relation
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-data-facets
      type: depends_on
    - target: operational-ontology-information-transmission
      type: depends_on
    - target: meta-semantic-ir
      type: depends_on
---

# Operational Ontology Lineage — 데이터 계보 추적을 해석층으로 다루기

## 목적 ^purpose

데이터 계보 추적을 `operational-ontology`의 핵심 runtime 개념으로 정의한다. 목표는 계보를 단순 파생 정보가 아니라, 어떤 정보 facet이 어떤 다른 facet들로부터 어떤 변환을 통해 형성되었는지 기록하는 first-class semantics로 다루는 것이다.

## 구성 ^overview

계보 추적은 아래 요소를 가진다.

- `target facet`
- `source facets`
- `transform kind`
- `expression`
- `transmission ref`

이 구조는 meta-semantic의 `FieldLineage`와 같은 방향이지만, operational ontology에서는 field 수준보다 먼저 **정보 facet 사이의 계보**를 본다. [data-schema.ts](/Users/junwoobang/workflow/qa-sdk/packages/core/src/types/data-schema.ts#L46)

## 정의 ^defines

### lineage의 역할

lineage는 아래 질문에 답한다.

- 이 정보는 어디서 왔는가
- 어떤 입력들이 여기에 기여했는가
- 어떤 변환이 수행되었는가
- 어느 transmission을 통해 전달되었는가

### 최소 transform kind

초기 transform kind는 다음을 기준으로 둔다.

- `direct`
- `rename`
- `compute`
- `aggregate`
- `lookup`
- `derive`
- `concat`
- `split`
- `filter`
- `cast`

### 우선순위

현재 단계에서는 field-level 정밀도보다:

1. 어떤 facet이 어떤 facet의 계보를 가지는지
2. transmission과 lineage를 어떻게 연결할지
3. simulation 결과와 lineage를 어떻게 비교할지

를 먼저 고정하는 것이 중요하다.
