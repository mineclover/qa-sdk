---
def:
  id: taxonomy-engine-plan-v0-8-open-decisions
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: implementation_plan
  tier: component
  depth: overview
  sources:
    - packages/taxonomy-engine/src/validate/lifecycle.ts
    - packages/taxonomy-engine/__tests__/unit/lifecycle-validate.test.ts
    - docs/taxonomies/lesson-builder-content.yaml
    - packages/taxonomy-web/src/components/LifecycleBadge.tsx
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: plan-v0-8-open-decisions
---

# Taxonomy Engine v0.8 — 미결 (구현 중 결정)

## 목적 ^purpose

v0.8 구현 중 결정할 미결 항목 원문을 보존한다.

## 미결 (구현 중 결정)

- lesson-builder yaml의 정확한 tbd entries — 사용자 정리 텍스트 기반 추정. 마이그레이션 PR 리뷰 시 확정
- `lifecycle-tbd-orphan`을 warning으로 올릴지 — Stage 1은 info, 사용자 피드백 후 결정
- `placeholderReason` 최대 길이 제한 — Stage 1 미적용 (UI에서 truncate)
