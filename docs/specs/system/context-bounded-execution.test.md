---
def:
  id: context-bounded-execution-test
  type: spec
  tier: layout
  level: group
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  family_id: docs/specs/system/context-bounded-execution
  tags: [testing, architecture, context]
  links:
    - target: context-bounded-execution
      type: refines
    - target: context-bounded-execution-cases
      type: depends_on
    - target: context-bounded-execution-todo
      type: traces_to
    - target: context-runtime
      type: traces_to
    - target: context-bounded-execution-test-planning-core
      type: refs
    - target: context-bounded-execution-test-planning-cap
      type: refs
    - target: context-bounded-execution-test-usage
      type: refs
    - target: context-bounded-execution-test-adapters
      type: refs
    - target: context-bounded-execution-test-handoff
      type: refs
    - target: context-bounded-execution-test-provider-usage
      type: refs
    - target: context-bounded-execution-test-provider-tokenizer
      type: refs
    - target: context-bounded-execution-test-definition-consumer
      type: refs
    - target: context-bounded-execution-test-definition-discovery
      type: refs
    - target: context-bounded-execution-test-definition-working
      type: refs
    - target: context-bounded-execution-test-definition-handoff
      type: refs
    - target: context-bounded-execution-test-observation
      type: refs
    - target: context-bounded-execution-test-stop-rules
      type: refs
sources:
  - packages/context-runtime/src/budget.test.ts
  - packages/context-runtime/src/discovery.test.ts
  - packages/context-runtime/src/decomposition.test.ts
  - packages/context-runtime/src/routes.test.ts
  - packages/context-runtime/src/working-context.test.ts
  - packages/context-runtime/src/manifest.test.ts
  - packages/context-runtime/src/handoff.test.ts
  - packages/context-runtime/src/handoff-execution.test.ts
  - packages/context-runtime/src/adapters.test.ts
  - packages/context-runtime/src/closure.test.ts
  - packages/context-runtime/src/boundary.test.ts
  - packages/context-runtime/src/usage.test.ts
  - packages/cli/src/commands/def.test.ts
  - packages/cli/src/lib/context-runtime/provider-usage-adapters.ts
  - packages/cli/src/lib/context-runtime/provider-usage-adapters.test.ts
  - packages/cli/src/lib/context-runtime/definition-document-context.test.ts
  - packages/cli/src/lib/context-runtime/task-handoff-store.test.ts
  - packages/definition-data-source/src/factory.test.ts
  - packages/definition-data-source/src/server-data-source.test.ts
  - packages/event-catalog/src/index.test.ts
  - packages/provider-tokenizer-openai/src/index.test.ts
---
# Context-Bounded Execution — 검증 매핑 모음

## 목적 ^purpose

Discovery/Working Context 계약의 test unit과 implementation unit을 역할별 leaf 문서로 분리해 관리한다. 이 layout 문서는 family entry point와 전체 source/test 경계를 소유한다.

## 구성 ^overview

- [Context-Bounded Execution — 예산·Route 검증](./context-bounded-execution-test-planning-core.test.md) — 예산 격리, route freeze와 authoritative fact 해소의 test/implementation unit을 관리한다.
- [Context-Bounded Execution — Cap·Working closure 검증](./context-bounded-execution-test-planning-cap.test.md) — missing route, Discovery cap·size bound, Working overrun과 manifest의 test/implementation unit을 관리한다.
- [Context-Bounded Execution — Usage 검증](./context-bounded-execution-test-usage.test.md) — phase-separated usage ledger, malformed input, measured token counter와 provider usage의 unit을 관리한다.
- [Context-Bounded Execution — Adapter·Observation 검증](./context-bounded-execution-test-adapters.test.md) — definition/federation/decision adapter와 metadata-only observation projection의 unit을 관리한다.
- [Context-Bounded Execution — Decomposition·Handoff 검증](./context-bounded-execution-test-handoff.test.md) — child task 실행, reference-only handoff, persistence와 aggregation의 unit을 관리한다.
- [Context-Bounded Execution — Provider usage 검증](./context-bounded-execution-test-provider-usage.test.md) — provider response usage와 provider/model token counter의 unit을 관리한다.
- [Context-Bounded Execution — 외부 tokenizer 검증](./context-bounded-execution-test-provider-tokenizer.test.md) — 외부 tokenizer module과 registry 선택 및 fail-closed guard의 unit을 관리한다.
- [Context-Bounded Execution — Definition consumer 검증](./context-bounded-execution-test-definition-consumer.test.md) — definition graph bounded consumer의 정상·blocked·decomposition 경로 unit을 관리한다.
- [Context-Bounded Execution — Definition discovery 검증](./context-bounded-execution-test-definition-discovery.test.md) — lazy resolution, graph discovery와 local/server source transport의 unit을 관리한다.
- [Context-Bounded Execution — Definition working 검증](./context-bounded-execution-test-definition-working.test.md) — 최소 Working Fact, observation sink와 phase-separated usage accounting의 unit을 관리한다.
- [Context-Bounded Execution — Definition handoff 검증](./context-bounded-execution-test-definition-handoff.test.md) — Definition child 결과의 discovery/read-model 분리와 handoff persistence·aggregation의 unit을 관리한다.
- [Context-Bounded Execution — Observation vocabulary 검증](./context-bounded-execution-test-observation.test.md) — context runtime observation event catalog projection의 unit을 관리한다.
- [Context-Bounded Execution — Stop Rules 검증](./context-bounded-execution-test-stop-rules.test.md) — topic coverage, no-progress, source exhaustion과 hard-cap precedence의 unit을 관리한다.

## BDD 검증 경계 ^validation

qa-sdk docs bdd validate context-bounded-execution-cases --family-only는 cases와 이 test family의 contract·test unit·implementation unit을 함께 검증한다.

## 구현 참조 ^source

- packages/context-runtime/src/budget.test.ts
- packages/context-runtime/src/discovery.test.ts
- packages/context-runtime/src/decomposition.test.ts
- packages/context-runtime/src/routes.test.ts
- packages/context-runtime/src/working-context.test.ts
- packages/context-runtime/src/manifest.test.ts
- packages/context-runtime/src/handoff.test.ts
- packages/context-runtime/src/handoff-execution.test.ts
- packages/context-runtime/src/adapters.test.ts
- packages/context-runtime/src/closure.test.ts
- packages/context-runtime/src/boundary.test.ts
- packages/context-runtime/src/usage.test.ts
- packages/cli/src/commands/def.test.ts
- packages/cli/src/lib/context-runtime/provider-usage-adapters.ts
- packages/cli/src/lib/context-runtime/provider-usage-adapters.test.ts
- packages/cli/src/lib/context-runtime/definition-document-context.test.ts
- packages/cli/src/lib/context-runtime/task-handoff-store.test.ts
- packages/definition-data-source/src/factory.test.ts
- packages/definition-data-source/src/server-data-source.test.ts
- packages/event-catalog/src/index.test.ts
