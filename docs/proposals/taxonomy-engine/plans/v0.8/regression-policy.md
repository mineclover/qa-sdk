---
def:
  id: taxonomy-engine-plan-v0-8-regression-policy
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: implementation_plan
  tier: component
  depth: validation
  sources:
    - packages/taxonomy-engine/package.json
    - packages/taxonomy-engine/__tests__/unit/lifecycle-schema.test.ts
    - packages/taxonomy-engine/__tests__/unit/lifecycle-validate.test.ts
    - packages/taxonomy-engine/__tests__/unit/lifecycle-diff.test.ts
    - packages/cli/src/commands/taxonomy/validate.ts
    - packages/taxonomy-web/package.json
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: plan-v0-8-regression-policy
---

# Taxonomy Engine v0.8 — 회귀 정책

## 목적 ^purpose

v0.8 회귀 정책 원문을 보존한다.

## 회귀 정책

- 매 task 후 `pnpm --filter taxonomy-engine test` 통과
- D 후 `pnpm --filter @qa-sdk/cli test`
- F 후 `pnpm --filter @qa-sdk/taxonomy-web build`
- G 후 `pnpm tax:ci` (전체 게이트)
