# Taxonomy Engine v0.1 — Task 5: TaxonomyRegistry

## 목적 ^purpose

v0.1의 in-memory TaxonomyRegistry 작업 원문을 보존한다.

## Task 5: TaxonomyRegistry

**Files:**
- Create: `packages/taxonomy-engine/src/registry/index.ts`
- Create: `packages/taxonomy-engine/__tests__/unit/registry.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`__tests__/unit/registry.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { TaxonomyRegistry } from "../../src/registry/index.js";
import { parse } from "../../src/parser/index.js";

const yamlA = `taxonomy: a\nversion: 1\naxes:\n  scope:\n    entries: [x, y]\n`;
const yamlB = `taxonomy: b\nversion: 1\naxes:\n  scope:\n    entries: [m, n]\n`;

describe("TaxonomyRegistry", () => {
  it("add/get/list", () => {
    const reg = new TaxonomyRegistry();
    const a = parse(yamlA);
    const b = parse(yamlB);
    if ("ir" in a) reg.add(a.ir);
    if ("ir" in b) reg.add(b.ir);
    expect(reg.list().sort()).toEqual(["a", "b"]);
    expect(reg.get("a")?.taxonomy).toBe("a");
    expect(reg.get("missing")).toBeUndefined();
  });

  it("같은 taxonomy 재추가 시 덮어씀", () => {
    const reg = new TaxonomyRegistry();
    const a = parse(yamlA);
    if ("ir" in a) {
      reg.add(a.ir);
      reg.add(a.ir);
    }
    expect(reg.list()).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter taxonomy-engine test registry.test`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/registry/index.ts`:

```typescript
import type { TaxonomyIR } from "../schema/ir.js";

export class TaxonomyRegistry {
  private map = new Map<string, TaxonomyIR>();

  add(ir: TaxonomyIR): void {
    this.map.set(ir.taxonomy, ir);
  }

  get(taxonomy: string): TaxonomyIR | undefined {
    return this.map.get(taxonomy);
  }

  list(): string[] {
    return [...this.map.keys()];
  }
}
```

- [ ] **Step 4: 테스트 통과**

Run: `pnpm --filter taxonomy-engine test registry.test`
Expected: 2 passed

- [ ] **Step 5: 커밋**

```bash
git add packages/taxonomy-engine/src/registry packages/taxonomy-engine/__tests__/unit/registry.test.ts
git commit -m "feat(taxonomy-engine): TaxonomyRegistry (Task 5)"
```

---
