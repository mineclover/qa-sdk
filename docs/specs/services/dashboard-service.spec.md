---
def:
  id: dashboard-service-spec
  scope: ui
  aspect: component
  depth: overview
  lifecycle: approved
  layer: experience
  svc: dashboard
  tags: [tier-infra]
  links:
    - target: registry-service-modules
      type: depends_on
    - target: dashboard-data
      type: contains
    - target: dashboard-features
      type: contains
---
# Dashboard

## 목적 ^purpose

registry-service의 개발용 대시보드. DKG 노드 요약, 흐름 맵, 메트릭 집계, 의사결정/관측 타임라인을 시각화한다. /dev 경로에서 제공된다.
