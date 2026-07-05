# Taxonomy Engine v0.1 — Task 7: Codegen (TS 출력 + contentHash)

## 목적 ^purpose

v0.1의 TypeScript codegen과 contentHash 작업 원문을 보존한다.

## Task 7: Codegen (TS 출력 + contentHash)

**Files:**
- Create: `packages/taxonomy-engine/src/codegen/index.ts`
- Create: `packages/taxonomy-engine/src/codegen/render.ts`
- Create: `packages/taxonomy-engine/__tests__/unit/codegen.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`__tests__/unit/codegen.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { codegen } from "../../src/codegen/index.js";
import { parse } from "../../src/parser/index.js";

const yaml = `
taxonomy: qa
version: 1
axes:
  scope:
    entries: [apm, ingest]
    capacity: 4
  aspect:
    entries: [model, protocol]
    capacity: 4
relations:
  depth-contains:
    from: scope
    to: scope
    kind: contains
    rules:
      - { upper: apm, lower: ingest }
`;

describe("codegen", () => {
  it("결정론: 같은 IR → 같은 contentHash", () => {
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const a = codegen(r.ir, { taxonomyName: "qa" });
    const b = codegen(r.ir, { taxonomyName: "qa" });
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.files).toEqual(b.files);
  });

  it("axes.ts에 id union 생성", () => {
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const { files } = codegen(r.ir, { taxonomyName: "qa" });
    expect(files["axes.ts"]).toContain('export type ScopeId = "apm" | "ingest"');
  });

  it("addresses.ts에 SCOPE_ADDR 매핑 생성", () => {
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const { files } = codegen(r.ir, { taxonomyName: "qa" });
    expect(files["addresses.ts"]).toContain("export const SCOPE_ADDR");
    expect(files["addresses.ts"]).toContain("apm: 0");
    expect(files["addresses.ts"]).toContain("ingest: 1");
  });

  it("meta.ts에 contentHash + generatedAt 박힘", () => {
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const { files, contentHash } = codegen(r.ir, { taxonomyName: "qa" });
    expect(files["meta.ts"]).toContain(contentHash);
  });

  it("5개 파일 생성 (axes/addresses/registry/relations/meta)", () => {
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const { files } = codegen(r.ir, { taxonomyName: "qa" });
    expect(Object.keys(files).sort()).toEqual([
      "addresses.ts",
      "axes.ts",
      "meta.ts",
      "registry.ts",
      "relations.ts",
    ]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter taxonomy-engine test codegen.test`
Expected: FAIL

- [ ] **Step 3: render 구현**

`src/codegen/render.ts`:

```typescript
import type { TaxonomyIR, AxisIR } from "../schema/ir.js";

const HEADER = "// 자동 생성 파일. 수동 편집 금지. taxonomy-engine codegen 산출물.\n\n";

function pascal(name: string): string {
  return name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

function upper(name: string): string {
  return name.replace(/-/g, "_").toUpperCase();
}

export function renderAxes(ir: TaxonomyIR): string {
  const lines: string[] = [HEADER];
  for (const [name, axis] of [...ir.axes].sort(([a], [b]) => a.localeCompare(b))) {
    const ids = axis.entries.map((e) => `"${e.id}"`).join(" | ");
    lines.push(`export type ${pascal(name)}Id = ${ids};\n\n`);
  }
  return lines.join("");
}

export function renderAddresses(ir: TaxonomyIR): string {
  const lines: string[] = [HEADER];
  for (const [name, axis] of [...ir.axes].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`export const ${upper(name)}_ADDR = {\n`);
    for (const e of axis.entries) {
      lines.push(`  ${e.id}: ${e.address},\n`);
    }
    lines.push(`} as const;\n\n`);
  }
  return lines.join("");
}

export function renderRegistry(ir: TaxonomyIR): string {
  const lines: string[] = [HEADER];
  for (const [name, axis] of [...ir.axes].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`export const ${upper(name)}_ENTRIES = ${JSON.stringify(stripLoc(axis), null, 2)} as const;\n\n`);
  }
  return lines.join("");
}

export function renderRelations(ir: TaxonomyIR): string {
  const lines: string[] = [HEADER];
  for (const [name, rel] of [...ir.relations].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`export const ${upper(name)} = ${JSON.stringify(stripLoc(rel), null, 2)} as const;\n\n`);
  }
  return lines.join("");
}

export function renderMeta(ir: TaxonomyIR, contentHash: string, generatedAt: string): string {
  return HEADER + `export const TAXONOMY_META = {
  taxonomy: ${JSON.stringify(ir.taxonomy)},
  version: ${ir.version},
  contentHash: ${JSON.stringify(contentHash)},
  generatedAt: ${JSON.stringify(generatedAt)},
} as const;
`;
}

function stripLoc<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (k, v) => (k === "_loc" ? undefined : v)));
}
```

- [ ] **Step 4: codegen 디스패처**

`src/codegen/index.ts`:

```typescript
import { createHash } from "node:crypto";
import type { TaxonomyIR } from "../schema/ir.js";
import {
  renderAxes,
  renderAddresses,
  renderRegistry,
  renderRelations,
  renderMeta,
} from "./render.js";

export type CodegenOptions = {
  taxonomyName?: string;
  generatedAt?: string;
};

export type CodegenResult = {
  files: Record<string, string>;
  contentHash: string;
};

export function codegen(ir: TaxonomyIR, opts: CodegenOptions = {}): CodegenResult {
  // 결정론: generatedAt는 IR contentHash로부터 derive (실제 호출 시간 사용 X)
  const generatedAt = opts.generatedAt ?? `derived-from-${ir.contentHash}`;

  const filesNoMeta: Record<string, string> = {
    "axes.ts": renderAxes(ir),
    "addresses.ts": renderAddresses(ir),
    "registry.ts": renderRegistry(ir),
    "relations.ts": renderRelations(ir),
  };

  const contentHash = createHash("sha256")
    .update(Object.entries(filesNoMeta).sort().map(([k, v]) => `${k}\0${v}`).join("\0"))
    .digest("hex")
    .slice(0, 16);

  const files = {
    ...filesNoMeta,
    "meta.ts": renderMeta(ir, contentHash, generatedAt),
  };

  return { files, contentHash };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter taxonomy-engine test codegen.test`
Expected: 5 passed

- [ ] **Step 6: 커밋**

```bash
git add packages/taxonomy-engine/src/codegen packages/taxonomy-engine/__tests__/unit/codegen.test.ts
git commit -m "feat(taxonomy-engine): codegen with deterministic contentHash (Task 7)"
```

---
