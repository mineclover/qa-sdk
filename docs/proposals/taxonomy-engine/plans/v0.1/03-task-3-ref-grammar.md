# Taxonomy Engine v0.1 — Task 3: Ref grammar (parser + resolver)

## 목적 ^purpose

v0.1의 ref grammar parser/resolver 구현 작업 원문을 보존한다.

## Task 3: Ref grammar (parser + resolver)

**Files:**
- Create: `packages/taxonomy-engine/src/ref/parser.ts`
- Create: `packages/taxonomy-engine/src/ref/resolver.ts`
- Create: `packages/taxonomy-engine/src/ref/types.ts`
- Create: `packages/taxonomy-engine/__tests__/unit/ref.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/unit/ref.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseRef } from "../../src/ref/parser.js";

describe("parseRef", () => {
  it("Tier 1 path-based — 전체 taxonomy", () => {
    expect(parseRef("qa-coords")).toEqual({
      taxonomy: "qa-coords",
      kind: "taxonomy",
    });
  });

  it("Tier 1 path-based — axis", () => {
    expect(parseRef("qa-coords#/axes/scope")).toEqual({
      taxonomy: "qa-coords",
      kind: "axis",
      axis: "scope",
    });
  });

  it("Tier 1 path-based — entry", () => {
    expect(parseRef("qa-coords#/axes/scope/entries/apm")).toEqual({
      taxonomy: "qa-coords",
      kind: "entry",
      axis: "scope",
      entry: "apm",
    });
  });

  it("Tier 1 path-based — meta field", () => {
    const r = parseRef("qa-coords#/axes/scope/entries/apm/meta/owner");
    expect(r.kind).toBe("entry-field");
    if (r.kind === "entry-field") {
      expect(r.axis).toBe("scope");
      expect(r.entry).toBe("apm");
      expect(r.pointer).toEqual(["meta", "owner"]);
    }
  });

  it("Tier 2 dotted — entry", () => {
    expect(parseRef("qa-coords:scope.apm")).toEqual({
      taxonomy: "qa-coords",
      kind: "entry",
      axis: "scope",
      entry: "apm",
    });
  });

  it("Tier 2 dotted — coordinate", () => {
    const r = parseRef("qa-coords:coord{scope=apm,aspect=model}");
    expect(r.kind).toBe("coordinate");
    if (r.kind === "coordinate") {
      expect(r.coord).toEqual({ scope: "apm", aspect: "model" });
    }
  });

  it("Tier 3 address-based — axis#address", () => {
    expect(parseRef("qa-coords::scope#0")).toEqual({
      taxonomy: "qa-coords",
      kind: "entry-by-address",
      axis: "scope",
      address: 0,
    });
  });

  it("version 명시 @v<n>", () => {
    expect(parseRef("qa-coords@v1:scope.apm")).toEqual({
      taxonomy: "qa-coords",
      version: 1,
      kind: "entry",
      axis: "scope",
      entry: "apm",
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter taxonomy-engine test ref.test`
Expected: FAIL — `parseRef` 없음

- [ ] **Step 3: ref 타입 정의**

`src/ref/types.ts`:

```typescript
import type { Coordinate } from "../schema/ir.js";

export type TaxonomyRef =
  | { taxonomy: string; version?: number; kind: "taxonomy" }
  | { taxonomy: string; version?: number; kind: "axis"; axis: string }
  | {
      taxonomy: string;
      version?: number;
      kind: "entry";
      axis: string;
      entry: string;
    }
  | {
      taxonomy: string;
      version?: number;
      kind: "entry-by-address";
      axis: string;
      address: number;
    }
  | {
      taxonomy: string;
      version?: number;
      kind: "entry-field";
      axis: string;
      entry: string;
      pointer: string[];
    }
  | {
      taxonomy: string;
      version?: number;
      kind: "coordinate";
      coord: Coordinate;
    }
  | {
      taxonomy: string;
      version?: number;
      kind: "relation";
      relation: string;
    }
  | {
      taxonomy: string;
      version?: number;
      kind: "relation-rule";
      relation: string;
      ruleIdx: number;
    }
  | {
      taxonomy: string;
      version?: number;
      kind: "constraint";
      constraint: string;
    };

export type RefResult =
  | { kind: "taxonomy"; ref: TaxonomyRef; ir: unknown }
  | { kind: "axis"; ref: TaxonomyRef; axis: unknown }
  | { kind: "entry"; ref: TaxonomyRef; entry: unknown }
  | { kind: "coordinate"; ref: TaxonomyRef; coord: Coordinate; addresses: number[] }
  | { kind: "relation"; ref: TaxonomyRef; relation: unknown }
  | { kind: "constraint"; ref: TaxonomyRef; constraint: unknown }
  | { kind: "field"; ref: TaxonomyRef; value: unknown };
```

- [ ] **Step 4: parser 구현**

`src/ref/parser.ts`:

```typescript
import type { TaxonomyRef } from "./types.js";

export function parseRef(input: string): TaxonomyRef {
  const { taxonomy, version, rest } = splitTaxonomyVersion(input);
  if (rest === "") return { taxonomy, version, kind: "taxonomy" };

  // Tier 3 — address-based: ::scope#0  or ::coord:0x...
  if (rest.startsWith("::")) return parseAddressRef(taxonomy, version, rest.slice(2));

  // Tier 1 — JSON pointer: #/...
  if (rest.startsWith("#")) return parsePointerRef(taxonomy, version, rest.slice(1));

  // Tier 2 — dotted: :scope.apm  :coord{...}  :relations/xxx
  if (rest.startsWith(":")) return parseDottedRef(taxonomy, version, rest.slice(1));

  throw new Error(`잘못된 ref 형식: ${input}`);
}

function splitTaxonomyVersion(input: string): {
  taxonomy: string;
  version?: number;
  rest: string;
} {
  const m = input.match(/^([a-zA-Z][\w-]*)(@v(\d+))?(.*)$/);
  if (!m) throw new Error(`잘못된 ref taxonomy 형식: ${input}`);
  return {
    taxonomy: m[1],
    version: m[3] ? Number(m[3]) : undefined,
    rest: m[4] ?? "",
  };
}

function parsePointerRef(taxonomy: string, version: number | undefined, ptr: string): TaxonomyRef {
  const parts = ptr.split("/").filter(Boolean);
  if (parts.length === 0) return { taxonomy, version, kind: "taxonomy" };
  if (parts[0] === "axes") {
    const axis = parts[1];
    if (parts.length === 2) return { taxonomy, version, kind: "axis", axis };
    if (parts[2] === "entries") {
      const entry = parts[3];
      if (parts.length === 4) return { taxonomy, version, kind: "entry", axis, entry };
      return {
        taxonomy, version, kind: "entry-field", axis, entry,
        pointer: parts.slice(4),
      };
    }
  }
  if (parts[0] === "relations") {
    const relation = parts[1];
    if (parts.length === 2) return { taxonomy, version, kind: "relation", relation };
    if (parts[2] === "rules") {
      return { taxonomy, version, kind: "relation-rule", relation, ruleIdx: Number(parts[3]) };
    }
  }
  if (parts[0] === "constraints") {
    return { taxonomy, version, kind: "constraint", constraint: parts[1] };
  }
  throw new Error(`알 수 없는 pointer 경로: ${ptr}`);
}

function parseDottedRef(taxonomy: string, version: number | undefined, body: string): TaxonomyRef {
  // coord{...}
  const coordMatch = body.match(/^coord\{(.+)\}$/);
  if (coordMatch) {
    const coord: Record<string, string> = {};
    for (const pair of coordMatch[1].split(",")) {
      const [k, v] = pair.split("=").map((s) => s.trim());
      coord[k] = v;
    }
    return { taxonomy, version, kind: "coordinate", coord };
  }
  // relations/<name> or relations/<name>/rules/<i>
  if (body.startsWith("relations/")) {
    const parts = body.split("/");
    const relation = parts[1];
    if (parts[2] === "rules") {
      return { taxonomy, version, kind: "relation-rule", relation, ruleIdx: Number(parts[3]) };
    }
    return { taxonomy, version, kind: "relation", relation };
  }
  // constraints/<id>
  if (body.startsWith("constraints/")) {
    return { taxonomy, version, kind: "constraint", constraint: body.slice("constraints/".length) };
  }
  // axis.entry  or  axis (no entry)
  const dotIdx = body.indexOf(".");
  if (dotIdx === -1) return { taxonomy, version, kind: "axis", axis: body };
  const axis = body.slice(0, dotIdx);
  const entry = body.slice(dotIdx + 1);
  return { taxonomy, version, kind: "entry", axis, entry };
}

function parseAddressRef(taxonomy: string, version: number | undefined, body: string): TaxonomyRef {
  if (body.startsWith("coord:")) {
    const hex = body.slice("coord:".length);
    throw new Error(`coord:address 디코딩은 axes 정보 필요. resolver 사용.`);
  }
  const m = body.match(/^([a-zA-Z][\w-]*)#(\d+)$/);
  if (!m) throw new Error(`잘못된 address ref: ${body}`);
  return {
    taxonomy, version, kind: "entry-by-address",
    axis: m[1], address: Number(m[2]),
  };
}
```

- [ ] **Step 5: parser 테스트 통과 확인**

Run: `pnpm --filter taxonomy-engine test ref.test`
Expected: 8 passed

- [ ] **Step 6: resolver 테스트 추가**

`__tests__/unit/ref.test.ts` 끝에 추가:

```typescript
import { resolveRef } from "../../src/ref/resolver.js";
import { TaxonomyRegistry } from "../../src/registry/index.js";
import { parse } from "../../src/parser/index.js";

describe("resolveRef", () => {
  const yaml = `
taxonomy: qa-coords
version: 1
axes:
  scope:
    entries: [apm, ingest]
`;
  const reg = new TaxonomyRegistry();
  const parsed = parse(yaml);
  if ("ir" in parsed) reg.add(parsed.ir);

  it("3-tier 등가 — entry", () => {
    const a = resolveRef(parseRef("qa-coords:scope.apm"), reg);
    const b = resolveRef(parseRef("qa-coords#/axes/scope/entries/apm"), reg);
    const c = resolveRef(parseRef("qa-coords::scope#0"), reg);
    expect(a?.kind).toBe("entry");
    expect(b?.kind).toBe("entry");
    expect(c?.kind).toBe("entry");
    if (a?.kind === "entry" && b?.kind === "entry" && c?.kind === "entry") {
      expect((a.entry as { id: string }).id).toBe("apm");
      expect((b.entry as { id: string }).id).toBe("apm");
      expect((c.entry as { id: string }).id).toBe("apm");
    }
  });

  it("fail-open — unknown taxonomy → undefined", () => {
    expect(resolveRef(parseRef("unknown:scope.x"), reg)).toBeUndefined();
  });

  it("fail-open — unknown entry → undefined", () => {
    expect(resolveRef(parseRef("qa-coords:scope.unknown"), reg)).toBeUndefined();
  });
});
```

- [ ] **Step 7: resolver 구현**

`src/ref/resolver.ts`:

```typescript
import type { TaxonomyRef, RefResult } from "./types.js";
import type { TaxonomyRegistry } from "../registry/index.js";

export function resolveRef(
  ref: TaxonomyRef,
  registry: TaxonomyRegistry,
): RefResult | undefined {
  const ir = registry.get(ref.taxonomy);
  if (!ir) return undefined;
  if (ref.version !== undefined && ir.version !== ref.version) return undefined;

  switch (ref.kind) {
    case "taxonomy":
      return { kind: "taxonomy", ref, ir };
    case "axis": {
      const axis = ir.axes.get(ref.axis);
      return axis ? { kind: "axis", ref, axis } : undefined;
    }
    case "entry": {
      const axis = ir.axes.get(ref.axis);
      const entry = axis?.entries.find((e) => e.id === ref.entry);
      return entry ? { kind: "entry", ref, entry } : undefined;
    }
    case "entry-by-address": {
      const axis = ir.axes.get(ref.axis);
      const entry = axis?.entries.find((e) => e.address === ref.address);
      return entry ? { kind: "entry", ref, entry } : undefined;
    }
    case "entry-field": {
      const axis = ir.axes.get(ref.axis);
      const entry = axis?.entries.find((e) => e.id === ref.entry);
      if (!entry) return undefined;
      let value: unknown = entry;
      for (const seg of ref.pointer) {
        if (value && typeof value === "object" && seg in (value as Record<string, unknown>)) {
          value = (value as Record<string, unknown>)[seg];
        } else return undefined;
      }
      return { kind: "field", ref, value };
    }
    case "coordinate": {
      const addresses: number[] = [];
      for (const [axisName, entryId] of Object.entries(ref.coord)) {
        const axis = ir.axes.get(axisName);
        const entry = axis?.entries.find((e) => e.id === entryId);
        if (!entry) return undefined;
        addresses.push(entry.address);
      }
      return { kind: "coordinate", ref, coord: ref.coord, addresses };
    }
    case "relation": {
      const relation = ir.relations.get(ref.relation);
      return relation ? { kind: "relation", ref, relation } : undefined;
    }
    case "relation-rule": {
      const relation = ir.relations.get(ref.relation);
      const rule = relation?.rules[ref.ruleIdx];
      return rule ? { kind: "relation", ref, relation: rule } : undefined;
    }
    case "constraint": {
      const constraint = ir.constraints.find((c) => c.id === ref.constraint);
      return constraint ? { kind: "constraint", ref, constraint } : undefined;
    }
  }
}
```

- [ ] **Step 8: 전체 ref 테스트 통과**

Run: `pnpm --filter taxonomy-engine test ref.test`
Expected: 11 passed

- [ ] **Step 9: 커밋**

```bash
git add packages/taxonomy-engine/src/ref packages/taxonomy-engine/__tests__/unit/ref.test.ts
git commit -m "feat(taxonomy-engine): 3-tier ref grammar + fail-open resolver (Task 3)"
```

---
