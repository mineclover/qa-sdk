---
def:
  id: authorization-ontology-column-lineage-policy
  type: knowledge
  knowledge_kind: concept
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [security, structural, observability]
  links:
    - target: authorization-ontology-system
      type: refines
    - target: operational-ontology-lineage
      type: depends_on
    - target: operational-ontology-persistence
      type: depends_on
---

# Authorization Ontology Column Lineage Policy — 컬럼 리니지 기반 권한 전파

## 목적 ^purpose

컬럼 레벨 데이터 리니지를 권한 정책 전파의 근거로 사용하는 방식을 정의한다. 목표는 PII/민감 컬럼이 downstream column으로 복사, 마스킹, 해시, 집계, 조인될 때 권한 정책을 상속/완화/차단/수동검토 중 하나로 안정적으로 결정하는 것이다.

## 구성 ^overview

초기 propagation mode:

- `inherit`
- `downgrade`
- `block`
- `manual_review`

초기 transform:

- `direct`
- `rename`
- `copy`
- `hash`
- `mask`
- `aggregate`
- `join`
- `filter`
- `derive`

## 정의 ^defines

테이블 레벨 리니지는 권한 전파에 충분하지 않다. 권한은 특정 컬럼의 민감도와 변환 방식에 따라 downstream으로 따라가거나 완화될 수 있기 때문이다.

예시:

- `copy`, `rename`은 대체로 원본 정책을 상속한다.
- `mask`, `hash`는 재식별 가능성에 따라 상속 또는 완화한다.
- `aggregate`는 그룹 크기와 식별 가능성에 따라 완화할 수 있다.
- `join`, `concat`은 source 정책의 union을 적용한다.
- 규칙이 없으면 `manual_review`로 둔다.
