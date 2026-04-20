---
def:
  id: conventions-system
  type: knowledge
  knowledge_kind: convention
  level: module
  tier: system
  address: def_document:v2:273409
  scope: constraint
  aspect: tech_constraint
  depth: overview
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [structural]
  links:
    - target: conv-naming
      type: contains
    - target: conv-reserved-entries
      type: contains
    - target: conv-acceleration
      type: contains
    - target: index-meta-system
      type: constrains
    - target: wi-system
      type: constrains
---

# conventions-system

## 목적 ^purpose

좌표 시스템의 ID 네이밍, 예약 항목, 가속 지향 설계 등 핵심 컨벤션.

좌표 시스템의 ID 네이밍, 예약 항목, 가속 지향 설계 등 핵심 컨벤션.

## 구성 문서

| 문서 | id | 설명 |
|------|-----|------|
| [conv-naming.spec.md](conv-naming.spec.md) | conv-naming | 축/entry/prefix ID의 네이밍 제약 |
| [conv-reserved-entries.spec.md](conv-reserved-entries.spec.md) | conv-reserved-entries | Reserved Entry 규칙 |
| [conv-acceleration.spec.md](conv-acceleration.spec.md) | conv-acceleration | 가속 지향 설계 규칙 |

## 구성 ^overview

- `conv-naming`: 축/entry/prefix ID의 네이밍 제약.
- `conv-reserved-entries`: Reserved Entry 규칙.
- `conv-acceleration`: 가속 지향 설계 규칙.

`weighted-index`와 `index-meta`를 사용하는 프로젝트에서 따라야 하는 규칙.
기반 원리는 `foundation.md`, 사용 패턴은 `patterns.md`를 참조한다.

## 원본

분할 전 원본: `docs/specs/indexing/conventions.md` (indexing-conventions)
