---
def:
  id: dashboard-data
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: approved
  layer: operation
  svc: dashboard
  tags: [tier-infra]
  links:
    - target: dashboard-service-spec
      type: refines
---
# Dashboard — data/system_data

## 목적 ^purpose

대시보드 시각화 데이터. DKG 노드 통계, 관측 이벤트 캐시.
