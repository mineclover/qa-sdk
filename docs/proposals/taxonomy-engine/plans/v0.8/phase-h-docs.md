---
def:
  id: taxonomy-engine-plan-v0-8-phase-h
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: implementation_plan
  tier: component
  depth: implementation
  sources:
    - docs/proposals/taxonomy-engine/concepts/diagnostics-catalog.md
    - docs/proposals/taxonomy-engine/concepts/README.md
    - docs/proposals/taxonomy-engine/concepts/entry.md
    - docs/proposals/taxonomy-engine/concepts/lifecycle.md
    - packages/taxonomy-engine/src/schema/diagnostic.ts
    - packages/taxonomy-engine/src/validate/lifecycle.ts
    - packages/taxonomy-engine/__tests__/unit/lifecycle-validate.test.ts
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: plan-v0-8-phase-h-docs
---

# Taxonomy Engine v0.8 — Phase H — 문서 마무리

## 목적 ^purpose

v0.8 Phase H 문서 마무리 계획 원문을 보존한다.

## Phase H — 문서 마무리

### Task H1: diagnostics-catalog 갱신 + concepts/README 링크

**Files:**
- Modify: `docs/proposals/taxonomy-engine/concepts/diagnostics-catalog.md`
- Modify: `docs/proposals/taxonomy-engine/concepts/README.md`
- Modify: `docs/proposals/taxonomy-engine/concepts/entry.md` (lifecycle 참조 추가)

- [ ] **Step 1: diagnostics-catalog.md에 4 신규 diagnostic 추가** (lifecycle 섹션).

- [ ] **Step 2: concepts/README.md에 lifecycle.md 링크 추가**.

- [ ] **Step 3: entry.md 구조 표에 lifecycle/placeholderReason/decisionLink 행 추가** + lifecycle.md 링크.

- [ ] **Step 4: commit**

```bash
git add docs/proposals/taxonomy-engine/concepts/
git commit -m "docs(taxonomy-engine): lifecycle diagnostics + concept cross-links"
```

---
