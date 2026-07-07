---
def:
  id: service-manifest-validation
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  links:
    - target: service-manifest-assembly
      type: refines
    - target: service-release-manifest
      type: depends_on
sources:
  - packages/registry-service/src/modules/manifests/manifest-assembly.ts
  - packages/registry-service/src/modules/manifests/manifest-assembly.test.ts
  - packages/registry-service/src/modules/manifests/manifest.service.ts
  - packages/registry-service/src/modules/manifests/manifest.controller.ts
  - packages/registry-service/src/modules/manifests/manifest.controller.test.ts
---
# Service Manifest Validation

## 목적 ^purpose

manifest를 조립하기 전에 어떤 조건을 검증해야 하는지와, 동일 입력이 동일 의미를 보장하는 deterministic contract를 고정한다.

## ^defines

- assembly gate: referenced child component는 반드시 `published`
- validation surface: `POST /manifests/validate`
- validation 결과는 `manifest-assembly-compatibility` gate verdict와 `diagnostics[]`, deterministic `contract.semanticsKey`를 반환한다.
- ownership validation은 `ownedPrefixes ⊆ manifest.prefixes`를 강제한다.
- 동일 child version 조합 + 동일 prefix pin + 동일 inline runtime snapshot이면 동일 `contract.semanticsKey`를 반환한다.
- `POST /manifests/assemble`는 `validate`와 같은 입력 계약을 쓰고, gate를 통과한 경우에만 manifest draft를 생성한다.

## ^consumes

- `packages/registry-service/src/modules/manifests/manifest-assembly.ts`
- `packages/registry-service/src/modules/manifests/manifest.service.ts`
- `packages/registry-service/src/modules/manifests/manifest.controller.ts`
