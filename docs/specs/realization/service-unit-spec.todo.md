---
def:
  id: service-unit-spec
  level: leaf
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: draft
  layer: domain
  links:
    - target: realization-service-control-plane
      type: depends_on
---
# ServiceUnitSpec — 잔여 TODO

## 목적 ^purpose

서비스를 하나의 논리 단위로 식별하는 최소 정의를 고정한다. 주소, ownership, 노출 정책, 배포 결과와 섞지 않고 서비스 그 자체에 해당하는 필드만 다룬다.

## 구현 항목

- [ ] `serviceUnitVersion` 자동 bump 또는 운영 규칙을 별도 문서로 고정한다.
