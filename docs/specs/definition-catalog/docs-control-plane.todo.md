---
def:
  tier: component
  id: docs-control-plane-todo
  type: knowledge
  knowledge_kind: proposal
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
      type: traces_to
sources:
  - packages/cli/src/commands/docs.ts
  - packages/cli/src/lib/docs-control-plane/completed-record-review.ts
  - packages/cli/src/lib/docs-control-plane/completed-record-cleanup-plan.ts
  - packages/cli/src/lib/docs-control-plane/completed-record-cleanup-apply.ts
---

# Docs Control Plane — TODO

## 목적 ^purpose

`qa-sdk docs` control plane의 남은 실행 작업을 추적한다. 목표는 cleanup workflow와 current source-map gap 정리까지 반영한 현재 기반 위에서 새 후속 작업이 생기면 그때만 다시 올리도록 유지하는 것이다.

## 경계

- 현재 구현된 behavior, command surface, read model shape는 `docs-control-plane.spec`이 소유한다.
- 운영/소비/리뷰/write authority 규칙은 `docs-control-plane.rule`이 소유한다.
- roadmap order와 이유는 `docs-control-plane.plan`이 소유한다.
- 이 TODO는 **남은 실행 작업만** 유지한다. 완료 히스토리는 여기에 누적하지 않는다.

## 실행 항목

### Actionable — 실행 가능

현재 즉시 실행 가능한 docs-control-plane follow-up은 없다. 남은 작업은 Deferred 또는 Parking Lot에서 관리한다.

### Deferred — 조건부 대기

현재 deferred docs-control-plane follow-up은 없다.

### Parking Lot — 후보 보관

현재 보관 중인 docs-control-plane follow-up은 없다.

새 아이디어성 작업은 실행 조건이나 owner가 정해질 때까지 Actionable로 승격하지 않는다.
