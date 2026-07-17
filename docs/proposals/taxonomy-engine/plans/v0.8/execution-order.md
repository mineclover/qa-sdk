---
def:
  id: taxonomy-engine-plan-v0-8-execution-order
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: component
  depth: overview
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: plan-v0-8-execution-order
sources:
  - docs/proposals/taxonomy-engine/plans/v0.8.md
  - packages/taxonomy-engine/__tests__/unit/lifecycle-schema.test.ts
  - packages/taxonomy-engine/__tests__/unit/lifecycle-validate.test.ts
  - packages/taxonomy-engine/__tests__/unit/lifecycle-diff.test.ts
  - packages/cli/src/commands/taxonomy/validate.ts
  - packages/taxonomy-web/src/components/LifecycleBadge.tsx
---

# Taxonomy Engine v0.8 — 실행 순서

## 목적 ^purpose

v0.8 실행 순서 원문을 보존한다.

## 실행 순서

```
A (schema/IR/parser) — 기반
  ↓
B (validate) ← A
  ↓
C (diff) ← A (병렬 가능)
  ↓
D (CLI) ← B
  ↓
E (doctor) ← A (병렬 가능)
  ↓
F (Web UI) ← A (병렬 가능, 단 D 끝나면 통합 시험)
  ↓
G (도그푸딩) ← B + D 통과
  ↓
H (문서)
```

A 완료 후 B/C/E/F 병렬 가능. G는 모든 코드 변경 후. H는 마지막.
