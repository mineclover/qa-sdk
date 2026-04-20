---
def:
  id: service-release-manifest
  tier: component
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
    - target: meta-semantic-event-standard
      type: depends_on
---
# ServiceReleaseManifest

## 목적 ^purpose

child component version과 prefix pin을 묶는 release artifact를 정의해 runtime bootstrap, deploy pipeline, CloudEvents consumer가 같은 binding을 참조하게 한다.

## ^defines

- manifest는 `runtimeAddressVersion`, `serviceUnitVersion`, `ownershipVersion`, `exposureVersion`, `deploymentVersion`, `prefixes`를 pin한다.
- child component snapshot을 full copy하지 않고 필요한 version ref와 runtime snapshot만 저장한다.
- manifest lifecycle은 `draft -> published -> active -> superseded -> archived`다.
- CloudEvents 발행 시 `qasdk_manifestversion`에는 emit 시점의 `active` manifest version만 실린다. `draft`/`published`이지만 inactive인 manifest version은 외부 이벤트에 사용하지 않는다.
- CloudEvents 소비자는 `source(service)` + `qasdk_manifestversion`으로 manifest를 조회해 pinned child/prefix version을 복원한다.
- `qasdk_manifestversion`이 없는 이벤트는 legacy/unbound event로 취급하고, 현재 active manifest를 역추론하지 않는다.
- `superseded` manifest도 과거 이벤트 decode/replay와 cleanup 근거를 위해 조회 가능해야 한다.

## ^consumes

- `packages/pipe-store-sqlite/src/manifest-store.ts`
- `packages/registry-service/src/modules/manifests/manifest.service.ts`
- `packages/core/src/standards/cloud-events.ts`
