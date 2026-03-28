---
def:
  id: event-prefix-group
  address: def_document:v1:2696
  scope: data
  aspect: prefix_schema
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [structural, entry-point, generated]
  links:
    - target: prefix-event
      type: contains
    - target: prefix-engine_event
      type: contains
    - target: prefix-schema_event
      type: contains
    - target: prefix-deploy_event
      type: contains
    - target: prefix-health_event
      type: contains
    - target: prefix-cart_event
      type: contains
    - target: prefix-auth_event
      type: contains
    - target: prefix-order_event
      type: contains
    - target: prefix-build_event
      type: contains
    - target: prefix-test_event
      type: contains
    - target: prefix-dkg_event
      type: contains
    - target: prefix-dkg_decision_event
      type: contains
    - target: prefix-dkg_observation_event
      type: contains
    - target: prefix-skill_execution
      type: contains
    - target: prefix-cli_event
      type: contains
    - target: prefix-observation_event
      type: contains
    - target: prefix-spec_event
      type: contains
    - target: prefix-edge_activity
      type: contains
    - target: prefix-validation_event
      type: contains
    - target: prefix-decision_event
      type: contains
    - target: prefix-escalation_event
      type: contains
    - target: prefix-forcing_response
      type: contains
---

## 목적 ^purpose

시스템/비즈니스 이벤트 prefix
category: event에 해당하는 prefix를 모아 관리한다.

## 구성 ^overview

- `event`
- `engine_event`
- `schema_event`
- `deploy_event`
- `health_event`
- `cart_event`
- `auth_event`
- `order_event`
- `build_event`
- `test_event`
- `dkg_event`
- `dkg_decision_event`
- `dkg_observation_event`
- `skill_execution`
- `cli_event`
- `observation_event`
- `spec_event`
- `edge_activity`
- `validation_event`
- `decision_event`
- `escalation_event`
- `forcing_response`
