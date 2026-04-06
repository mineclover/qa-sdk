---
def:
  id: pipeline-system
  level: module
  address: def_document:v2:137222
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  svc: ingest-server
  tags: [structural, observability, performance, entry-point]
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
    - target: task-pipeline-unit
      type: contains
    - target: indexing-pipeline
      type: contains
    - target: redis-cache-adapter
      type: contains
    - target: ingest-system
      type: depends_on
---

# 파이프라인 시스템

## 목적 ^purpose

이벤트 수집부터 비동기 재구성/판정까지의 2단계 처리 파이프라인. enrichAddressContext 미들웨어, metric aggregation, Range Query, SSE 축별 구독을 포함한다.

## 구성 ^overview

- `pipeline-phase-flow`: Phase 1(동기 저장: envelope 검증 → record 저장 → trace upsert)과 Phase 2(비동기 재구성: reconstruction → scenario verdict → 알림)의 처리 순서와 전이 조건.
- `pipeline-enrichment`: 수집된 이벤트의 address_context를 보강하는 Phase 1 미들웨어.
- `pipeline-metric-agg`: Phase 2 비동기 워커에서 metric RecordKind를 집계하는 기능.
- `pipeline-error-handling`: Phase 1/2 파이프라인의 에러 처리 정책.
- `pipeline-monitoring`: 파이프라인 자체의 관측 메트릭.
- `task-pipeline-unit`: A1 (이벤트 생성) → A5 (집계) → A6 (메트릭 저장) 경로를 구축하여 인덱싱 시스템의 packed_key 기반 운영 분석을 가능하게 한다.
- `indexing-pipeline`: entity ID ↔ PK 문자열 전체 경로를 한 곳에서 정의한다.
- `redis-cache-adapter`: KeyCache 포트의 Redis L2 구현과 decode-service/CLI cache 통합 규약.
