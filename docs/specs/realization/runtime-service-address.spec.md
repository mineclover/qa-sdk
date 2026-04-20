---
def:
  id: runtime-service-address
  tier: component
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: realization-service-control-plane
      type: refines
---
# RuntimeServiceAddress

## 목적 ^purpose

`service` prefix와 `svc_ref` 참조의 canonical source가 되는 runtime 주소를 정의하고, `ServiceBootConfig`가 이 주소의 projection임을 고정한다.

## ^defines

- `RuntimeServiceAddress = serviceId + namespace + name + env + region`
- `ServiceBootConfig`는 `RuntimeServiceAddress`의 로컬 projection이다.
- manifest는 `runtimeAddressVersion`과 runtime address snapshot을 함께 저장한다.
- `runtimeAddressVersion`은 `namespace/name/env/region` tuple에 대한 append-only child component version이다.
- `published`된 runtime address는 제자리 수정하지 않고, tuple이 바뀌면 새 `runtimeAddressVersion`을 발행한다.
- `runtime-addresses/sync`는 runtime address를 draft로 환류하고, active manifest가 다른 `runtimeAddressVersion`을 pin하고 있으면 `manifestImpact = republish-recommended`를 반환한다.

## ^consumes

- `packages/core/src/types/service-identity.ts`
- `packages/registry-service/src/modules/services/service.types.ts`
- `packages/registry-service/src/modules/services/service-component.service.ts`
- `packages/registry-service/src/modules/services/service-component.controller.ts`
- `packages/pipe-store-sqlite/src/manifest-store.ts`
