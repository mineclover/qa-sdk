# Taxonomy Engine v0.1 — Task 6: Validator (capacity / ref / constraint / axis-5q)

## 목적 ^purpose

v0.1의 capacity/ref/constraint/axis-5q validator 작업 원문을 보존한다.

## Task 6: Validator (capacity / ref / constraint / axis-5q)

**Files:**
- Create: `packages/taxonomy-engine/src/validate/index.ts`
- Create: `packages/taxonomy-engine/src/validate/capacity.ts`
- Create: `packages/taxonomy-engine/src/validate/ref.ts`
- Create: `packages/taxonomy-engine/src/validate/constraint.ts`
- Create: `packages/taxonomy-engine/src/validate/axis5q.ts`
- Create: `packages/taxonomy-engine/__tests__/fixtures/capacity-headroom.yaml`
- Create: `packages/taxonomy-engine/__tests__/fixtures/capacity-headroom.golden.json`
- Create: `packages/taxonomy-engine/__tests__/fixtures/ref-broken.yaml`
- Create: `packages/taxonomy-engine/__tests__/fixtures/ref-broken.golden.json`
- Create: `packages/taxonomy-engine/__tests__/unit/validate.test.ts`

- [ ] **Step 1: fixture yaml + golden 작성**

`__tests__/fixtures/capacity-headroom.yaml`:

```yaml
taxonomy: cap-bad
version: 1
axes:
  scope:
    entries: [a, b, c, d]
    capacity: 4
```

`__tests__/fixtures/capacity-headroom.golden.json`:

```json
[
  {
    "severity": "warning",
    "code": "capacity-headroom",
    "message": "axes/scope: entries=4, capacity=4 (need >= 8)",
    "ref": "cap-bad#/axes/scope",
    "meta": { "entries": 4, "capacity": 4, "minRecommended": 8 }
  }
]
```

`__tests__/fixtures/ref-broken.yaml`:

```yaml
taxonomy: ref-bad
version: 1
axes:
  scope:
    entries: [a, b]
  aspect:
    entries: [x, y]
relations:
  scope-contains:
    from: scope
    to: scope
    kind: contains
    rules:
      - { upper: a, lower: missing }
```

`__tests__/fixtures/ref-broken.golden.json`:

```json
[
  {
    "severity": "error",
    "code": "ref-broken",
    "message": "relations/scope-contains/rules/0: lower=\"missing\" — axes/scope/entries에 없음",
    "ref": "ref-bad#/relations/scope-contains/rules/0",
    "meta": { "axis": "scope", "missing": "missing", "field": "lower" }
  }
]
```

- [ ] **Step 2: 실패하는 테스트 작성**

`__tests__/unit/validate.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validate } from "../../src/validate/index.js";
import { parse } from "../../src/parser/index.js";

const FIX = join(__dirname, "../fixtures");

function loadFixture(name: string) {
  const yaml = readFileSync(join(FIX, `${name}.yaml`), "utf8");
  const golden = JSON.parse(readFileSync(join(FIX, `${name}.golden.json`), "utf8"));
  return { yaml, golden };
}

describe("validate", () => {
  it("capacity-headroom warning 검출", () => {
    const { yaml, golden } = loadFixture("capacity-headroom");
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error("parse failed");
    const diags = validate(r.ir);
    expect(stripLoc(diags)).toEqual(golden);
  });

  it("ref-broken error 검출", () => {
    const { yaml, golden } = loadFixture("ref-broken");
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error("parse failed");
    const diags = validate(r.ir);
    expect(stripLoc(diags)).toEqual(golden);
  });

  it("fail-collect — 여러 진단을 한 번에 반환", () => {
    const yaml = `
taxonomy: multi
version: 1
axes:
  scope:
    entries: [a, b, c, d]
    capacity: 4
relations:
  r:
    from: scope
    to: scope
    kind: contains
    rules:
      - { upper: a, lower: missing }
`;
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const diags = validate(r.ir);
    const codes = diags.map((d) => d.code).sort();
    expect(codes).toContain("capacity-headroom");
    expect(codes).toContain("ref-broken");
  });
});

function stripLoc(diags: unknown[]): unknown[] {
  return diags.map((d) => {
    const { location, ...rest } = d as Record<string, unknown>;
    return rest;
  });
}
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm --filter taxonomy-engine test validate.test`
Expected: FAIL

- [ ] **Step 4: capacity 검증 구현**

`src/validate/capacity.ts`:

```typescript
import type { TaxonomyIR } from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";

export function validateCapacity(ir: TaxonomyIR): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [name, axis] of ir.axes) {
    const min = axis.entries.length * 2;
    if (axis.capacity < min) {
      out.push({
        severity: "warning",
        code: "capacity-headroom",
        message: `axes/${name}: entries=${axis.entries.length}, capacity=${axis.capacity} (need >= ${min})`,
        ref: `${ir.taxonomy}#/axes/${name}`,
        meta: {
          entries: axis.entries.length,
          capacity: axis.capacity,
          minRecommended: min,
        },
      });
    }
    if (axis.entries.length > axis.capacity) {
      out.push({
        severity: "error",
        code: "capacity-overflow",
        message: `axes/${name}: entries=${axis.entries.length} > capacity=${axis.capacity}`,
        ref: `${ir.taxonomy}#/axes/${name}`,
        meta: { entries: axis.entries.length, capacity: axis.capacity },
      });
    }
  }
  return out;
}
```

- [ ] **Step 5: ref 검증 구현**

`src/validate/ref.ts`:

```typescript
import type { TaxonomyIR } from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";
import type { TaxonomyRegistry } from "../registry/index.js";

export function validateRefs(ir: TaxonomyIR, _registry?: TaxonomyRegistry): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [relName, rel] of ir.relations) {
    for (const [i, rule] of rel.rules.entries()) {
      for (const [field, entryId] of Object.entries(rule)) {
        // rel.from[0] / rel.to[0] 중 어느 axis에 속하는지 추정 (kind별 컨벤션)
        const axisName = inferAxis(rel, field);
        if (!axisName) continue;
        const axis = ir.axes.get(axisName);
        if (!axis) {
          out.push({
            severity: "error",
            code: "ref-broken",
            message: `relations/${relName}/rules/${i}: axis="${axisName}" 없음`,
            ref: `${ir.taxonomy}#/relations/${relName}/rules/${i}`,
            meta: { missing: axisName, field },
          });
          continue;
        }
        const exists = axis.entries.some((e) => e.id === entryId);
        if (!exists) {
          out.push({
            severity: "error",
            code: "ref-broken",
            message: `relations/${relName}/rules/${i}: ${field}="${entryId}" — axes/${axisName}/entries에 없음`,
            ref: `${ir.taxonomy}#/relations/${relName}/rules/${i}`,
            meta: { axis: axisName, missing: entryId, field },
          });
        }
      }
    }
  }
  return out;
}

function inferAxis(rel: { from: string[]; to: string[] }, field: string): string | undefined {
  // 컨벤션: upper/parent → from의 첫 axis; lower/child → to의 첫 axis
  if (field === "upper" || field === "parent") return rel.from[0];
  if (field === "lower" || field === "child") return rel.to[0];
  return undefined;
}
```

- [ ] **Step 6: constraint 검증 (최소)**

`src/validate/constraint.ts`:

```typescript
import type { TaxonomyIR } from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";

export function validateConstraints(ir: TaxonomyIR): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const c of ir.constraints) {
    if (c.kind === "structural" && /level=leaf.*must not appear as upper/i.test(c.rule)) {
      const level = ir.axes.get("level");
      if (!level) continue;
      for (const [relName, rel] of ir.relations) {
        if (rel.kind !== "contains") continue;
        for (const [i, rule] of rel.rules.entries()) {
          if (rule.upper === "leaf") {
            out.push({
              severity: c.severity,
              code: "constraint-violated",
              message: `constraint ${c.id}: relations/${relName}/rules/${i}.upper="leaf"`,
              ref: `${ir.taxonomy}#/constraints/${c.id}`,
              meta: { constraint: c.id, location: `${relName}/${i}` },
            });
          }
        }
      }
    }
  }
  return out;
}
```

- [ ] **Step 7: axis-5q 검증 (최소)**

`src/validate/axis5q.ts`:

```typescript
import type { TaxonomyIR } from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";

const SUSPECT_UNBOUNDED_AXIS_NAMES = new Set(["version", "timestamp", "uuid", "id"]);

export function validateAxis5Q(ir: TaxonomyIR): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [name, axis] of ir.axes) {
    if (SUSPECT_UNBOUNDED_AXIS_NAMES.has(name)) {
      out.push({
        severity: "warning",
        code: "axis-5q-finite",
        message: `axes/${name}: 이름이 unbounded 가능성 — 5Q checklist '유한' 항목 검토`,
        ref: `${ir.taxonomy}#/axes/${name}`,
        meta: { axis: name, reason: "name-suspect" },
      });
    }
  }
  return out;
}
```

- [ ] **Step 8: 디스패처 구현**

`src/validate/index.ts`:

```typescript
import type { TaxonomyIR } from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";
import type { TaxonomyRegistry } from "../registry/index.js";
import { validateCapacity } from "./capacity.js";
import { validateRefs } from "./ref.js";
import { validateConstraints } from "./constraint.js";
import { validateAxis5Q } from "./axis5q.js";

export type ValidateOptions = {
  strict?: boolean;
  skip?: Array<"capacity" | "ref" | "constraint" | "axis-5q">;
};

export function validate(
  ir: TaxonomyIR,
  registry?: TaxonomyRegistry,
  opts: ValidateOptions = {},
): Diagnostic[] {
  const skip = new Set(opts.skip ?? []);
  const out: Diagnostic[] = [];
  if (!skip.has("capacity")) out.push(...validateCapacity(ir));
  if (!skip.has("ref")) out.push(...validateRefs(ir, registry));
  if (!skip.has("constraint")) out.push(...validateConstraints(ir));
  if (!skip.has("axis-5q")) out.push(...validateAxis5Q(ir));
  if (opts.strict) {
    return out.map((d) => (d.severity === "warning" ? { ...d, severity: "error" } : d));
  }
  return out;
}
```

- [ ] **Step 9: 테스트 통과 확인**

Run: `pnpm --filter taxonomy-engine test validate.test`
Expected: 3 passed

- [ ] **Step 10: 커밋**

```bash
git add packages/taxonomy-engine/src/validate packages/taxonomy-engine/__tests__/fixtures packages/taxonomy-engine/__tests__/unit/validate.test.ts
git commit -m "feat(taxonomy-engine): validator (capacity/ref/constraint/axis-5q) (Task 6)"
```

---
