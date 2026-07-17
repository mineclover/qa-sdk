---
def:
  id: taxonomy-engine-plan-v0-8-non-goals
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
role: plan-v0-8-non-goals
sources:
  - docs/proposals/taxonomy-engine/plans/v0.9.md
  - docs/proposals/taxonomy-engine/plans/v0.10.md
  - packages/taxonomy-engine/src/migration/index.ts
  - packages/taxonomy-decision-bridge/src/index.ts
  - packages/taxonomy-web/src/components/decision/DecisionFilePicker.tsx
---

# Taxonomy Engine v0.8 — 비-목표

## 목적 ^purpose

v0.8 비목표 원문을 보존한다.

## 비-목표

- Stage 2 (semver diff, migration helper, git base 비교) — v0.9
- Stage 3 (decision-flow 양방향 sync) — 별도 spec
- `lifecycle-transition-invalid` (git base 비교) — Stage 2와 함께 (이 라운드 schema 신규 코드만)
- decisionLink fetch (URI) — 형식만 검증
- Web UI 시각화 고급 (chain, timeline) — Stage 3
