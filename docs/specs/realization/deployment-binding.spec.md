---
def:
  id: deployment-binding
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  links:
    - target: realization-service-control-plane
      type: refines
    - target: deployment-address
      type: depends_on
---
# DeploymentBinding

## 목적 ^purpose

배포 시스템이 관측한 URL, outputs, locator를 runtime overlay로 저장하는 binding을 정의하고, endpoint/read-model surface가 이를 소비하게 한다.

## ^defines

- `DeploymentBinding = deploymentVersion + DeploymentAddress + url? + outputs? + urn? + observedAt`
- child component lifecycle을 가지며, `published` 상태만 새 assembly 후보에 포함된다.
- manifest가 `deploymentVersion`을 pin하지 않으면 runtime resolve는 binding을 자동 선택하지 않는다.

## ^consumes

- `packages/registry-service/src/stores/service-component-version-store.ts`
- `packages/registry-service/src/modules/services/service-component.service.ts`
- `packages/registry-service/src/modules/resolve/resolve.service.ts`
