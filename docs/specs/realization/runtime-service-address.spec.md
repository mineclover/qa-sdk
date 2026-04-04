---
def:
  id: runtime-service-address
  level: leaf
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

## ^consumes

- `packages/core/src/types/service-identity.ts`
- `packages/registry-service/src/modules/services/service.types.ts`
- `packages/pipe-store-sqlite/src/manifest-store.ts`
