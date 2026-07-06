---
def:
  id: taxonomy-engine-plan-v0-8-phase-c
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
role: plan-v0-8-phase-c-diff
sources:
  - packages/taxonomy-engine/src/diff/index.ts
  - packages/taxonomy-engine/__tests__/unit/lifecycle-diff.test.ts
---

# Taxonomy Engine v0.8 — Phase C — Diff 신규 kind

## 목적 ^purpose

v0.8 Phase C lifecycle diff 계획 원문을 보존한다.

## Phase C — Diff 신규 kind

### Task C1: `entry-lifecycle-changed` DiffEntry

**Files:**
- Modify: `packages/taxonomy-engine/src/diff/index.ts`
- Create: `packages/taxonomy-engine/test/diff-lifecycle.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { describe, expect, it } from "vitest";
import { parse } from "../src/parser/index.js";
import { diff } from "../src/diff/index.js";

function ir(y: string) {
  const r = parse(y);
  if (!("ir" in r)) throw new Error();
  return r.ir;
}

describe("diff lifecycle", () => {
  it("entry lifecycle 변경 감지", () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: tbd }]`);
    const b = ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: approved }]`);
    const changes = diff(a, b).changes.filter((c) => c.kind === "entry-lifecycle-changed");
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "entry-lifecycle-changed", axis: "a", id: "x", from: "tbd", to: "approved" });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**.

- [ ] **Step 3: DiffEntry union에 추가** — `diff/index.ts`:

```typescript
export type DiffEntry =
  // 기존 12-13 kinds
  | { kind: "entry-lifecycle-changed"; axis: string; id: string; from?: string; to?: string };
```

- [ ] **Step 4: entries 비교 루프에 lifecycle/placeholderReason/decisionLink 비교 추가** — entry id 매칭된 후:

```typescript
if (aEntry.lifecycle !== bEntry.lifecycle) {
  changes.push({
    kind: "entry-lifecycle-changed",
    axis: axisName,
    id: aEntry.id,
    from: aEntry.lifecycle,
    to: bEntry.lifecycle,
  });
}
```

- [ ] **Step 5: 테스트 통과 + commit**

```bash
pnpm --filter taxonomy-engine test
git add packages/taxonomy-engine/src/diff/index.ts packages/taxonomy-engine/test/diff-lifecycle.test.ts
git commit -m "feat(taxonomy-engine): add entry-lifecycle-changed diff kind"
```

---
