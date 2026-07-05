---
def:
  id: work-lifecycle-plan
  type: spec
  tier: system
  level: leaf
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: draft
  layer: operation
  tags: [structural, roadmap, testing]
  links:
    - target: work-lifecycle
      type: traces_to
    - target: work-topic-schema-plan
      type: depends_on
    - target: scenario-authoring-guide
      type: traces_to
  sources:
    - docs/specs/system/work-lifecycle.spec.md
    - docs/specs/system/work-lifecycle.cases.md
    - packages/cli/src/lib/docs-control-plane/work-topic-extract.ts
    - packages/cli/src/lib/docs-control-plane/completed-record-review.ts
    - packages/cli/src/lib/docs-control-plane/completed-record-cleanup-plan.ts
    - packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts
---

# Work Lifecycle — Roadmap Plan

## 목적 ^purpose

`work-lifecycle` 표준을 코드/문서 control-plane에 어떤 순서로 기계화할지 기록한다. 이 문서는 lifecycle authority 자체를 재정의하지 않고, `work-lifecycle` spec 위에서 후속 실행 순서만 소유한다.

## 구성 ^overview

현재 닫힌 기반:

- `work-lifecycle`이 artifact authority와 표준 loop를 소유한다.
- `work-topic-schema-plan`이 `work_topic` shape와 split heuristic을 소유한다.
- `docs status`는 lifecycle summary, work topic readiness, prune candidate를 read-only로 노출한다.
- BDD contract family는 `docs bdd list|validate|units|compile|test-plan|impl-plan`로 조회할 수 있다.

## 다음 단계

1. **Work topic accepted spec 승격**
   - `work-topic-schema-plan`의 shape를 accepted spec 또는 rule로 승격할지 결정한다.
   - field dictionary와 validation severity owner를 확정한다.
2. **Lifecycle warning integration**
   - stale rules, assimilation readiness, todo prune candidate를 warning-first validation으로 연결한다.
   - hard error 전환은 별도 accepted spec 이후 결정한다.
3. **Guide alignment**
   - `bdd-contract`, `e2e-test`, `spec-lifecycle` skill/guide가 `work-lifecycle` authority를 반복하지 않고 참조하게 유지한다.

## 비목표

- todo 자동 삭제
- spec 자동 승격
- LLM/DSPy가 lifecycle truth를 결정
- hidden write command 추가

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/cli test -- docs
node packages/cli/dist/index.js def validate
```
