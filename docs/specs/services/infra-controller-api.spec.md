---
def:
  id: infra-controller-api
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: operation
  svc: infra-controller
  tags: [tier-infra]
  links:
    - target: infra-controller-spec
      type: refines
---
# Infra Controller — interface/api_contract

## 목적 ^purpose

인프라 컨트롤러 API. 배포 트리거, 헬스 보고, 패턴 감지 결과 조회.
