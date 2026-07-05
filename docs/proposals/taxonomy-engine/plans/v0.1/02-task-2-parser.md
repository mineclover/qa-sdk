# Taxonomy Engine v0.1 — Task 2: Parser (yaml → IR with _loc)

## 목적 ^purpose

v0.1의 yaml parser와 위치 정보 보존 작업 원문을 보존한다.

## Task 2: Parser (yaml → IR with _loc)

**Files:**
- Create: `packages/taxonomy-engine/src/parser/index.ts`
- Create: `packages/taxonomy-engine/__tests__/unit/parser.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/unit/parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parse } from "../../src/parser/index.js";

const MIN_YAML = `
taxonomy: test
version: 1
axes:
  scope:
    entries: [apm, ingest, registry]
`;

describe("parse", () => {
  it("최소 yaml을 IR로 변환한다", () => {
    const result = parse(MIN_YAML);
    expect("ir" in result).toBe(true);
    if ("ir" in result) {
      expect(result.ir.taxonomy).toBe("test");
      expect(result.ir.version).toBe(1);
      expect(result.ir.axes.get("scope")?.entries.length).toBe(3);
    }
  });

  it("entry id에 _loc(line)을 보존한다", () => {
    const result = parse(MIN_YAML);
    if ("ir" in result) {
      const apm = result.ir.axes.get("scope")?.entries[0];
      expect(apm?._loc?.line).toBeGreaterThan(0);
    }
  });

  it("syntax error 시 fail-fast로 ParseError 반환", () => {
    const result = parse(":::not yaml:::");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.code).toMatch(/^parse-/);
    }
  });

  it("entries가 비면 structural-empty-entries 반환", () => {
    const bad = `taxonomy: t\nversion: 1\naxes:\n  s:\n    entries: []\n`;
    const result = parse(bad);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.code).toBe("structural-empty-entries");
    }
  });

  it("동일 yaml에 대해 동일 contentHash 생성", () => {
    const a = parse(MIN_YAML);
    const b = parse(MIN_YAML);
    if ("ir" in a && "ir" in b) {
      expect(a.ir.contentHash).toBe(b.ir.contentHash);
    }
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter taxonomy-engine test parser.test`
Expected: FAIL — `parse` 없음

- [ ] **Step 3: parser 구현**

`src/parser/index.ts`:

```typescript
import * as yaml from "js-yaml";
import { createHash } from "node:crypto";
import { TaxonomyDocSchema, type TaxonomyDoc } from "../schema/zod.js";
import type {
  TaxonomyIR,
  AxisIR,
  EntryIR,
  RelationIR,
  ConstraintIR,
} from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";

export type ParseError = Diagnostic;

export type ParseResult = { ir: TaxonomyIR } | { error: ParseError };

export function parse(yamlText: string): ParseResult {
  let raw: unknown;
  try {
    raw = yaml.load(yamlText);
  } catch (e) {
    const mark = (e as { mark?: { line: number; column: number } }).mark;
    return {
      error: {
        severity: "error",
        code: "parse-yaml-syntax",
        message: `YAML 문법 오류: ${(e as Error).message}`,
        location: mark ? { line: mark.line + 1, column: mark.column + 1 } : undefined,
      },
    };
  }

  const parsed = TaxonomyDocSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    if (first.message.includes("entries는 최소 1개")) {
      return {
        error: {
          severity: "error",
          code: "structural-empty-entries",
          message: `entries가 비어있음: ${first.path.join(".")}`,
        },
      };
    }
    return {
      error: {
        severity: "error",
        code: "parse-missing-axes",
        message: `${first.path.join(".")}: ${first.message}`,
      },
    };
  }

  const locs = extractLocs(yamlText);
  const ir = buildIR(parsed.data, locs);
  return { ir };
}

function buildIR(
  doc: TaxonomyDoc,
  locs: Map<string, { line: number; column: number }>,
): TaxonomyIR {
  const axes = new Map<string, AxisIR>();
  for (const [name, axis] of Object.entries(doc.axes)) {
    const entries: EntryIR[] = axis.entries.map((e, i) => {
      const id = typeof e === "string" ? e : e.id;
      const address = typeof e === "string" ? i : (e.address ?? i);
      const label = typeof e === "string" ? undefined : e.label;
      const meta = typeof e === "string" ? undefined : e.meta;
      return {
        id,
        address,
        label,
        meta,
        _loc: locs.get(`axes.${name}.entries.${i}`),
      };
    });
    const capacity = axis.capacity ?? nextPowerOf2(entries.length * 2);
    axes.set(name, {
      name,
      description: axis.description,
      entries,
      capacity,
      version: axis.version ?? 1,
      _loc: locs.get(`axes.${name}`),
    });
  }

  const relations = new Map<string, RelationIR>();
  for (const [name, rel] of Object.entries(doc.relations ?? {})) {
    relations.set(name, {
      name,
      from: Array.isArray(rel.from) ? rel.from : [rel.from],
      to: Array.isArray(rel.to) ? rel.to : [rel.to],
      kind: rel.kind,
      rules: rel.rules,
      _loc: locs.get(`relations.${name}`),
    });
  }

  const constraints: ConstraintIR[] = (doc.constraints ?? []).map((c, i) => ({
    ...c,
    _loc: locs.get(`constraints.${i}`),
  }));

  const contentHash = computeHash({
    taxonomy: doc.taxonomy,
    version: doc.version,
    axes: doc.axes,
    relations: doc.relations,
    constraints: doc.constraints,
  });

  return {
    taxonomy: doc.taxonomy,
    version: doc.version,
    description: doc.description,
    contentHash,
    axes,
    relations,
    constraints,
    imports: doc.imports,
  };
}

function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  return 1 << Math.ceil(Math.log2(n));
}

function computeHash(obj: unknown): string {
  const json = stableStringify(obj);
  return createHash("sha256").update(json).digest("hex").slice(0, 16);
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function extractLocs(yamlText: string): Map<string, { line: number; column: number }> {
  // 최소 구현 — yaml 라인 인덱스만 보존. 정밀 위치는 후속 개선.
  const locs = new Map<string, { line: number; column: number }>();
  const lines = yamlText.split("\n");
  let axisName: string | null = null;
  let inAxes = false;
  let entryIdx = 0;
  lines.forEach((line, i) => {
    const trimmed = line.replace(/\s+$/, "");
    if (/^axes:\s*$/.test(trimmed)) inAxes = true;
    else if (/^[a-zA-Z]/.test(trimmed) && !/^\s/.test(line)) inAxes = false;

    if (inAxes) {
      const axisMatch = trimmed.match(/^\s{2}([a-zA-Z_][\w-]*)\s*:/);
      if (axisMatch) {
        axisName = axisMatch[1];
        entryIdx = 0;
        locs.set(`axes.${axisName}`, { line: i + 1, column: line.indexOf(axisName) + 1 });
      }
      const inlineEntries = trimmed.match(/^\s{4}entries:\s*\[(.+)\]/);
      if (inlineEntries && axisName) {
        const items = inlineEntries[1].split(",").map((s) => s.trim());
        items.forEach((_, j) => {
          locs.set(`axes.${axisName}.entries.${j}`, {
            line: i + 1,
            column: line.indexOf(items[j]) + 1,
          });
        });
      }
    }
  });
  return locs;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter taxonomy-engine test parser.test`
Expected: 5 passed

- [ ] **Step 5: 커밋**

```bash
git add packages/taxonomy-engine/src/parser packages/taxonomy-engine/__tests__/unit/parser.test.ts
git commit -m "feat(taxonomy-engine): yaml parser with _loc preservation (Task 2)"
```

---
