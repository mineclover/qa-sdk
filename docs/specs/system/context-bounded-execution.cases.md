---
def:
  id: context-bounded-execution-cases
  type: spec
  tier: component
  level: group
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  layer: operation
  family_id: docs/specs/system/context-bounded-execution
  tags: [scenario, testing, architecture, context]
  links:
    - target: context-bounded-execution-cases-planning-core
      type: contains
    - target: context-bounded-execution-cases-planning-cap
      type: contains
    - target: context-bounded-execution-cases-usage
      type: contains
    - target: context-bounded-execution-cases-adapters
      type: contains
    - target: context-bounded-execution
      type: refines
    - target: context-bounded-execution-cases-handoff
      type: contains
    - target: context-bounded-execution-cases-provider-usage
      type: contains
    - target: context-bounded-execution-cases-provider-tokenizer
      type: contains
    - target: context-bounded-execution-cases-definition-consumer
      type: contains
    - target: context-bounded-execution-cases-definition-discovery
      type: contains
    - target: context-bounded-execution-cases-definition-working
      type: contains
    - target: context-bounded-execution-cases-definition-handoff
      type: contains
    - target: context-bounded-execution-cases-observation
      type: contains
sources:
  - packages/context-runtime/src/index.ts
  - packages/context-runtime/src/usage.ts
  - packages/context-runtime/src/handoff.ts
  - packages/cli/src/commands/def.test.ts
  - packages/cli/src/lib/context-runtime/definition-document-context.ts
  - packages/cli/src/lib/context-runtime/task-handoff-store.ts
  - packages/event-catalog/src/categories/infrastructure.ts
---
# Context-Bounded Execution — 행동 계약 모음

## 목적 ^purpose

Discovery Context와 Working Context의 행동 계약을 역할별 leaf 문서로 분리해 관리한다. 개별 계약은 child 문서에 있고, 이 문서는 family entry point와 구성 관계를 소유한다.

## 구성 ^overview

- [Context-Bounded Execution — 예산·Route 계약](./context-bounded-execution-cases-planning-core.cases.md) — 예산 격리, route freeze와 authoritative fact 해소를 검증한다.
- [Context-Bounded Execution — Cap·Working closure 계약](./context-bounded-execution-cases-planning-cap.cases.md) — missing route, cap, overrun과 manifest를 검증한다.
- [Context-Bounded Execution — Usage 계약](./context-bounded-execution-cases-usage.cases.md) — phase-separated usage와 provider usage를 검증한다.
- [Context-Bounded Execution — Adapter·Observation 계약](./context-bounded-execution-cases-adapters.cases.md) — adapter와 metadata-only observation을 검증한다.
- [Context-Bounded Execution — Decomposition·Handoff 계약](./context-bounded-execution-cases-handoff.cases.md) — child task 실행, reference-only handoff, persistence와 aggregation 경계를 검증한다.
- [Context-Bounded Execution — Provider usage 계약](./context-bounded-execution-cases-provider-usage.cases.md) — provider response usage와 provider/model token counter의 측정 identity를 검증한다.
- [Context-Bounded Execution — 외부 tokenizer 계약](./context-bounded-execution-cases-provider-tokenizer.cases.md) — 외부 tokenizer module과 registry 선택, 잘못된 선택·export의 fail-closed 동작을 검증한다.
- [Context-Bounded Execution — Definition consumer 계약](./context-bounded-execution-cases-definition-consumer.cases.md) — definition graph를 bounded context consumer로 사용하는 정상·blocked·decomposition 경로를 검증한다.
- [Context-Bounded Execution — Definition discovery 계약](./context-bounded-execution-cases-definition-discovery.cases.md) — lazy resolution, graph discovery와 local/server source transport 경계를 검증한다.
- [Context-Bounded Execution — Definition working 계약](./context-bounded-execution-cases-definition-working.cases.md) — 최소 Working Fact, observation sink와 phase-separated usage accounting을 검증한다.
- [Context-Bounded Execution — Definition handoff 계약](./context-bounded-execution-cases-definition-handoff.cases.md) — Definition child 결과의 discovery/read-model 분리와 handoff persistence·aggregation을 검증한다.
- [Context-Bounded Execution — Observation vocabulary 계약](./context-bounded-execution-cases-observation.cases.md) — context runtime observation event의 catalog projection을 검증한다.

## 검증 경계 ^validation

qa-sdk docs bdd validate context-bounded-execution-cases --family-only는 이 문서와 모든 child 문서의 계약·test unit·implementation unit family를 함께 검증한다.

## 구현 참조 ^source

- packages/context-runtime/src/index.ts
- packages/context-runtime/src/usage.ts
- packages/context-runtime/src/handoff.ts
- packages/cli/src/commands/def.test.ts
- packages/cli/src/lib/context-runtime/definition-document-context.ts
- packages/cli/src/lib/context-runtime/task-handoff-store.ts
- packages/event-catalog/src/categories/infrastructure.ts
