---
def:
  id: docs-control-plane-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: cli
  tags: [structural, testing, contract]
  links:
    - target: docs-control-plane
      type: traces_to
    - target: docs-control-plane-plan
      type: refines
---

# Docs Control Plane — TODO

## 목적 ^purpose

`qa-sdk docs` control plane의 남은 실행 작업을 추적한다. 목표는 완료된 adapter/graph traversal 기반 위에서 source-map coverage, pack authoring, graph ranking/filtering, PRD completion sync precision, section-level graph를 순차적으로 닫는 것이다.

## 구현 항목

- [ ] Document Source Map Coverage Expansion
  - [ ] docs-control-plane source files coverage
  - [ ] ontology CLI split module coverage
  - [ ] operational/authorization pack source coverage
  - [ ] `qa-sdk docs graph <source-path> --axis source --direction in` returns related docs/evidence for selected targets
  - [ ] `qa-sdk def find-by-file <source-path>` returns explicit mappings where authoritative source-map is available
  - [ ] source-map gaps remain explicit TODOs instead of broad graph fallback

- [ ] Ontology Pack Authoring Control Plane
  - [ ] pack scaffold command
  - [ ] pack validate command
  - [ ] docs family scaffold: spec/todo/plan/rule/test/memo
  - [ ] known pack registration candidate generation
  - [ ] source-map candidate generation for generated pack files

- [ ] Graph Result Ranking And Filtering
  - [ ] rank by axis, edge reason, role, and path distance
  - [ ] filter by role/kind/axis/diagnostic
  - [ ] context axis ranking
  - [ ] graph output summarization for large results

- [ ] PRD Completion Sync Precision
  - [ ] graph-axis based candidate scoring
  - [ ] `--strict`
  - [ ] `--family-only`
  - [ ] `--evidence-only`
  - [ ] blocked promotion explanation improvements

- [ ] Section-Level Graph Nodes
  - [ ] purpose/overview/constraint/scenario matrix section nodes
  - [ ] section-level evidence mapping
  - [ ] section-level traversal presets if needed
