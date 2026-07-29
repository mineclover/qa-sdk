---
def:
  id: context-bounded-execution-test-stop-rules
  type: spec
  tier: component
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  family_id: docs/specs/system/context-bounded-execution
  tags: [testing, architecture, context]
  links:
    - target: context-bounded-execution-test
      type: refines
    - target: context-bounded-execution-cases-stop-rules
      type: traces_to
sources:
  - packages/context-runtime/src/stop-rules.test.ts
  - packages/context-runtime/src/working-context.test.ts
  - packages/context-runtime/src/stop-rules.ts:validateStopPolicy
  - packages/context-runtime/src/stop-rules.ts:evaluateStopDecision
  - packages/context-runtime/src/discovery.ts:planDiscovery
  - packages/context-runtime/src/working-context.ts:compileWorkingContext
---
# Context-Bounded Execution — Stop Rules 검증

## 목적 ^purpose

StopPolicy의 coverage·no-progress·source-exhausted·hard-cap precedence 계약의 test unit과 implementation unit을 관리한다.

## 검증 계약 ^defines

```yaml bdd
test_units:
  - id: TU-context-runtime-stop-on-coverage
    contract: context-runtime.discovery.stop-on-coverage.v1
    level: unit
    assertions:
      [then.returns.stop.reason, then.returns.stop.action, then.invariants.no_additional_route_expansion]
    test_file: packages/context-runtime/src/stop-rules.test.ts

  - id: TU-context-runtime-stop-on-no-progress
    contract: context-runtime.discovery.stop-on-no-progress.v1
    level: unit
    assertions:
      [then.returns.stop.reason, then.returns.stop.progress, then.invariants.no_unbounded_expansion]
    test_file: packages/context-runtime/src/stop-rules.test.ts

  - id: TU-context-runtime-evaluate-source-exhausted
    contract: context-runtime.discovery.evaluate-source-exhausted.v1
    level: unit
    assertions:
      [then.returns.stop.reason, then.returns.stop.action, then.returns.stop.unresolved_obligations]
    test_file: packages/context-runtime/src/stop-rules.test.ts

  - id: TU-context-runtime-working-stop-on-source-exhausted
    contract: context-runtime.working.stop-on-source-exhausted.v1
    level: unit
    assertions:
      [then.returns.stop.reason, then.returns.working_context.status, then.invariants.no_manifest_created]
    test_file: packages/context-runtime/src/working-context.test.ts

  - id: TU-context-runtime-stop-hard-cap-precedence
    contract: context-runtime.stop.hard-cap-precedence.v1
    level: unit
    assertions:
      [then.returns.stop.reason, then.returns.stop.action, then.invariants.hard_cap_cannot_be_overridden_by_coverage]
    test_file: packages/context-runtime/src/stop-rules.test.ts

implementation_units:
  - id: IU-context-runtime-stop-policy-validator
    contract: context-runtime.discovery.stop-on-coverage.v1
    unit_kind: guard
    owned_by: context-runtime
    source_target: packages/context-runtime/src/stop-rules.ts:validateStopPolicy
    effects: [stop.policy_validated]

  - id: IU-context-runtime-stop-decision-evaluator
    contract: context-runtime.discovery.stop-on-coverage.v1
    unit_kind: operation
    owned_by: context-runtime
    source_target: packages/context-runtime/src/stop-rules.ts:evaluateStopDecision
    effects: [stop.decision, stop.reason, stop.progress]

  - id: IU-context-runtime-no-progress-evaluator
    contract: context-runtime.discovery.stop-on-no-progress.v1
    unit_kind: guard
    owned_by: context-runtime
    source_target: packages/context-runtime/src/stop-rules.ts:evaluateStopDecision
    effects: [stop.no_progress, stop.unresolved_obligations]

  - id: IU-context-runtime-discovery-stop-integration
    contract: context-runtime.stop.hard-cap-precedence.v1
    unit_kind: operation
    owned_by: context-runtime
    source_target: packages/context-runtime/src/discovery.ts:planDiscovery
    effects: [discovery.stop, discovery.no_unbounded_expansion]

  - id: IU-context-runtime-source-exhausted-evaluator
    contract: context-runtime.discovery.evaluate-source-exhausted.v1
    unit_kind: guard
    owned_by: context-runtime
    source_target: packages/context-runtime/src/stop-rules.ts:evaluateStopDecision
    effects: [stop.source_exhausted, stop.unresolved_obligations]

  - id: IU-context-runtime-working-stop-guard
    contract: context-runtime.working.stop-on-source-exhausted.v1
    unit_kind: guard
    owned_by: context-runtime
    source_target: packages/context-runtime/src/working-context.ts:compileWorkingContext
    effects: [working.blocked, manifest.suppressed]
```
