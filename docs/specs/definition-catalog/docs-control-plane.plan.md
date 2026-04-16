---
def:
  id: docs-control-plane-plan
  level: leaf
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

현재 완료된 기반은 docs control plane adapters, status/collect/search/drift, PRD authoring/conversion/sync dry-run, metadata transform dry-run, document coordinate graph traversal, family-only inventory scope, and topdown lifecycle inventory policy이다.

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
3. Read same-family role documents next: spec, plan, todo, rule, test, memo, knowledge, active PRD markdown, and active ralph PRD JSON.
4. Inspect direct leaf documents and source/evidence references last as proof, not as inventory roots.

Operationally, use `docs status <root> --json` or `docs collect <root> --family-only --json` for the active family first. Use broad graph traversal only after the family boundary is understood, and never promote archive/session results into active scope without an explicit target or opt-in flag.

다음 작업은 실행 효과와 의존성 기준으로 정렬한다.

1. **Document Source Map Coverage Expansion**
   - Graph traversal can resolve source paths, but many source paths still report `source-map-missing`.
   - Increase frontmatter `source:` and optional `@def.doc` coverage only where it improves bottom-up impact analysis.
2. **Ontology Pack Authoring Control Plane**
   - New packs should create code skeletons and docs family skeletons together.
   - Depends on source-map conventions so generated packs are immediately discoverable by docs graph.
3. **Graph Result Ranking And Filtering**
   - Once graph edges are richer, operators need ranking and filters by axis, role, kind, reason, and diagnostics.
4. **PRD Completion Sync Precision**
   - Improve `sync-completion` scoring after source/evidence coverage and graph ranking are stronger.
5. **Section-Level Graph Nodes**
   - Add section-level traversal only after document-level source/evidence/role traversal is stable.

## 운영 기준 ^constraint

- `docs-control-plane.spec.md` records current implemented behavior only.
- `docs-control-plane.todo.md` owns executable follow-up tasks.
- New implementation PRDs should consume this plan and close one roadmap item at a time.
- `qa-sdk docs` remains local CLI control plane; REST or remote document graph service stays out of scope.
