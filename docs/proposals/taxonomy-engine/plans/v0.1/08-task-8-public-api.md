# Taxonomy Engine v0.1 — Task 8: Public API consolidation

## 목적 ^purpose

v0.1의 public API consolidation 작업 원문을 보존한다.

## Task 8: Public API consolidation

**Files:**
- Modify: `packages/taxonomy-engine/src/index.ts`
- Create: `packages/taxonomy-engine/__tests__/unit/public-api.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`__tests__/unit/public-api.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as api from "../../src/index.js";

describe("public API", () => {
  it("필수 함수 export", () => {
    expect(typeof api.parse).toBe("function");
    expect(typeof api.validate).toBe("function");
    expect(typeof api.parseRef).toBe("function");
    expect(typeof api.resolveRef).toBe("function");
    expect(typeof api.indexAxis).toBe("function");
    expect(typeof api.packCoordinate).toBe("function");
    expect(typeof api.unpackCoordinate).toBe("function");
    expect(typeof api.codegen).toBe("function");
    expect(typeof api.TaxonomyRegistry).toBe("function");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter taxonomy-engine test public-api.test`
Expected: FAIL — exports missing

- [ ] **Step 3: index.ts 작성**

`src/index.ts`:

```typescript
// schema
export type {
  TaxonomyIR,
  AxisIR,
  EntryIR,
  RelationIR,
  ConstraintIR,
  Coordinate,
  Severity,
  RelationKind,
  ConstraintKind,
  ImportIR,
} from "./schema/ir.js";
export type { Diagnostic, DiagnosticCode } from "./schema/diagnostic.js";

// parser
export { parse } from "./parser/index.js";
export type { ParseResult, ParseError } from "./parser/index.js";

// ref
export { parseRef } from "./ref/parser.js";
export { resolveRef } from "./ref/resolver.js";
export type { TaxonomyRef, RefResult } from "./ref/types.js";

// indexer
export {
  indexAxis,
  packCoordinate,
  unpackCoordinate,
} from "./indexer/index.js";
export type { IndexedAxis } from "./indexer/index.js";

// registry
export { TaxonomyRegistry } from "./registry/index.js";

// validate
export { validate } from "./validate/index.js";
export type { ValidateOptions } from "./validate/index.js";

// codegen
export { codegen } from "./codegen/index.js";
export type { CodegenOptions, CodegenResult } from "./codegen/index.js";
```

- [ ] **Step 4: 빌드 + 테스트 통과**

Run:
```bash
pnpm --filter taxonomy-engine build
pnpm --filter taxonomy-engine test
```
Expected: 빌드 성공 + 모든 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add packages/taxonomy-engine/src/index.ts packages/taxonomy-engine/__tests__/unit/public-api.test.ts
git commit -m "feat(taxonomy-engine): consolidate public API (Task 8)"
```

---
