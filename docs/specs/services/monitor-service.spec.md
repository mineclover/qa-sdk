---
def:
  id: monitor-service-spec
  level: module
  address: def_document:v2:1026
  scope: ui
  aspect: component
  depth: overview
  lifecycle: approved
  layer: experience
  svc: monitor
  tags: [external]
  links:
    - target: system-frontend
      type: refines
    - target: monitor-data
      type: contains
    - target: monitor-features
      type: contains
---
# Monitor

## 목적 ^purpose

실시간 이벤트 모니터링 프론트엔드. ingest-server로부터 수집된 이벤트를 시각화하고, 세션/트레이스 단위로 탐색할 수 있는 대시보드를 제공한다.

## 구성 ^overview

Monitor의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
