---
def:
  id: data-structure-profile-01-fit-audit
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
role: fit-audit
supersedes: -
superseded_by: -
---

# Fit Audit

## Purpose ^purpose

이 문서는 Data Structure Profile이 기존 qa-sdk 철학을 어느 정도 계승하고, 어디서 별도 profile
layer로 보완해야 하는지 판단한다.

## 1. Inherited Philosophy ^defines

| qa-sdk Principle | Keep? | How Data Structure Profile Uses It |
|---|---:|---|
| YAML SSOT | yes | taxonomy vocabulary and profile fixtures start as checked-in YAML. |
| Axis + Entry + Coordinate | yes | source kind, structure kind, transform kind, measurement kind are axes. |
| Relation as first-class edge | yes | source emits structure, structure projects to fact, transform produces metric. |
| address immutable / id mutable | yes | taxonomy entries keep stable addresses; profile instance ids can be refactored with migration evidence. |
| lifecycle and decisionLink | yes | draft/review/approved/tbd applies to vocabulary entries and profile decisions. |
| stable diagnostics | yes | `dsp-*` diagnostics use stable grep-safe codes. |
| deterministic codegen/diff | yes, later | profile outputs should be deterministic enough for snapshot and diff gates. |
| pure library + thin CLI | yes | live connector I/O stays outside MVP. |

## 2. Expected Gaps ^decision-point

| Gap | Why It Matters | Proposed Response |
|---|---|---|
| taxonomy relation rules may not express concrete JSONPath mapping | flattening needs source paths and target refs | Keep path mapping in profile layer. |
| taxonomy-engine may not own measurement math | row multiplier and cost estimates are not vocabulary | Put deterministic dry-run in profile layer or bench adapter. |
| quality-ledger may not yet know profile gate evidence | gate outcomes need profile id, run id, severity, evidence | Start with JSON report, then add ledger adapter. |
| event-catalog may not model Kafka payload schemas | stream payload shape may exceed current event vocabulary | Keep source schema in profile fixture first. |
| viz-web may not load arbitrary lineage graphs | UI integration should not block model design | Export visualization JSON before web integration. |
| DPM is in another repo | direct dependency would couple qa-sdk to oa-sdk | Use string refs and readiness diagnostics only. |

## 3. Reuse vs New Build Criteria

Use existing qa-sdk surface when:

- the object is a vocabulary, relation, lifecycle, decision, diagnostic, or evidence record;
- the behavior can be expressed as parse/validate/diff/query without live I/O;
- the output can be checked by deterministic fixtures.

Add Data Structure Profile-specific layer when:

- the object is a concrete source-to-target mapping;
- the behavior needs compile/dry-run derived artifacts;
- the validation depends on JSONPath-like paths, row multiplier, or transform semantics;
- the UI needs a normalized lineage graph instead of raw taxonomy graph.

Create a separate system only when:

- live connector I/O, scheduling, offset replay, or adapter deployment becomes the product boundary;
- stream execution semantics dominate over design-time validation;
- the abstraction cannot keep taxonomy references stable.

## 4. Fit Verdict

The current proposal should proceed as taxonomy-engine plus profile layer.

Rationale:

- Existing qa-sdk philosophy already matches the vocabulary and decision side.
- Profile-specific mapping and measurement would overload taxonomy-engine if modeled as plain relations.
- Keeping DPM optional preserves repo boundaries while still enabling privacy readiness judgment.

## 5. Follow-up Audit Tasks

1. Use [06-reference-map.md](./06-reference-map.md) as the current reuse baseline.
2. Inspect whether taxonomy-engine implementation supports custom relation kinds without code changes.
3. Inspect whether quality-ledger can record profile gate evidence without schema changes.
4. Inspect whether bench can represent non-SDK measurement reports.
5. Inspect whether viz-web or registry-ui can load a static lineage JSON.
6. Inspect whether event-catalog has enough payload vocabulary for Kafka-like source events.
