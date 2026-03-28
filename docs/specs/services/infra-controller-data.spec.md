---
def:
  id: infra-controller-data
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: approved
  layer: operation
  svc: infra-controller
  tags: [tier-infra]
  links:
    - target: infra-controller-spec
      type: refines
---
# Infra Controller — data/system_data

## 목적 ^purpose

인프라 운영 데이터. 배포 이벤트, 헬스 체크, 파이프라인 메트릭.
