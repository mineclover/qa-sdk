---
def:
  id: observation-prefix-group
  tier: system
  scope: data
  aspect: prefix_schema
  depth: overview
  lifecycle: approved
  tags: [structural, entry-point, generated, cross-scope]
  links:
    - target: prefix-page_view
      type: contains
    - target: prefix-endpoint
      type: contains
    - target: prefix-flow_point
      type: contains
    - target: prefix-schema_validation
      type: contains
    - target: prefix-pipeline_point
      type: contains
    - target: prefix-data_policy
      type: contains
    - target: prefix-pattern_match
      type: contains
    - target: prefix-pattern_anomaly
      type: contains
    - target: prefix-version_point
      type: contains
    - target: prefix-gate_point
      type: contains
    - target: prefix-ingest_record
      type: contains
    - target: prefix-event_classification
      type: contains
    - target: prefix-metric_point
      type: contains
    - target: prefix-version_state
      type: contains
    - target: prefix-metric_aggregate
      type: contains
    - target: prefix-resource_lifecycle
      type: contains
    - target: prefix-test_coverage
      type: contains
    - target: prefix-cli_tracking
      type: contains
    - target: prefix-tag_lifecycle
      type: contains
    - target: prefix-decision_path
      type: contains
    - target: prefix-model_apply
      type: contains
    - target: prefix-harness_transition
      type: contains
    - target: prefix-harness_guard
      type: contains
    - target: prefix-harness_process_step
      type: contains
    - target: prefix-quality_event
      type: contains
    - target: prefix-task_event
      type: contains
    - target: prefix-sdk_lifecycle
      type: contains
    - target: prefix-rpc_event
      type: contains
    - target: prefix-gate_execution
      type: contains
    - target: prefix-bundle_observation
      type: contains
    - target: prefix-transition_event
      type: contains
    - target: prefix-convergence_event
      type: contains
    - target: prefix-graph_event
      type: contains
    - target: prefix-service
      type: depends_on
---

## 목적 ^purpose

화면/엔드포인트/흐름 관측 prefix
category: observation에 해당하는 prefix를 모아 관리한다.

## 구성 ^overview

- `page_view`
- `endpoint`
- `flow_point`
- `schema_validation`
- `pipeline_point`
- `data_policy`
- `pattern_match`
- `pattern_anomaly`
- `version_point`
- `gate_point`
- `ingest_record`
- `event_classification`
- `metric_point`
- `version_state`
- `metric_aggregate`
- `resource_lifecycle`
- `test_coverage`
- `cli_tracking`
- `tag_lifecycle`
- `decision_path`
- `model_apply`
- `harness_transition`
- `harness_guard`
- `harness_process_step`
- `quality_event`
- `task_event`
- `sdk_lifecycle`
- `rpc_event`
- `gate_execution`
- `bundle_observation`
- `transition_event`
- `convergence_event`
- `graph_event`
