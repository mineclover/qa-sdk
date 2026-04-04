---
def:
  id: service-unit-spec
  level: leaf
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: realization-service-control-plane
      type: refines
---
# ServiceUnitSpec

## 목적 ^purpose

서비스를 하나의 논리 단위로 식별하는 최소 정의를 고정한다. 주소, ownership, 노출 정책, 배포 결과와 섞지 않고 서비스 그 자체에 해당하는 필드만 다룬다.

## ^defines

- `ServiceUnitSpec = serviceId + namespace + name + tier + team + applicationId + attributes`
- `ServiceRecord`에서 서비스 논리 단위에 해당하는 필드를 분리한 child component다.
- `serviceId`는 stable join key이고 `namespace/name`은 runtime address projection 입력이다.

## ^consumes

- `packages/registry-service/src/modules/services/service.types.ts`
- `packages/registry-service/src/modules/services/service-control-plane.ts`
- `packages/registry-service/src/modules/services/service-component.service.ts`
