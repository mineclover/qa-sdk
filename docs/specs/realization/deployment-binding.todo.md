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
# DeploymentBinding — 잔여 TODO

## 목적 ^purpose

배포 시스템이 관측한 URL, outputs, locator를 runtime overlay로 저장하는 binding을 정의하고, endpoint/read-model surface가 이를 소비하게 한다.

## 구현 항목

- [ ] `deployments/sync` write surface를 실제 external deploy tool 프로토콜과 맞춘다.
- [ ] deployment binding 변경과 manifest 재발행의 운영 정책을 문서화한다.
