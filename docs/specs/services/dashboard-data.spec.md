---
def:
  tier: component
  id: dashboard-data
  address: def_document:v2:343041
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: approved
  layer: operation
  svc: dashboard
  tags: [external]
  links:
    - target: dashboard-service-spec
      type: refines
---
# Dashboard — data/system_data

## 목적 ^purpose

대시보드 시각화 데이터. DKG 노드 통계, 관측 이벤트 캐시.

## 구성 ^overview

Dashboard — data/system_data의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
