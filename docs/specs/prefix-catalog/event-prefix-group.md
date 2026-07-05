---
def:
  id: event-prefix-group
  tier: system
  scope: data
  aspect: prefix_schema
  depth: overview
  lifecycle: approved
  tags: [structural, entry-point, generated, cross-scope]
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
    - target: prefix-ir_pipe
      type: contains
    - target: prefix-service
      type: depends_on
  sources:
    - packages/definition-catalog/scripts/gen-prefix-docs.mjs
    - packages/demo-snapshot/src/demo-catalog.ts
    - packages/demo-snapshot/src/demo-catalog.test.ts
    - packages/demo-types/src/prefix-ids.ts
    - packages/demo-types/src/lifecycle.test.ts
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
- `ir_pipe`

## 검증 ^consumes

```bash
corepack pnpm --filter demo-snapshot test
corepack pnpm --filter demo-types test
node packages/cli/dist/index.js def validate
```
