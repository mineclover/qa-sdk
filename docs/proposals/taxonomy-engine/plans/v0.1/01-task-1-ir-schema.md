# Taxonomy Engine v0.1 — Task 1: IR + Diagnostic 타입 + zod schema

## 목적 ^purpose

v0.1의 IR, Diagnostic, zod schema 구현 작업 원문을 보존한다.

## Task 1: IR + Diagnostic 타입 + zod schema

**Files:**
- Create: `packages/taxonomy-engine/src/schema/ir.ts`
- Create: `packages/taxonomy-engine/src/schema/diagnostic.ts`
- Create: `packages/taxonomy-engine/src/schema/zod.ts`
- Create: `packages/taxonomy-engine/__tests__/unit/schema.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/unit/schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { TaxonomyDocSchema } from "../../src/schema/zod.js";

describe("TaxonomyDocSchema", () => {
  it("유효한 최소 yaml 객체를 파싱한다", () => {
    const doc = {
      taxonomy: "test",
      version: 1,
      axes: { scope: { entries: ["apm", "ingest"] } },
    };
    const result = TaxonomyDocSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });

  it("axes 누락 시 실패한다", () => {
    const result = TaxonomyDocSchema.safeParse({ taxonomy: "t", version: 1 });
    expect(result.success).toBe(false);
  });

  it("entries가 비어있으면 실패한다", () => {
    const result = TaxonomyDocSchema.safeParse({
      taxonomy: "t",
      version: 1,
      axes: { scope: { entries: [] } },
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter taxonomy-engine test schema.test`
Expected: FAIL — `TaxonomyDocSchema` 없음

- [ ] **Step 3: IR 타입 정의**

`src/schema/ir.ts`:

```typescript
export type Severity = "error" | "warning" | "info";

export type RelationKind =
  | "contains"
  | "parent-of"
  | "depends-on"
  | "binds"
  | "projects-to";

export type ConstraintKind = "capacity" | "structural" | "ref" | "custom";

export type EntryIR = {
  id: string;
  address: number;
  label?: string;
  meta?: Record<string, unknown>;
  _loc?: { line: number; column: number };
};

export type AxisIR = {
  name: string;
  description?: string;
  entries: EntryIR[];
  capacity: number;
  version: number;
  _loc?: { line: number; column: number };
};

export type RelationRule = Record<string, string>;

export type RelationIR = {
  name: string;
  from: string[];
  to: string[];
  kind: RelationKind;
  rules: RelationRule[];
  _loc?: { line: number; column: number };
};

export type ConstraintIR = {
  id: string;
  kind: ConstraintKind;
  rule: string;
  severity: Severity;
  _loc?: { line: number; column: number };
};

export type ImportIR = {
  taxonomy: string;
  version?: number;
  as: string;
};

export type TaxonomyIR = {
  taxonomy: string;
  version: number;
  description?: string;
  contentHash: string;
  axes: Map<string, AxisIR>;
  relations: Map<string, RelationIR>;
  constraints: ConstraintIR[];
  imports: ImportIR[];
};

export type Coordinate = Record<string, string>;
```

- [ ] **Step 4: Diagnostic 타입**

`src/schema/diagnostic.ts`:

```typescript
import type { Severity } from "./ir.js";

export type DiagnosticCode =
  | `parse-${string}`
  | `structural-${string}`
  | `capacity-${string}`
  | `ref-${string}`
  | `constraint-${string}`
  | `axis-5q-${string}`
  | `version-${string}`
  | `codegen-${string}`;

export type Diagnostic = {
  severity: Severity;
  code: DiagnosticCode;
  message: string;
  ref?: string;
  location?: { file?: string; line?: number; column?: number };
  hint?: string;
  meta?: Record<string, unknown>;
};
```

- [ ] **Step 5: zod schema (yaml 입력)**

`src/schema/zod.ts`:

```typescript
import { z } from "zod";

const EntrySchema = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1),
    address: z.number().int().nonnegative().optional(),
    label: z.string().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  }),
]);

const AxisSchema = z.object({
  description: z.string().optional(),
  entries: z.array(EntrySchema).min(1, "entries는 최소 1개 필요"),
  capacity: z.number().int().positive().optional(),
  version: z.number().int().positive().optional(),
});

const RelationSchema = z.object({
  from: z.union([z.string(), z.array(z.string()).min(1)]),
  to: z.union([z.string(), z.array(z.string()).min(1)]),
  kind: z.enum(["contains", "parent-of", "depends-on", "binds", "projects-to"]),
  rules: z.array(z.record(z.string(), z.string())).default([]),
});

const ConstraintSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["capacity", "structural", "ref", "custom"]),
  rule: z.string().min(1),
  severity: z.enum(["error", "warning", "info"]).default("error"),
});

const ImportSchema = z.object({
  taxonomy: z.string().min(1),
  version: z.number().int().positive().optional(),
  as: z.string().min(1),
});

export const TaxonomyDocSchema = z.object({
  taxonomy: z.string().min(1),
  version: z.number().int().positive(),
  description: z.string().optional(),
  imports: z.array(ImportSchema).default([]),
  axes: z.record(z.string(), AxisSchema).refine(
    (axes) => Object.keys(axes).length >= 1,
    "axes는 최소 1개 필요"
  ),
  relations: z.record(z.string(), RelationSchema).default({}),
  constraints: z.array(ConstraintSchema).default([]),
});

export type TaxonomyDoc = z.infer<typeof TaxonomyDocSchema>;
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `pnpm --filter taxonomy-engine test schema.test`
Expected: 3 passed

- [ ] **Step 7: 커밋**

```bash
git add packages/taxonomy-engine/src/schema packages/taxonomy-engine/__tests__/unit/schema.test.ts
git commit -m "feat(taxonomy-engine): IR + Diagnostic types + zod schema (Task 1)"
```

---
