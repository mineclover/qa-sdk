---
def:
  id: taxonomy-engine-plan-v0-8-phase-f
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: component
  depth: implementation
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: plan-v0-8-phase-f-web-ui
sources:
  - packages/taxonomy-web/src/components/LifecycleBadge.tsx
  - packages/taxonomy-web/src/components/TaxonomyTree.tsx
  - packages/taxonomy-web/src/components/UnitDetailPanel.tsx
  - packages/taxonomy-web/src/types/taxonomy.ts
  - scripts/taxonomy-web-build-data.mjs
---

# Taxonomy Engine v0.8 — Phase F — Web UI

## 목적 ^purpose

v0.8 Phase F taxonomy-web UI 계획 원문을 보존한다.

## Phase F — Web UI

### Task F1: LifecycleBadge 컴포넌트 + Tree/UnitDetail 통합

**Files:**
- Create: `packages/taxonomy-web/src/components/LifecycleBadge.tsx`
- Modify: `packages/taxonomy-web/src/components/TaxonomyTree.tsx`
- Modify: `packages/taxonomy-web/src/components/UnitDetailPanel.tsx`
- Modify: `packages/taxonomy-web/src/types/taxonomy.ts` (pre-compute IR JSON type)
- Modify: `scripts/taxonomy-web-build-data.mjs` (lifecycle 포함하여 출력)

- [ ] **Step 1: LifecycleBadge 컴포넌트** — 6 값 색상 매핑

```tsx
import type { Lifecycle } from "../types/taxonomy";

const STYLE: Record<Lifecycle, string> = {
  draft:      "bg-blue-100 text-blue-700",
  review:     "bg-amber-100 text-amber-700",
  approved:   "bg-green-100 text-green-700",
  deprecated: "bg-gray-200 text-gray-600",
  archived:   "bg-gray-700 text-white",
  tbd:        "bg-red-100 text-red-700 border border-dashed border-red-400",
};

export function LifecycleBadge({ value }: { value?: Lifecycle }) {
  if (!value) return <span className="text-xs text-gray-400">(미지정)</span>;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${STYLE[value]}`}>
      {value}
    </span>
  );
}
```

- [ ] **Step 2: scripts/taxonomy-web-build-data.mjs**에서 entry/axis에 lifecycle/placeholderReason/decisionLink 포함하여 JSON 출력.

- [ ] **Step 3: TaxonomyTree.tsx**에서 entry 옆에 `<LifecycleBadge>` 표시.

- [ ] **Step 4: UnitDetailPanel.tsx**에서 lifecycle + placeholderReason + decisionLink 섹션 추가.

- [ ] **Step 5: filter UI** — sidebar에 lifecycle 필터 (체크박스 6개, 기본 모두 선택).

- [ ] **Step 6: build:data + 빌드 통과 확인 + commit**

```bash
pnpm --filter @qa-sdk/taxonomy-web build
git add packages/taxonomy-web/src/ scripts/taxonomy-web-build-data.mjs
git commit -m "feat(taxonomy-web): LifecycleBadge + filter + UnitDetail lifecycle 표시"
```

---
