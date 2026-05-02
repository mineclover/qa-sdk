---
def:
  tier: component
  id: docs-control-plane-plan
  type: spec
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: draft
  layer: mediation
  svc: cli
  tags: [structural, roadmap, testing]
  links:
    - target: docs-control-plane
      type: traces_to
    - target: docs-control-plane-todo
      type: traces_to
---

# Docs Control Plane — Roadmap Plan

## 목적 ^purpose

`qa-sdk docs` control plane의 후속 작업 순서와 이유를 기록한다. 목표는 adapter/read model, coordinate graph traversal, source-map coverage, pack authoring, ranking/filtering, PRD sync precision, cleanup workflow 이후 남은 후속 단계를 서로 겹치지 않는 실행 단계로 유지하는 것이다.

## 구성 ^overview

현재 완료된 기반과 운영 inventory/read-only policy는 `docs-control-plane.spec` / `docs-control-plane.rule`이 owner다. 이 plan은 그 기반 위에서 **무엇을 어떤 순서로 닫는가**만 기록한다.

다음 작업은 실행 효과와 의존성 기준으로 정렬한다.

1. **Deterministic Label Registry Read Model**
   - Move the control-plane center below PRD/TODO convenience artifacts into semantic coordinates and label records.
   - FSM readiness and transition-controller dry-runs were removed from `deterministic-label-registry` during the 2026-04-18 simplification; future state/event work must use `state-event-terminology`.
   - Depends on completed docs graph, source-map, topdown lifecycle inventory, pack authoring, completed-record lifecycle, and graph reranking read models.
   - Plan: `deterministic-label-registry-fsm-plan`; TODO: `deterministic-label-registry-fsm-todo`.
2. **Completed Record Cleanup Workflow**
   - Read-only review surface (`docs cleanup review`), dry-run planning surface (`docs cleanup plan`), bounded batch cleanup surfaces (`--all --recommended`, `--all --action-map` with override fields), single-target `--override`, and explicit write surfaces (`archive`, TODO/PRD `memo-conversion`, TODO `promote-spec`, `rewrite`) are implemented.
   - Moved-target body rewrite, rewrite assimilation-target update, templated path/body/frontmatter overrides, and repo/family/PRD batch preflight are implemented.
   - Additional generic rewrite DSL work is not an active roadmap item; if operators need action semantics beyond the current supported matrix + override fields, that work must start from a new explicit PRD.
3. **Pack Validate Strict Readiness**
   - Promote readiness warnings to strict-mode failures only after label/readiness rules define which gates are required for active use.

## 운영 기준 ^constraint

- `docs-control-plane.spec.md` records current implemented behavior only.
- `docs-control-plane.todo.md` owns executable follow-up tasks.
- New implementation PRDs should consume this plan and close one roadmap item at a time.
- `qa-sdk docs` remains local CLI control plane; REST or remote document graph service stays out of scope.
