---
def:
  id: dashboard-service-spec
  level: module
  tier: system
  address: def_document:v2:1024
  scope: ui
  aspect: component
  depth: overview
  lifecycle: approved
  layer: experience
  svc: dashboard
  tags: [external]
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

## 구성 ^overview

Dashboard의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
