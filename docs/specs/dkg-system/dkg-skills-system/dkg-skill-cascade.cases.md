---
def:
  id: dkg-skill-cascade-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [scenario, dkg, ownership, decision, failure]
  links:
    - target: dkg-skill-cascade
      type: refines
sources:
  - packages/dkg/src/skills/dsl-ownership-review.ts
  - packages/dkg/src/skills/dsl-ownership-review.test.ts
  - packages/cli/src/commands/dkg.ts
  - packages/cli/src/commands/dkg.e2e.test.ts
---
# DSL ownership decision — 검토 결과 기록 계약

## 목적 ^purpose

`skill-dsl-ownership-audit`가 산출한 pending unit을 사람이 source/consumer/flow/rationale 근거와 함께 DecisionNode로 기록하는 입력 계약. 이 계약은 DSL 소유권을 자동 추론하거나 observation을 자동 해소하지 않는다.

## BDD 계약 ^overview

```yaml bdd
bdd_contracts:
  - id: dsl-ownership.pending.record.incomplete-evidence.v1
    owner_system: dkg-system
    contract_kind: validation-failure
    mode: write
    links:
      spec: dkg-skill-cascade
    given:
      state_component: dsl-ownership-review-unit
      state: pending
      predicates: [target-prefix-is-pending, evidence-is-complete]
      fixtures: [bootstrap-graph-with-obs-dsl-uncovered]
    when:
      actor: human-reviewer
      operation: dkg.dsl-ownership.decide
    then:
      error:
        code: incomplete-evidence
      invariants: [no-decision-node-is-written, observation-remains-open]

  - id: dsl-ownership.pending.record.assign.v1
    owner_system: dkg-system
    contract_kind: dependency-contract
    mode: write
    links:
      spec: dkg-skill-cascade
    given:
      state_component: dsl-ownership-review-unit
      state: pending
      predicates: [target-prefix-is-pending, dsl-bundle-exists, evidence-is-complete]
      fixtures: [bootstrap-graph-with-valid-dsl-bundle]
    when:
      actor: human-reviewer
      operation: dkg.dsl-ownership.decide
    then:
      state: decided
      returns:
        verdict: ok
        choice: assign
      egress:
        - axis: dkg.decision-node
          value: written
        - axis: dkg.governs-edge
          value: written
        - axis: dkg.prompts-edge
          value: written
      invariants: [decision-metadata-preserves-evidence, observation-remains-open]

  - id: dsl-ownership.pending.record.independent.v1
    owner_system: dkg-system
    contract_kind: dependency-contract
    mode: write
    links:
      spec: dkg-skill-cascade
    given:
      state_component: dsl-ownership-review-unit
      state: pending
      predicates: [target-prefix-is-pending, dsl-bundle-is-absent, evidence-is-complete]
      fixtures: [bootstrap-graph-with-unowned-prefix]
    when:
      actor: human-reviewer
      operation: dkg.dsl-ownership.decide
    then:
      state: decided
      returns:
        verdict: ok
        choice: independent
      egress:
        - axis: dkg.decision-node
          value: written
        - axis: dkg.governs-edge
          value: written
        - axis: dkg.prompts-edge
          value: written
      invariants: [owner-dsl-is-empty, rationale-and-evidence-are-preserved, observation-remains-open]

  - id: dkg.self-check.observation-reason.output.v1
    owner_system: dkg-system
    contract_kind: query-projection
    mode: read
    links:
      spec: dkg-skill-cascade
    given:
      state_component: self-check-observation-state
      state: recovered-and-retained-issues
      predicates: [recovery-evidence-classified, metric-issue-present]
      fixtures: [isolated-home-with-bootstrap-observations]
    when:
      actor: operator
      operation: dkg.self-check
    then:
      state: reported
      returns:
        recovered_reason: printed-per-observation
        retained_reason: printed-per-metric-issue
      invariants: [dry-run-does-not-mutate, retained-issue-is-not-auto-resolved]

test_units:
  - id: TU-dsl-ownership-incomplete-evidence
    contract: dsl-ownership.pending.record.incomplete-evidence.v1
    level: unit
    given_fixture: bootstrap-graph-with-obs-dsl-uncovered
    when: recordDslOwnershipDecision() with missing evidence
    assertions: [then.error, no-decision-node, pending-audit-unit-unchanged]
    test_file: packages/dkg/src/skills/dsl-ownership-review.test.ts
  - id: TU-dsl-ownership-assign
    contract: dsl-ownership.pending.record.assign.v1
    level: integration
    given_fixture: bootstrap-graph-with-valid-dsl-bundle
    when: dkg dsl-ownership decide --choice assign
    assertions: [then.returns, then.egress, pending-count-decreases]
    test_file: packages/cli/src/commands/dkg.e2e.test.ts
  - id: TU-dsl-ownership-independent
    contract: dsl-ownership.pending.record.independent.v1
    level: unit
    given_fixture: bootstrap-graph-with-unowned-prefix
    when: recordDslOwnershipDecision() with choice=independent
    assertions: [then.returns, owner-dsl-is-empty, pending-count-decreases]
    test_file: packages/dkg/src/skills/dsl-ownership-review.test.ts
  - id: TU-dkg-self-check-observation-reason
    contract: dkg.self-check.observation-reason.output.v1
    level: integration
    given_fixture: isolated-home-with-bootstrap-observations
    when: dkg self-check --fast
    assertions: [recovered-reason-or-retained-reason, no-persistence-in-dry-run]
    test_file: packages/cli/src/commands/dkg.e2e.test.ts

implementation_units:
  - id: IU-record-dsl-ownership-decision
    contract: dsl-ownership.pending.record.incomplete-evidence.v1
    unit_kind: operation
    owned_by: dkg-system
    source_target: packages/dkg/src/skills/dsl-ownership-review.ts
    inputs: [pending-prefix, choice, owner-references, source-consumer-flow-evidence, rationale]
    effects: [validated-decision-node, governs-edge, prompts-edge]
    must_not_own: [dsl-inference, runtime-evidence-collection, observation-resolution]
  - id: IU-dkg-dsl-ownership-decide
    contract: dsl-ownership.pending.record.assign.v1
    unit_kind: operation
    owned_by: dkg-system
    source_target: packages/cli/src/commands/dkg.ts
    inputs: [cli-flags]
    effects: [manual-dkg-persistence, json-or-human-readable-result]
    must_not_own: [automatic-owner-selection, automatic-observation-resolution]
  - id: IU-dkg-dsl-ownership-decide-independent
    contract: dsl-ownership.pending.record.independent.v1
    unit_kind: operation
    owned_by: dkg-system
    source_target: packages/cli/src/commands/dkg.ts
    inputs: [cli-flags]
    effects: [manual-dkg-persistence, pending-review-reduction]
    must_not_own: [automatic-owner-selection, automatic-observation-resolution]
  - id: IU-dkg-self-check-observation-reason
    contract: dkg.self-check.observation-reason.output.v1
    unit_kind: projection
    owned_by: dkg-system
    source_target: packages/cli/src/commands/dkg.ts
    inputs: [metric-values, observation-state, persisted-flow-evidence]
    effects: [recovered-reason-output, retained-reason-output]
    must_not_own: [observation-persistence, automatic-observation-resolution]
```

## 경계 ^constraint

- `assign` 결정은 존재하는 DSL bundle을 가리키지만 bundle membership을 자동 변경하지 않는다. 실제 membership 전까지 audit unit은 `needs-membership-update`다.
- `independent` 결정은 ownership review unit에서 제외되지만 `OBS-DSL-UNCOVERED`를 자동 resolve하지 않는다.
- observation loop 종료는 사람이 별도의 `dkg resolve` 결정으로 수행한다.

## 실패 경로 ^constraint

불완전한 근거 입력은 validation failure로 거부하고 DecisionNode를 저장하지 않는다.
