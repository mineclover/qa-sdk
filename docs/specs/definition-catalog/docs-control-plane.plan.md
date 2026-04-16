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

현재 완료된 기반은 docs control plane adapters, status/collect/search/drift, PRD authoring/conversion/sync dry-run, metadata transform dry-run, and document coordinate graph traversal이다.

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
