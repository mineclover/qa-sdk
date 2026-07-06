---
def:
  id: taxonomy-engine-plan-v0-8-phase-a
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
    - packages/taxonomy-engine/src/schema/ir.ts
    - packages/taxonomy-engine/src/schema/zod.ts
    - packages/taxonomy-engine/src/parser/index.ts
    - packages/taxonomy-engine/__tests__/unit/lifecycle-schema.test.ts
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: plan-v0-8-phase-a-schema-parser-ir
---

# Taxonomy Engine v0.8 — Phase A — Schema + Parser + IR

## 목적 ^purpose

v0.8 Phase A schema/parser/IR 확장 계획 원문을 보존한다.

## Phase A — Schema + Parser + IR

### Task A1: IR 타입 + zod schema 확장

**Files:**
- Modify: `packages/taxonomy-engine/src/schema/ir.ts`
- Modify: `packages/taxonomy-engine/src/schema/zod.ts`
- Create: `packages/taxonomy-engine/test/schema-lifecycle.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — entry에 `lifecycle: "tbd"`/`placeholderReason`/`decisionLink` 가진 yaml이 parse 통과 + IR에 보존되는지

```typescript
import { describe, expect, it } from "vitest";
import { parse } from "../src/parser/index.js";

describe("lifecycle schema", () => {
  it("entry-level lifecycle/placeholderReason/decisionLink 보존", () => {
    const yaml = `
taxonomy: t
version: 1
axes:
  a:
    entries:
      - { id: x, address: 0, lifecycle: approved, decisionLink: "./d.md" }
      - { id: y, address: 1, lifecycle: tbd, placeholderReason: "미정" }
`;
    const result = parse(yaml);
    expect("ir" in result).toBe(true);
    if (!("ir" in result)) throw new Error();
    const a = result.ir.axes.get("a")!;
    expect(a.entries[0].lifecycle).toBe("approved");
    expect(a.entries[0].decisionLink).toBe("./d.md");
    expect(a.entries[1].lifecycle).toBe("tbd");
    expect(a.entries[1].placeholderReason).toBe("미정");
  });

  it("axis-level lifecycle 보존", () => {
    const yaml = `
taxonomy: t
version: 1
axes:
  a:
    lifecycle: review
    entries: [x]
`;
    const result = parse(yaml);
    if (!("ir" in result)) throw new Error();
    expect(result.ir.axes.get("a")!.lifecycle).toBe("review");
  });

  it("lifecycle 없이도 valid (optional)", () => {
    const yaml = `
taxonomy: t
version: 1
axes:
  a:
    entries: [x]
`;
    const result = parse(yaml);
    expect("ir" in result).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인** — `pnpm --filter taxonomy-engine test schema-lifecycle`. 예상: 실패 (lifecycle 필드 없음).

- [ ] **Step 3: IR 타입 확장** — `ir.ts`:

```typescript
export type Lifecycle = "draft" | "review" | "approved" | "deprecated" | "archived" | "tbd";

export type EntryIR = {
  id: string;
  address: number;
  label?: string;
  meta?: Record<string, unknown>;
  lifecycle?: Lifecycle;
  placeholderReason?: string;
  decisionLink?: string;
  _loc?: { line: number; column: number };
};

export type AxisIR = {
  name: string;
  description?: string;
  entries: EntryIR[];
  capacity: number;
  version: number;
  lifecycle?: Lifecycle;
  _loc?: { line: number; column: number };
};
```

- [ ] **Step 4: zod schema 확장** — `zod.ts`:

```typescript
const LifecycleSchema = z.enum([
  "draft", "review", "approved", "deprecated", "archived", "tbd",
]);

const EntrySchema = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1),
    address: z.number().int().nonnegative().optional(),
    label: z.string().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    lifecycle: LifecycleSchema.optional(),
    placeholderReason: z.string().optional(),
    decisionLink: z.string().min(1).optional(),
  }),
]);

const AxisSchema = z.object({
  description: z.string().optional(),
  entries: z.array(EntrySchema).min(1, "entries는 최소 1개 필요"),
  capacity: z.number().int().positive().optional(),
  version: z.number().int().positive().optional(),
  lifecycle: LifecycleSchema.optional(),
});
```

- [ ] **Step 5: parser buildIR 확장** — `parser/index.ts` `buildIR()`에서 entry/axis lifecycle 필드 IR로 전달.

```typescript
// entries.map 안에
return {
  id, address, label, meta,
  lifecycle: typeof e === "string" ? undefined : e.lifecycle,
  placeholderReason: typeof e === "string" ? undefined : e.placeholderReason,
  decisionLink: typeof e === "string" ? undefined : e.decisionLink,
  _loc: locs.get(`axes.${name}.entries.${i}`),
};

// axes.set 안에
axes.set(name, {
  name, description: axis.description, entries, capacity,
  version: axis.version ?? 1,
  lifecycle: axis.lifecycle,
  _loc: locs.get(`axes.${name}`),
});
```

- [ ] **Step 6: contentHash 입력 갱신 확인** — `computeHash` 호출은 `doc.axes` 전체를 받으므로 lifecycle/placeholderReason/decisionLink 변경이 hash에 반영되는지 한 줄 테스트 추가.

```typescript
it("lifecycle 변경 시 contentHash 변화", () => {
  const a = parse(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: draft }]`);
  const b = parse(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: approved }]`);
  if (!("ir" in a) || !("ir" in b)) throw new Error();
  expect(a.ir.contentHash).not.toBe(b.ir.contentHash);
});
```

- [ ] **Step 7: 테스트 통과 확인 + commit**

```bash
pnpm --filter taxonomy-engine test
git add packages/taxonomy-engine/src/schema/ir.ts \
        packages/taxonomy-engine/src/schema/zod.ts \
        packages/taxonomy-engine/src/parser/index.ts \
        packages/taxonomy-engine/test/schema-lifecycle.test.ts
git commit -m "feat(taxonomy-engine): add lifecycle/placeholderReason/decisionLink to IR"
```

---
