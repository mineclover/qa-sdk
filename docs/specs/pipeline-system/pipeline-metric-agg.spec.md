---
def:
  id: pipeline-metric-agg
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [observability]
  links:
    - target: metrics-spec
      type: depends_on
---
# 메트릭 집계 (Phase 2)

## 목적 ^purpose

Phase 2 비동기 워커에서 metric RecordKind를 집계하는 기능. 시간 윈도우 기반 롤업, prefix별 카운트/합계/평균 계산.
