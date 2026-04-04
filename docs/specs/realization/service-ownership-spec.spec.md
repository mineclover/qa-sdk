---
def:
  id: service-ownership-spec
  level: leaf
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: realization-service-control-plane
      type: refines
    - target: dkg-service-topology
      type: depends_on
---
# ServiceOwnershipSpec

## 목적 ^purpose

서비스가 어떤 prefix를 생산하고 소비하는지 독립 spec으로 분리해 topology, 영향 분석, release pin 검증의 기준점을 제공한다.

## ^defines

- `ServiceOwnershipSpec = serviceId + ownedPrefixes + consumedPrefixes`
- ownership은 child component version으로 관리되고, manifest는 특정 ownership version을 pin한다.
- assembly gate에서 ownership version은 `published` 상태여야 참조할 수 있다.

## ^consumes

- `packages/registry-service/src/modules/services/service.types.ts`
- `packages/registry-service/src/modules/services/service-component.service.ts`
- `packages/registry-service/src/modules/manifests/manifest.service.ts`
