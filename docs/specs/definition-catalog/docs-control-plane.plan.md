---
def:
  tier: component
  id: docs-control-plane-plan
  type: knowledge
  knowledge_kind: proposal
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: draft
  layer: mediation
  svc: cli
  tags: [structural, roadmap, testing]
  links:
    - target: docs-control-plane
      type: refines
    - target: docs-control-plane-todo
      type: traces_to
---

# Docs Control Plane — Roadmap Plan

## 목적 ^purpose

`qa-sdk docs` control plane의 후속 작업 순서와 이유를 기록한다. 목표는 adapter/read model, coordinate graph traversal, source-map coverage, pack authoring, ranking/filtering, PRD sync precision, section-level graph를 서로 겹치지 않는 실행 단계로 유지하는 것이다.

## 구성 ^overview

현재 완료된 기반은 docs control plane adapters, status/collect/search/drift, PRD authoring/conversion/sync dry-run, metadata transform dry-run, document coordinate graph traversal, family-only inventory scope, topdown lifecycle inventory policy, and the first docs-control-plane family alignment pass이다.

## Topdown Lifecycle Inventory Policy

Active inventory is intentionally scoped to repository-owned documentation and active PRD execution records:

- `docs/specs/**` definition markdown is active inventory unless the document is explicitly archived.
- `tasks/**/prd-*.md` and `tasks/**/prd-*.json` are active PRD inventory.
- `tasks/archive/**` is excluded by default.
- Archived documents, including any future document with `lifecycle: archived` or under a docs archive directory, are excluded by default.
- Archive PRDs or archived docs may enter an inventory only when the operator targets that exact path or id.

Inventory cleanup starts from stable system/module boundaries, not stale leaf files. The active roots for this lifecycle pass are:

| boundary | root id | level | path | role |
|----------|---------|-------|------|------|
| definition-catalog | `definition-catalog-spec` | module | `docs/specs/definition-catalog/definition-catalog.spec.md` | entry module for definition-catalog and docs-control-plane concerns |
| docs-control-plane | `docs-control-plane` | module | `docs/specs/definition-catalog/docs-control-plane.spec.md` | module root for docs CLI control-plane role alignment |
| operational-ontology-system | `operational-ontology-system` | group | `docs/specs/operational-ontology/operational-ontology-system.spec.md` | entry group for operational ontology modules |
| operational-ontology-registry-allocation | `operational-ontology-registry-allocation` | module | `docs/specs/operational-ontology/operational-ontology-registry-allocation.spec.md` | module root for registry allocation lifecycle alignment |
| programming-artifact-ontology-system | `programming-artifact-ontology-system` | module | `docs/specs/operational-ontology/programming-artifact-ontology-system.spec.md` | module root for programming artifact pack/provider alignment |
| authorization-ontology-system | `authorization-ontology-system` | group | `docs/specs/authorization-ontology/authorization-ontology-system.spec.md` | entry group for authorization ontology and hardening alignment |

Traversal order for lifecycle inventory:

1. Start at the entry group or module root.
2. Expand contained modules before leaves.
3. Read same-family role documents next: spec, plan, todo, rule, cases, test, memo, knowledge, active PRD markdown, and active ralph PRD JSON.
4. Inspect direct leaf documents and source/evidence references last as proof, not as inventory roots.

Operationally, use `docs status <root> --json` or `docs collect <root> --family-only --json` for the active family first. Use broad graph traversal only after the family boundary is understood, and never promote archive/session results into active scope without an explicit target or opt-in flag.

## First Topdown Family Alignment — docs-control-plane

This pass used `qa-sdk def topdown docs-control-plane`, `qa-sdk def context docs-control-plane`, `docs collect docs-control-plane --family-only --json`, and `docs status docs-control-plane --json`.

| field | value |
|-------|-------|
| existing same-family roles | `spec`, `plan`, `todo` |
| linked context roles | `spec` via `definition-catalog-spec` refinement |
| missing same-family roles | `rule`, `cases`, `test`, `memo`, `knowledge`, `prd`, `ralph-prd-json` |
| actionable TODO count | 16 open checklist rows |
| deferred TODO count | 7 open checklist rows |
| parking-lot TODO count | 0 open checklist rows |
| completed record candidates | 0 (`completedRecords: []`) |
| source refs | 12 frontmatter source refs |
| diagnostics | 0 |

No role document is created by this pass. Missing roles remain absence metadata until a concrete rule, cases, test, memo, knowledge note, PRD markdown, or ralph PRD JSON artifact exists.

다음 작업은 실행 효과와 의존성 기준으로 정렬한다.

1. **Deterministic Label Registry And FSM Control Plane**
   - Move the control-plane center below PRD/TODO convenience artifacts into semantic coordinates, label records, FSM readiness, and transition-controller dry-runs.
   - Depends on completed docs graph, source-map, topdown lifecycle inventory, pack authoring, completed-record lifecycle, and graph reranking read models.
   - Plan: `deterministic-label-registry-fsm-plan`; TODO: `deterministic-label-registry-fsm-todo`.
2. **PRD Completion Sync Precision**
   - Improve `sync-completion` scoring after deterministic labels/FSM readiness can distinguish transition evidence from execution artifacts.
3. **Section-Level Graph Nodes**
   - Add section-level traversal only after document-level source/evidence/role traversal and deterministic label boundaries are stable.
4. **Completed Record Cleanup Workflow**
   - Decide whether completed TODO/PRD records stay as evidence, move to archive, or convert to memo through an explicit write workflow.
5. **Pack Validate Strict Readiness**
   - Promote readiness warnings to strict-mode failures only after label/FSM readiness rules define which gates are required for ACTIVE state.

## 운영 기준 ^constraint

- `docs-control-plane.spec.md` records current implemented behavior only.
- `docs-control-plane.todo.md` owns executable follow-up tasks.
- New implementation PRDs should consume this plan and close one roadmap item at a time.
- `qa-sdk docs` remains local CLI control plane; REST or remote document graph service stays out of scope.
