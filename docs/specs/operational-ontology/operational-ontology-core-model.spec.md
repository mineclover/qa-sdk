---
def:
  tier: component
  id: operational-ontology-core-model
  type: spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [structural, cross-scope]
  links:
    - target: operational-ontology-taxonomy-schema
      type: traces_to
    - target: dual-coordinate-system
      type: traces_to
    - target: taxonomy-boundaries
      type: traces_to
  sources:
    - packages/operational-ontology/src/internal/runtime-core.ts
    - packages/operational-ontology/src/runtime.ts
    - packages/operational-ontology/src/facades.test.ts
---

# Operational Ontology Core Model — canonical identity와 anchor 좌표

## 목적 ^purpose

operational ontology에서 정보의 최소 안정 identity를 어떻게 결정할지 정의한다. 핵심은 schema plane에서 정의된 taxonomy의 교차점이 identity를 형성하되, 경로나 읽기 목적까지 즉시 canonical identity로 흡수하지 않고 anchor와 derived coordinate를 분리하는 것이다.

## 구성 ^overview

핵심 모델은 세 층으로 나뉜다.

- **anchor** — 같은 대상을 가리키는 최소 안정 참조점
- **taxonomy intersection** — anchor 위에서 정보 identity를 더 정밀하게 결정하는 교차점
- **canonical key** — 정규화된 string/encoded address 형태의 식별자

NodeCoord는 아래 속성으로 구성한다.

- `realm` — 규칙이 적용되는 상위 경계
- `space` — 어떤 의미 공간에서 읽는가
- `anchor` — 동일 대상을 유지시키는 최소 identity
- `taxonomies` — anchor 위에 얹는 taxonomy 교차 결과
- `canonicalKey` — 정렬/정규화된 최종 key

## 정의 ^defines

### canonical identity

canonical identity는 아래를 만족해야 한다.

1. 같은 대상이면 path가 달라도 같은 anchor를 유지한다.
2. taxonomy 교차 결과가 같으면 같은 canonicalKey를 만든다.
3. traversal 목적이나 조회 시작점은 canonical identity에 직접 포함하지 않는다.

### derived coordinate

derived coordinate는 canonical identity 위에서 파생되는 읽기/운영 좌표다.

- relation coordinate
- traversal coordinate
- observation projection
- validation projection

이 구분을 유지해야 node identity가 relation/path variation 때문에 파편화되지 않는다.
