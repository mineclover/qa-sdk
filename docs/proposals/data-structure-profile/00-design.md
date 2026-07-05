---
def:
  id: data-structure-profile-00-design
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: specification
status: implemented
date: 2026-07-01
part_of: data-structure-profile
role: overview
supersedes: -
superseded_by: -
---

# Data Structure Profile - Design Proposal

## Purpose ^purpose

Data Structure Profile은 가명처리, stream flattening, metric/fact 설계, 품질 검증,
시각화 편집을 하나의 판단 체계로 묶기 위한 qa-sdk proposal이다.

이 제안의 목표는 DPM 자체를 qa-sdk로 옮기는 것이 아니다. privacy/pseudonymization 실행
정책은 oa-sdk DPM이 계속 소유하고, qa-sdk는 그 앞뒤에 있는 데이터 구조의 taxonomy,
lineage, measurement, quality gate를 소유한다.

핵심 질문은 다음이다.

> 이 데이터 구조를 기존 qa-sdk taxonomy 철학으로 보완할 것인가, 아니면 별도 profile
> system으로 새로 만들 것인가?

이 문서는 그 판단 기준을 먼저 고정한다.

## 1. Background ^context

현재 관심사는 Kafka, ClickPipes, Materialized View, ARRAY JOIN 같은 stream/data pipeline에서
nested event를 평탄화하고 측정 가능한 fact/metric surface로 만드는 것이다. 이 작업은 단순
ETL 구현이 아니라 다음을 함께 요구한다.

- source event/table 구조의 선언
- field, array, relationship, fact, metric 사이의 lineage
- flatten/explode 전후의 row multiplier와 비용/latency 추정
- dedup, replay, schema drift, late event, residual PII 같은 quality gate
- 사람이 검토할 수 있는 graph/preview/editor surface
- DPM policy와 연결되는 privacy readiness 판단

qa-sdk의 taxonomy-engine은 이미 YAML SSOT, Axis/Entry/Relation, lifecycle, decision link,
diagnostics, diff, codegen 방향을 가진다. 하지만 실제 구현/스펙이 이 목표를 곧바로 만족하지
못할 수 있으므로, 기존 철학을 계승하되 무리하게 모든 것을 taxonomy-engine에 밀어 넣지 않는다.

## 2. Positioning ^defines

### 2.1 Repo Boundary

| Concern | Owner | Reason |
|---|---|---|
| PII role, token namespace, reversible vault, DPM manifest | oa-sdk / `@oa-sdk/dpm` | privacy execution policy and pseudonymization contract |
| Event/table/field/array/fact/metric structure | qa-sdk / Data Structure Profile | taxonomy, coordinate, lineage, and quality judgment |
| Stream operation risk: dedup, replay, schema evolution | qa-sdk | observable quality gate and operation evidence |
| Benchmark: row multiplier, latency, storage, cost | qa-sdk | measurement and comparison evidence |
| Visualization/editor model | qa-sdk | derived graph from taxonomy/profile/ledger evidence |

### 2.2 Concept Boundary

Data Structure Profile is not:

- a Kafka connector,
- a ClickHouse migration generator,
- a DPM manifest replacement,
- a production token vault,
- a general ETL orchestration engine.

Data Structure Profile is:

- a machine-readable data-structure judgment contract,
- a taxonomy-backed lineage model,
- a dry-run and quality-gate input,
- a bridge between stream/fact design and optional DPM privacy readiness.

## 3. Design Options ^decision-point

### Option A - Use taxonomy-engine only

Represent every data-structure concept as taxonomy axes and relations.

Benefits:
- strongest continuity with qa-sdk philosophy,
- minimal new package surface,
- existing validate/diff/lifecycle/decision model can be reused.

Risks:
- complex pipeline semantics may become awkward relation rules,
- measurement reports and dry-run estimates may not fit pure taxonomy,
- privacy readiness may be hard to express without leaking DPM concepts into taxonomy.

Use this when:
- the problem is classification, lifecycle, relation, or decision evidence,
- there is no need for compiled execution/dry-run output,
- users only need validate/diff/show style tooling.

### Option B - Extend taxonomy-engine with a profile layer

Keep taxonomy-engine as the structural foundation, but add a Data Structure Profile layer that
references taxonomy axes and emits lineage, diagnostics, and measurement reports.

Benefits:
- keeps Axis/Entry/Relation as the vocabulary SSOT,
- gives flattening/measurement/privacy readiness a dedicated contract,
- allows gradual implementation without forcing all semantics into taxonomy rules.

Risks:
- introduces a second abstraction layer that needs clear naming and lifecycle,
- requires profile-specific diagnostics and fixture gates,
- can drift from taxonomy if references are not validated.

Use this when:
- structure classification and executable analysis are both needed,
- fixture-backed compile/dry-run is required,
- visualization needs a normalized graph beyond raw taxonomy relations.

### Option C - Create a separate data-flow system

Create an independent data-flow/measurement system that only loosely integrates with taxonomy.

Benefits:
- maximum freedom for stream pipeline semantics,
- easier to model adapters such as Kafka, Spark, ClickHouse, and dbt directly,
- less constrained by current taxonomy-engine gaps.

Risks:
- duplicates qa-sdk's existing coordinate/taxonomy/definition philosophy,
- increases package and governance surface,
- may create a parallel SSOT for data structure.

Use this only when:
- taxonomy-engine cannot represent the minimum profile references,
- stream execution semantics become the core product rather than design/validation,
- a real runtime adapter must own I/O, scheduling, or live pipeline execution.

### Recommendation

Adopt Option B.

The profile layer should inherit qa-sdk's taxonomy philosophy but stay separate enough to compensate
for current taxonomy-engine limitations. In practice:

- taxonomy owns finite vocabularies and relation grammar,
- profile owns stream/table/field/fact/metric lineage instances,
- quality evidence ledgers own persisted gate/review outcomes after adapter import,
- measurement tooling owns benchmark/report surfaces, while profile dry-run owns row multiplier calculation,
- preview consumers render lineage/graph artifacts without owning profile schema,
- DPM remains an optional privacy policy reference.

## 3.1 Planning Documents

This proposal is managed as a named planning folder, not a single design note.

| File | Role |
|---|---|
| [README.md](./README.md) | routing index and acceptance bias |
| [01-fit-audit.md](./01-fit-audit.md) | qa-sdk philosophy inheritance and expected gaps |
| [02-taxonomy-layer.md](./02-taxonomy-layer.md) | vocabulary axes and relation grammar |
| [03-profile-layer.md](./03-profile-layer.md) | concrete profile YAML, lineage, measurement artifacts |
| [04-validation-and-diagnostics.md](./04-validation-and-diagnostics.md) | `dsp-*` diagnostics and quality gate policy |
| [05-adoption-plan.md](./05-adoption-plan.md) | phased path from proposal to fixture pilot |
| [06-reference-map.md](./06-reference-map.md) | concrete reuse boundary against existing qa-sdk packages/docs |
| [fixtures/](./fixtures/) | first fixture profile and expected derived artifacts |

## 4. Practical Judgment Criteria ^decision-point

The following table is the first design gate for any new concept.

| Question | If yes | Owner |
|---|---|---|
| Is it a finite vocabulary with stable entries? | Make it a taxonomy axis. | taxonomy-engine |
| Does it connect two taxonomy entries or coordinates? | Make it a taxonomy relation. | taxonomy-engine |
| Does it describe a concrete source-to-target structure mapping? | Make it a profile node/edge. | Data Structure Profile |
| Does it calculate row/latency/storage/cost impact? | Make it a measurement report. | profile dry-run, then measurement tooling adapter |
| Does it decide pass/fail or warning/error? | Make it a quality diagnostic/gate. | profile validator, then quality evidence ledger adapter |
| Does it expose PII/token/vault semantics? | Reference DPM, do not duplicate it. | oa-sdk DPM |
| Does it need live connector I/O or scheduling? | Keep out of MVP; evaluate separate adapter. | future data-flow adapter |
| Does it need human graph inspection? | Use profile lineage graph as the UI model. | profile preview surface |

The rule of thumb:

> Taxonomy decides what kinds of things exist. Profile decides how specific things flow. Ledger and
> bench decide whether the flow is healthy. DPM decides whether privacy obligations are satisfied.

## 5. Proposed Data Model ^defines

### 5.1 Taxonomy Axes

The first taxonomy should be checked in as `docs/taxonomies/data-structure-profile.yaml`.

Initial axes:

```yaml
axes:
  data-source-kind:
    entries: [postgres, kafka, clickhouse, file, api, cdc]

  structure-kind:
    entries: [table, topic, event, object, array, field, relationship, fact, metric]

  transform-kind:
    entries: [project, cast, normalize, flatten, explode, join, aggregate, pseudonymize]

  measurement-kind:
    entries: [event-rate, payload-size, array-length, row-multiplier, latency, storage, cost]

  quality-risk:
    entries: [dedup, replay, schema-drift, late-event, orphan, array-explosion, pii-leak, relationship-break]

  adapter-capability:
    entries: [array-join, materialized-view, watermark, stateful-join, replay, schema-registry]
```

These are taxonomy-level concepts, not pipeline instances.

### 5.2 Profile Instance

A profile instance should describe one concrete data product or pipeline.

```yaml
profile: order-events-to-order-item-facts
version: 1

source:
  kind: kafka
  ref: commerce.orders
  payload_format: json
  event_id_path: $.event_id
  event_time_path: $.occurred_at

structures:
  - id: order-event
    kind: event
    source_path: $
  - id: item-array
    kind: array
    source_path: $.items[*]
  - id: order-item-fact
    kind: fact
    target_ref: clickhouse.fact_order_items

transforms:
  - id: explode-items
    kind: explode
    from: item-array
    to: order-item-fact
    semantics:
      empty_array: left-empty-row
      max_array_length: 200

measurements:
  expected_event_rate_per_sec: 1000
  average_payload_bytes: 2048
  average_array_length: 5
  max_array_length: 200

quality_gates:
  - id: event-id-dedup-required
    risk: dedup
    severity: error
  - id: array-explosion-budget
    risk: array-explosion
    severity: error

privacy:
  dpm_policy_ref: optional
  required_when:
    - pii-leak
    - relationship-break
```

### 5.3 Derived Artifacts

The profile should compile to derived artifacts:

| Artifact | Purpose |
|---|---|
| Lineage graph | source path -> transform -> fact/metric node |
| Measurement report | row multiplier, estimated rows/sec, storage/cost hints |
| Quality diagnostics | missing dedup key, unbounded array, schema drift risk |
| DPM readiness report | whether DPM policy reference is required or missing |
| Visualization JSON | stable graph model for registry-ui/viz-web |

## 6. Integration With Existing qa-sdk Surfaces ^context

| Existing Surface | Integration |
|---|---|
| `docs/taxonomies/*` | Add `data-structure-profile.yaml` as the vocabulary SSOT. |
| taxonomy-engine | Parse/validate axes, relations, lifecycle, decision links. |
| definition-catalog | Store proposal/spec documents and decision evidence. |
| event-catalog | Reuse event vocabulary for Kafka/event source names where possible. |
| quality evidence ledgers | Record profile gate outcomes and drift decisions after adapter import. |
| measurement tooling | Render or compare fixture-backed measurement reports from profile dry-run output. |
| profile preview surfaces | Render lineage and decision graph from derived Visualization JSON. |
| oa-sdk DPM | Optional external privacy policy reference, not a dependency of taxonomy-engine. |

See [06-reference-map.md](./06-reference-map.md) for the concrete reuse depth. The profile layer is
allowed to bridge into these surfaces, but the MVP should not make any of them required for parsing
or validating a profile fixture.

## 7. MVP Scope ^decision-point

### In scope

1. A proposal and taxonomy draft.
2. One fixture-backed profile: Kafka-like order event -> item fact table.
3. Static validation of source paths, transform references, bounded array policy, and dedup policy.
4. Dry-run measurement report for row multiplier and estimated fact rows/sec.
5. DPM readiness diagnostic when PII-sensitive structure lacks a DPM policy reference.
6. Visualization-ready lineage JSON.

### Out of scope

1. Live Kafka, ClickHouse, or Spark connections.
2. Real DPM tokenization execution.
3. SQL generation for Materialized View or ARRAY JOIN.
4. Runtime scheduling, offset management, or connector deployment.
5. Web editor write-back.

## 8. Validation Strategy ^constraint

The first implementation should be fixture-first and deterministic.

Required gates:

| Gate | Expected Evidence |
|---|---|
| taxonomy validate | no broken axes, entries, relations, lifecycle errors |
| profile parse | profile YAML normalizes into IR |
| profile validate | all structure and transform references resolve |
| measurement dry-run | row multiplier and fact-row estimate are deterministic |
| quality diagnostics | dedup/replay/schema-drift risks produce stable codes |
| DPM readiness | privacy-sensitive structures produce optional bridge diagnostics |
| visualization export | lineage JSON snapshot is stable |

Diagnostic prefixes should be separate from taxonomy-engine core:

- `dsp-struct-*`
- `dsp-transform-*`
- `dsp-measure-*`
- `dsp-quality-*`
- `dsp-privacy-*`

## 9. Adoption Path ^defines

### Phase 0 - Proposal and Fit Check

Write this proposal and review it against existing qa-sdk taxonomy-engine, event-catalog,
quality evidence ledgers, measurement tooling, and preview surfaces.

Exit:
- The team agrees whether Option B is still the right default.
- Open mismatches with current qa-sdk specs are listed.

### Phase 1 - Taxonomy Draft

Add `docs/taxonomies/data-structure-profile.yaml` with axes and relation rules only.

Exit:
- Taxonomy validates.
- Existing taxonomy philosophy is reused without profile runtime.

### Phase 2 - Fixture Profile

Add a concrete order-event fixture and expected validation, lineage, measurement, and DPM readiness
snapshots.

Exit:
- The fixture is concrete enough to drive implementation tests later.
- No live Kafka or ClickHouse dependency exists.

### Phase 3 - Profile Contract

Add a small package or module for Data Structure Profile parse/validate/compile.

Exit:
- Fixture profile produces deterministic diagnostics and lineage JSON.
- No live connector I/O exists.

### Phase 4 - Measurement and Quality Evidence

Connect dry-run outputs to measurement tooling and quality evidence ledgers through adapter payloads.

Exit:
- Row multiplier and quality gate evidence can be recorded and compared.

### Phase 5 - Visualization

Render lineage and gate overlays in an existing UI surface.

Exit:
- Users can inspect source -> transform -> fact/metric edges and gate status.

## 10. Mismatch Audit Checklist ^decision-point

Before implementation, inspect actual qa-sdk surfaces against these expectations.

| Expectation | Audit Question | If Missing |
|---|---|---|
| taxonomy-engine supports custom relation kinds | Can profile relation kinds be represented without code change? | Add profile-specific validator outside taxonomy-engine. |
| lifecycle exists on entries | Can draft/review/approved/tbd be expressed on all needed entries? | Keep lifecycle in profile until taxonomy catches up. |
| diagnostics are stable and machine-readable | Can downstream tools grep diagnostic codes? | Add profile diagnostics catalog. |
| event-catalog can describe stream payloads | Can event payload shape and graph hints be represented? | Add event-source vocabulary or profile-local source section. |
| quality-ledger can record profile gate runs | Can gate id, profile id, severity, and evidence be stored? | Add adapter or keep JSON report first. |
| bench can run non-SDK measurement reports | Can row multiplier/latency/storage estimates be represented? | Start with profile-local dry-run report. |
| viz-web can render arbitrary lineage graph | Can graph nodes/edges be loaded from static JSON? | Export visualization JSON before UI integration. |
| DPM bridge can stay optional | Can profile validate without oa-sdk installed? | Use string refs, never direct package dependency in MVP. |

## 11. Open Issues

- Decide whether the first implementation lives in a new `packages/data-structure-profile` package
  or inside an existing package until the API stabilizes.
- Decide whether profile YAML belongs under `docs/taxonomies/` or a new `docs/profiles/` directory.
- Decide how strict DPM readiness should be: warning by default or error when `privacy.required=true`.
- Decide whether adapter capability matrix belongs in taxonomy or in profile config.
- Confirm whether taxonomy-engine currently has enough implemented API surface for custom relation
  validation, diff, and visualization export.

## 12. References

- [Taxonomy Engine Design](../taxonomy-engine/00-design.md)
- [Taxonomy Engine Data Model](../taxonomy-engine/data-model.md)
- [Taxonomy Engine Diagnostics](../taxonomy-engine/diagnostics.md)
- [Taxonomy Web UI Draft](../taxonomy-web/00-design.md)
- `docs/taxonomies/ingest-coords.yaml`
- oa-sdk DPM concept: `/Users/junwoobang/workflow/oa-sdk/docs/concepts/data-pseudonymization-manifest.md`
