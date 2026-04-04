---
def:
  id: service-release-manifest
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  links:
    - target: realization-service-control-plane
      type: refines
    - target: runtime-service-address
      type: depends_on
    - target: deployment-binding
      type: depends_on
---
# ServiceReleaseManifest

## 목적 ^purpose

child component version과 prefix pin을 묶는 release artifact를 정의해 runtime bootstrap, deploy pipeline, CloudEvents consumer가 같은 binding을 참조하게 한다.

## ^defines

- manifest는 `runtimeAddressVersion`, `serviceUnitVersion`, `ownershipVersion`, `exposureVersion`, `deploymentVersion`, `prefixes`를 pin한다.
- child component snapshot을 full copy하지 않고 필요한 version ref와 runtime snapshot만 저장한다.
- manifest lifecycle은 `draft -> published -> active -> superseded -> archived`다.

## ^consumes

- `packages/pipe-store-sqlite/src/manifest-store.ts`
- `packages/registry-service/src/modules/manifests/manifest.service.ts`
- `packages/core/src/standards/cloud-events.ts`
