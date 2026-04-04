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
# ServiceUnitSpec — 잔여 구현 항목

## 목적 ^purpose

서비스를 하나의 논리 단위로 식별하는 최소 정의를 고정한다. 주소, ownership, 노출 정책, 배포 결과와 섞지 않고 서비스 그 자체에 해당하는 필드만 다룬다.

## 구현 항목

- [ ] `ServiceRecord`에서 `serviceId`, `namespace`, `name`, `tier`, `team`, `applicationId`, `attributes`만 남기는 경계를 확정한다.
- [ ] `serviceId`와 `namespace/name`의 역할 차이를 타입과 문서로 구분한다.
- [ ] `ServiceUnitSpec` 단독 조회 API 요구사항을 정리한다.
- [ ] unit spec 변경이 `serviceUnitVersion` 증가로 이어지는 규칙을 정한다.
