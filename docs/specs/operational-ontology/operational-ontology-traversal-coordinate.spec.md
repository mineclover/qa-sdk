---
def:
  tier: component
  id: operational-ontology-traversal-coordinate
  type: knowledge
  knowledge_kind: concept
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-schema-validation
      type: depends_on
    - target: operational-ontology-core-model
      type: depends_on
    - target: operational-ontology-relation-taxonomy
      type: depends_on
    - target: operational-ontology-category-constraint
      type: depends_on
---

# Operational Ontology Traversal Coordinate — start/end/edge chain을 route identity로 다루기

## 목적 ^purpose

어디서 시작했고, 어떤 edge chain을 따라, 어디에 도달했는지를 traversal coordinate로 다루는 규칙을 정의한다. 목표는 path를 단순 query 결과가 아니라 목적 기반 route identity로 승격하되, 모든 경로를 canonical identity로 고정하지 않는 것이다. traversal 역시 승인된 TraversalSchema와 validation rule을 전제로 해야 한다.

## 구성 ^overview

TraversalCoord는 아래 요소로 구성한다.

- `purpose` — observe / implement / validate / refactor 같은 읽기 목적
- `start` — 시작 node identity
- `edges` — edge canonicalKey의 순서 있는 목록
- `end` — 도착 node identity
- `canonicalKey?` — 승인된 route family에만 부여되는 선택 속성

경로는 항상 동일한 가치를 갖지 않는다. 그래서 traversal은 두 종류로 나눈다.

- **derived traversal** — 즉석 조회나 탐색에서 생성되는 경로
- **canonical traversal** — 운영상 반복 사용되어 별도 identity를 가질 가치가 있는 경로

## 정의 ^defines

### purpose projection

같은 start/end라도 purpose가 다르면 traversal coordinate가 달라진다.

- `observe` — 영향과 관측 계약을 수집
- `implement` — 하위 구조와 구현 패턴을 수집
- `validate` — 제약, 게이트, 시나리오를 수집
- `refactor` — 의존성과 blast radius를 수집

### canonicalization 규칙

모든 traversal에 canonical key를 주지 않는다. 아래 조건을 만족할 때만 canonical traversal family로 승격한다.

1. 같은 purpose로 반복 사용된다.
2. edge chain이 안정적이다.
3. 운영/관측/검증 경로로 재사용 가치가 있다.
4. start/end anchor가 명확하다.

이 규칙이 없으면 path variation이 identity fragmentation으로 이어진다.
