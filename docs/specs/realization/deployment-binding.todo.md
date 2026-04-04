---
def:
  id: deployment-binding
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: draft
  layer: operation
  links:
    - target: realization-service-control-plane
      type: depends_on
    - target: deployment-address
      type: depends_on
---
# DeploymentBinding — 잔여 구현 항목

## 목적 ^purpose

배포 시스템이 관측한 URL, outputs, locator를 runtime overlay로 저장하는 binding을 정의하고, endpoint/read-model surface가 이를 소비하게 한다.

## 구현 항목

- [ ] `deploymentVersion`, `address`, `url`, `outputs`, `urn` 필드를 가진 `DeploymentBinding`을 타입으로 고정한다.
- [ ] `ServiceEndpointStore`를 deployment binding의 read model로 재정의한다.
- [ ] `deployments/sync`가 어떤 입력을 받아 binding을 갱신하는지 API 계약을 정한다.
- [ ] deployment binding 변경이 manifest 재발행을 요구하는지 여부를 규칙화한다.
