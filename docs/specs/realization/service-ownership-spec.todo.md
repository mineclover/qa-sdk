---
def:
  id: service-ownership-spec
  level: leaf
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: draft
  layer: domain
  links:
    - target: realization-service-control-plane
      type: depends_on
    - target: dkg-service-topology
      type: depends_on
---
# ServiceOwnershipSpec — 잔여 구현 항목

## 목적 ^purpose

서비스가 어떤 prefix를 생산하고 소비하는지 독립 spec으로 분리해 topology, 영향 분석, release pin 검증의 기준점을 제공한다.

## 구현 항목

- [x] `ownedPrefixes`와 `consumedPrefixes`를 `ServiceOwnershipSpec`으로 분리한다.
- [ ] ownership spec과 DKG topology 질의의 연결 지점을 정한다.
- [ ] manifest `prefixes`가 ownership spec과 어떻게 정합되는지 규칙을 정한다.
- [ ] ownership 변경이 `ownershipVersion` 증가로 이어지는 규칙을 정한다.
