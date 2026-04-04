---
def:
  id: service-manifest-assembly
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  links:
    - target: realization-service-control-plane
      type: depends_on
    - target: service-release-manifest
      type: depends_on
---
# Service Manifest Assembly — 잔여 TODO

## 목적 ^purpose

이미 존재하는 child component version을 선택해 deterministic한 release manifest를 조립하는 계약과 검증 규칙을 정의한다.

## 구현 항목

- [ ] compatibility validation을 explicit quality gate/claim으로 승격한다.
- [ ] 동일 child version 조합 + 동일 prefix pin이면 동일 manifest semantics를 보장하는 규칙을 quality contract로 분리한다.
