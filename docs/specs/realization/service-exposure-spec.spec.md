---
def:
  id: service-exposure-spec
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  links:
    - target: realization-service-control-plane
      type: refines
    - target: registry-services-module
      type: depends_on
---
# ServiceExposureSpec

## 목적 ^purpose

gateway path, strip rule 같은 노출 정책을 서비스 논리 정의와 분리하여 routing/read-model surface가 독립적으로 소비할 수 있게 한다.

## ^defines

- `ServiceExposureSpec = serviceId + gatewayPath? + stripPrefix?`
- URL은 exposure가 아니라 deployment binding 또는 endpoint read model의 책임이다.
- deprecated exposure는 active manifest에 남을 수 있지만 새 assembly 후보에서는 제외된다.

## ^consumes

- `packages/registry-service/src/modules/services/service.types.ts`
- `packages/registry-service/src/modules/services/service-component.service.ts`
- `packages/registry-service/src/modules/resolve/resolve.service.ts`
