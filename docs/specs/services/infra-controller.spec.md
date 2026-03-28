---
def:
  id: infra-controller-spec
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: operation
  svc: infra-controller
  tags: [tier-infra]
  links:
    - target: system-infra
      type: refines
    - target: infra-controller-api
      type: contains
    - target: infra-controller-data
      type: contains
---
# Infra Controller

## 목적 ^purpose

인프라 운영 자동화 컨트롤러. deploy_event, health_event, pipeline_point 등 10개 prefix를 소유하여 배포/헬스/파이프라인/패턴 감지 이벤트를 생산한다. DevOps 팀이 관리한다.
