---
def:
  id: taxonomy-engine-plan-v0-8-phase-g
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: implementation_plan
  tier: component
  depth: implementation
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: plan-v0-8-phase-g-dogfooding
sources:
  - docs/taxonomies/qa-sdk-coordinate-system.yaml
  - docs/taxonomies/lesson-builder-content.yaml
  - docs/taxonomies/dkg-schema.yaml
  - docs/taxonomies/ingest-coords.yaml
  - docs/taxonomies/qa-sdk-def-catalog.yaml
  - scripts/tax-add-lifecycle.mjs
  - packages/taxonomy-engine/__tests__/dogfooding-def-catalog.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-dkg.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-ingest.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-lesson-builder.test.ts
---

# Taxonomy Engine v0.8 — Phase G — 도그푸딩 마이그레이션

## 목적 ^purpose

v0.8 Phase G dogfooding migration 계획 원문을 보존한다.

## Phase G — 도그푸딩 마이그레이션

### Task G1: 5 yaml에 lifecycle 부여

**Files:**
- Modify: `docs/taxonomies/qa-sdk-coordinate-system.yaml`
- Modify: `docs/taxonomies/lesson-builder-content.yaml`
- Modify: `docs/taxonomies/dkg-schema.yaml`
- Modify: `docs/taxonomies/ingest-coords.yaml`
- Modify: `docs/taxonomies/qa-sdk-def-catalog.yaml`

- [ ] **Step 1: 각 yaml의 모든 entry에 lifecycle 부여**
  - qa-sdk-coordinate-system: 거의 다 `approved` (안정 좌표계)
  - lesson-builder-content: 사용자 roadmap §케이스 매핑 따라 일부 `tbd` + placeholderReason 부여
    - `cue`: `tbd`, reason: "interaction 정의 미정 — beat과의 경계 결정 필요"
    - `branch`: `tbd`, reason: "분기 처리 vs cue 경계 미정"
    - `beat`: `tbd`, decisionLink: "../proposals/lesson-builder/decisions/beat-consumption-layer.md" (파일 없으면 일단 placeholderReason만)
    - 나머지: `approved`
  - dkg-schema, ingest-coords, qa-sdk-def-catalog: `approved`

- [ ] **Step 2: `pnpm tax:ci`로 회귀 확인**

```bash
pnpm tax:ci
```

기대: lifecycle-missing warning 0건. tbd info 3건 (lesson-builder만).

- [ ] **Step 3: codegen drift 갱신 확인** — lifecycle 추가로 contentHash 변화. `pnpm tax:codegen` 다시 실행하여 dist 동기화.

```bash
pnpm tax:codegen
```

- [ ] **Step 4: commit**

```bash
git add docs/taxonomies/*.yaml packages/taxonomy-engine-out/  # codegen 출력 경로
git commit -m "chore(taxonomies): assign lifecycle to all entries (lesson-builder: 3 tbd)"
```

---
