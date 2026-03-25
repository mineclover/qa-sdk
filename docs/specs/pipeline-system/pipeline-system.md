---
def:
  id: pipeline-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [observability, performance, entry-point]
  links:
    - target: pipeline-phase-flow
      type: contains
    - target: pipeline-enrichment
      type: contains
    - target: pipeline-metric-agg
      type: contains
    - target: pipeline-error-handling
      type: contains
    - target: pipeline-monitoring
      type: contains
---
# 파이프라인 시스템

## 목적 ^purpose

이벤트 수집부터 비동기 재구성/판정까지의 2단계 처리 파이프라인. enrichAddressContext 미들웨어, metric aggregation, Range Query, SSE 축별 구독을 포함한다.

## 구성 ^overview

5개 정의: Phase 1/2 흐름, 주소 컨텍스트 보강, 메트릭 집계, 에러 처리, 자체 모니터링.
