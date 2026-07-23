---
def:
  id: data-structure-profile-readme
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: layout
  depth: overview
  links:
    - target: data-structure-profile-00-design
      type: refs
    - target: data-structure-profile-01-fit-audit
      type: refs
    - target: data-structure-profile-02-taxonomy-layer
      type: refs
    - target: data-structure-profile-03-profile-layer
      type: refs
    - target: data-structure-profile-04-validation-and-diagnostics
      type: refs
    - target: data-structure-profile-05-adoption-plan
      type: refs
    - target: data-structure-profile-06-reference-map
      type: refs
    - target: data-structure-profile-fixtures-readme
      type: refs
status: implemented
date: 2026-07-01
part_of: data-structure-profile
role: index
supersedes: -
superseded_by: -
---

# Data Structure Profile Proposal

## Purpose ^purpose

Data Structure Profile proposal과 구현된 fixture-first baseline 문서군의 진입점을 제공하고,
taxonomy layer와 concrete profile layer의 소유 경계를 조망한다.

Data Structure Profile은 qa-sdk의 taxonomy-engine 철학을 계승하면서, 가명처리에서 시작된
데이터 구조 관리 문제를 stream flattening, measurement, quality gate, DPM readiness 판단으로
확장하기 위한 proposal이다.

## Working Thesis

이 proposal은 Option B를 기본 가설로 둔다.

```text
taxonomy-engine + profile layer
```

taxonomy-engine은 finite vocabulary, coordinate, relation, lifecycle, decision evidence를 계속
소유한다. Data Structure Profile layer는 특정 source/event/table 구조가 fact/metric surface로
흐르는 concrete mapping, measurement dry-run, profile-specific diagnostics, visualization export를
소유한다.

## Documents

| File | Role |
|---|---|
| [00-design.md](./00-design.md) | 전체 방향, repo boundary, Option A/B/C 비교, B안 추천 |
| [01-fit-audit.md](./01-fit-audit.md) | 기존 qa-sdk 철학/스펙을 어디까지 계승하고 어디를 보완할지 점검 |
| [02-taxonomy-layer.md](./02-taxonomy-layer.md) | taxonomy axis/relation/lifecycle가 소유할 vocabulary layer |
| [03-profile-layer.md](./03-profile-layer.md) | concrete profile YAML shape, lineage graph, derived artifacts |
| [04-validation-and-diagnostics.md](./04-validation-and-diagnostics.md) | profile validation, quality gates, diagnostic code policy |
| [05-adoption-plan.md](./05-adoption-plan.md) | proposal -> taxonomy draft -> fixture pilot -> implementation path |
| [06-reference-map.md](./06-reference-map.md) | existing qa-sdk surfaces to reuse, bridge, or keep as references |
| [fixtures/](./fixtures/) | first Kafka-like order event profile and deterministic expected outputs |

## Implemented Baseline Specs

The implemented fixture-first baseline has been promoted to regular specs:

| Spec | Role |
|---|---|
| [`../../specs/data-structure-profile/data-structure-profile-system.spec.md`](../../specs/data-structure-profile/data-structure-profile-system.spec.md) | approved system boundary and public surface |
| [`../../specs/data-structure-profile/data-structure-profile-taxonomy.spec.md`](../../specs/data-structure-profile/data-structure-profile-taxonomy.spec.md) | finite vocabulary and relation grammar |
| [`../../specs/data-structure-profile/data-structure-profile-profile-contract.spec.md`](../../specs/data-structure-profile/data-structure-profile-profile-contract.spec.md) | profile input and derived artifact contract |
| [`../../specs/data-structure-profile/data-structure-profile-validation.spec.md`](../../specs/data-structure-profile/data-structure-profile-validation.spec.md) | diagnostics and quality gate semantics |
| [`../../specs/data-structure-profile/data-structure-profile-cli.spec.md`](../../specs/data-structure-profile/data-structure-profile-cli.spec.md) | package-local CLI fixture runner |
| [`../../specs/data-structure-profile/data-structure-profile-system.test.md`](../../specs/data-structure-profile/data-structure-profile-system.test.md) | verification surface |
| [`../../specs/data-structure-profile/data-structure-profile-operations.rule.md`](../../specs/data-structure-profile/data-structure-profile-operations.rule.md) | operating guide and profile isolation rules |
| [`../../specs/data-structure-profile/data-structure-profile-system.todo.md`](../../specs/data-structure-profile/data-structure-profile-system.todo.md) | future adapter/runtime scope |

## Core Boundaries

| Concern | Owner |
|---|---|
| finite data-structure vocabulary | taxonomy-engine |
| concrete source-to-target structure mapping | Data Structure Profile |
| gate outcome history | quality-ledger |
| measurement run and benchmark report | `@qa-sdk/bench` |
| graph/lineage visualization | viz-web / registry-ui |
| privacy execution and token policy | oa-sdk DPM |

The detailed reuse depth is maintained in [06-reference-map.md](./06-reference-map.md). The rule is
that Data Structure Profile should reuse existing packages for vocabulary, evidence, measurement,
and visualization consumption, but should own concrete source-to-target profile compilation.

## Acceptance Bias

이 proposal은 바로 정규 spec으로 승격하지 않는다. 먼저 fixture-backed shadow validation을 통해
기존 qa-sdk 스펙 기대와 실제 구현 간 mismatch를 확인한다.

Minimum acceptance evidence:

1. `docs/taxonomies/data-structure-profile.yaml` draft can validate.
2. Checked-in Kafka and relational profiles compile to lineage JSON.
3. Measurement dry-run reports deterministic row multiplier.
4. Quality diagnostics catch dedup, unbounded array, and schema drift risks.
5. DPM readiness remains optional string reference, not a package dependency.
6. `data-structure-profile` CLI can produce validation, lineage, measurement, and DPM readiness
   artifacts from the same fixture paths used by tests and demos.
7. Repo-level smoke can feed adapter outputs into actual `quality-ledger` and `@qa-sdk/bench`
   public APIs without adding runtime dependencies to the profile package.

Implemented baseline artifacts:

- [`../../taxonomies/data-structure-profile.yaml`](../../taxonomies/data-structure-profile.yaml)
- [fixtures/order-events.profile.yaml](./fixtures/order-events.profile.yaml)
- [fixtures/customer-orders.profile.yaml](./fixtures/customer-orders.profile.yaml)
- [`../../../packages/data-structure-profile`](../../../packages/data-structure-profile) package spike
- [`../../../packages/viz-web/data-structure-profile.html`](../../../packages/viz-web/data-structure-profile.html) read-only visualization pilot
- [`../../../scripts/data-structure-profile-bridge-smoke.mjs`](../../../scripts/data-structure-profile-bridge-smoke.mjs) bridge smoke
