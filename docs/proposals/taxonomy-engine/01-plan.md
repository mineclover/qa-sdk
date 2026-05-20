# Taxonomy Engine 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YAML SSOT로 좌표계 텍소노미를 선언·검증·인덱싱·코드 생성할 수 있는 순수 라이브러리 + 최소 CLI를 구축한다.

**Architecture:** 단일 라이브러리 패키지(`taxonomy-engine`, unscoped, tsup dual format) + 기존 `@qa-sdk/cli`에 `tax validate` 명령 1개 추가. 모든 함수는 순수 (TaxonomyRegistry 제외), 파일 I/O는 CLI 책임. 결정론적 codegen(contentHash) 보장. qa-sdk 좌표계 자체를 첫 도그푸딩 fixture로 사용.

**Tech Stack:** TypeScript 5.8 (ES2023 target), tsup, zod ^3.25.76 (catalog), js-yaml 4.x, vitest

**Spec:** `docs/proposals/taxonomy-engine/00-design.md`

---

## File Structure

### 신규 패키지 `packages/taxonomy-engine/`

| 파일 | 책임 |
|------|------|
| `src/schema/ir.ts` | TaxonomyIR/AxisIR/EntryIR/RelationIR/ConstraintIR/Coordinate 타입 |
| `src/schema/diagnostic.ts` | Diagnostic 타입 + DiagnosticCode 유니온 |
| `src/schema/zod.ts` | yaml 입력 zod 스키마 (parse 단계 구조 검증용) |
| `src/parser/index.ts` | `parse(yamlText) → IR + _loc 보존` |
| `src/ref/parser.ts` | 3-tier ref 문자열 → TaxonomyRef |
| `src/ref/resolver.ts` | TaxonomyRef + registry → RefResult (fail-open) |
| `src/indexer/index.ts` | `indexAxis`, `packCoordinate`, `unpackCoordinate` |
| `src/registry/index.ts` | `TaxonomyRegistry` 클래스 (add/get/list) |
| `src/validate/index.ts` | `validate(ir, registry?, opts?) → Diagnostic[]` 디스패처 |
| `src/validate/capacity.ts` | capacity-headroom/overflow 검증 |
| `src/validate/ref.ts` | ref-broken/unresolved-import 검증 |
| `src/validate/constraint.ts` | constraint kind별 평가 |
| `src/validate/axis5q.ts` | axis-5q-finite/decisional/stable 검증 |
| `src/codegen/index.ts` | `codegen(ir, opts) → CodegenResult` (contentHash 계산) |
| `src/codegen/render.ts` | axes/addresses/registry/relations/meta TS 텍스트 생성 |
| `src/index.ts` | public export |
| `package.json` | unscoped, tsup dual format |
| `tsup.config.ts` | qa-sdk 컨벤션 |
| `tsconfig.json` | ES2023 |
| `__tests__/unit/*.test.ts` | 순수 함수별 단위 테스트 |
| `__tests__/fixtures/*.yaml` + `*.golden.json` | golden 진단/codegen 비교 |
| `__tests__/dogfooding.test.ts` | qa-sdk 좌표계 yaml 검증 |

### 도그푸딩 fixture
- `docs/taxonomies/qa-sdk-coordinate-system.yaml` — 실제 qa-sdk 좌표 시스템

### CLI 확장
- `packages/cli/src/commands/taxonomy.ts` — `cliTaxonomy(rest)` 라우터
- `packages/cli/src/command-groups/taxonomy.commands.ts` — descriptor/tree/registry
- `packages/cli/src/index.ts` — 위 두 모듈 wiring (3곳: import, dispatch table, root TREE list)
- `packages/cli/package.json` — `taxonomy-engine: workspace:*` 의존 추가

---

## Task 0: 패키지 스캐폴드

**Files:**
- Create: `packages/taxonomy-engine/package.json`
- Create: `packages/taxonomy-engine/tsup.config.ts`
- Create: `packages/taxonomy-engine/tsconfig.json`
- Create: `packages/taxonomy-engine/src/index.ts`
- Create: `packages/taxonomy-engine/vitest.config.ts`
- Create: `packages/taxonomy-engine/README.md`

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "taxonomy-engine",
  "version": "0.1.0",
  "description": "YAML 텍소노미 선언·검증·인덱싱·코드 생성 라이브러리",
  "license": "MIT",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "js-yaml": "^4.1.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.0.0",
    "tsup": "^8.5.1",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1"
  }
}
```

- [ ] **Step 2: tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
});
```

- [ ] **Step 3: tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023"],
    "types": ["node"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*", "__tests__/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    globals: true,
  },
});
```

- [ ] **Step 5: src/index.ts (empty)**

```typescript
// public exports — populated by later tasks
export {};
```

- [ ] **Step 6: README.md**

```markdown
# taxonomy-engine

YAML 텍소노미 선언·검증·인덱싱·코드 생성 라이브러리.

설계: `../../docs/proposals/taxonomy-engine/00-design.md`
```

- [ ] **Step 7: 빌드 통과 확인**

Run:
```bash
pnpm --filter taxonomy-engine install
pnpm --filter taxonomy-engine build
```
Expected: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` 생성

- [ ] **Step 8: 커밋**

```bash
git add packages/taxonomy-engine
git commit -m "feat(taxonomy-engine): scaffold package (Task 0)"
```

---

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

## Task 4: Indexer (address ↔ id, packCoordinate)

**Files:**
- Create: `packages/taxonomy-engine/src/indexer/index.ts`
- Create: `packages/taxonomy-engine/__tests__/unit/indexer.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`__tests__/unit/indexer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  indexAxis,
  packCoordinate,
  unpackCoordinate,
} from "../../src/indexer/index.js";
import type { AxisIR } from "../../src/schema/ir.js";

const scope: AxisIR = {
  name: "scope",
  entries: [
    { id: "apm", address: 0 },
    { id: "ingest", address: 1 },
    { id: "registry", address: 2 },
  ],
  capacity: 8,
  version: 1,
};

const aspect: AxisIR = {
  name: "aspect",
  entries: [
    { id: "model", address: 0 },
    { id: "protocol", address: 1 },
  ],
  capacity: 4,
  version: 1,
};

describe("indexAxis", () => {
  it("id ↔ address 양방향 인덱스 구성", () => {
    const idx = indexAxis(scope);
    expect(idx.byId("apm")?.address).toBe(0);
    expect(idx.byAddress(2)?.id).toBe("registry");
  });

  it("모든 entry에 대해 round-trip", () => {
    const idx = indexAxis(scope);
    for (const e of scope.entries) {
      expect(idx.byAddress(idx.byId(e.id)!.address)?.id).toBe(e.id);
    }
  });
});

describe("packCoordinate", () => {
  it("좌표를 packed 정수로 변환", () => {
    const packed = packCoordinate({ scope: "apm", aspect: "model" }, [scope, aspect]);
    expect(typeof packed).toBe("number");
  });

  it("pack ↔ unpack round-trip", () => {
    const coord = { scope: "ingest", aspect: "protocol" };
    const packed = packCoordinate(coord, [scope, aspect]);
    expect(unpackCoordinate(packed, [scope, aspect])).toEqual(coord);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter taxonomy-engine test indexer.test`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/indexer/index.ts`:

```typescript
import type { AxisIR, EntryIR, Coordinate } from "../schema/ir.js";

export type IndexedAxis = {
  axis: AxisIR;
  byId: (id: string) => EntryIR | undefined;
  byAddress: (address: number) => EntryIR | undefined;
};

export function indexAxis(axis: AxisIR): IndexedAxis {
  const byIdMap = new Map<string, EntryIR>();
  const byAddrMap = new Map<number, EntryIR>();
  for (const e of axis.entries) {
    byIdMap.set(e.id, e);
    byAddrMap.set(e.address, e);
  }
  return {
    axis,
    byId: (id) => byIdMap.get(id),
    byAddress: (a) => byAddrMap.get(a),
  };
}

export function packCoordinate(coord: Coordinate, axes: AxisIR[]): number {
  let packed = 0;
  let shift = 0;
  for (const axis of axes) {
    const entry = axis.entries.find((e) => e.id === coord[axis.name]);
    if (!entry) throw new Error(`unknown entry ${coord[axis.name]} in axis ${axis.name}`);
    const bits = Math.ceil(Math.log2(axis.capacity));
    packed |= entry.address << shift;
    shift += bits;
  }
  return packed;
}

export function unpackCoordinate(packed: number, axes: AxisIR[]): Coordinate {
  const coord: Coordinate = {};
  let shift = 0;
  for (const axis of axes) {
    const bits = Math.ceil(Math.log2(axis.capacity));
    const mask = (1 << bits) - 1;
    const address = (packed >> shift) & mask;
    const entry = axis.entries.find((e) => e.address === address);
    if (!entry) throw new Error(`unknown address ${address} in axis ${axis.name}`);
    coord[axis.name] = entry.id;
    shift += bits;
  }
  return coord;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter taxonomy-engine test indexer.test`
Expected: 4 passed

- [ ] **Step 5: 커밋**

```bash
git add packages/taxonomy-engine/src/indexer packages/taxonomy-engine/__tests__/unit/indexer.test.ts
git commit -m "feat(taxonomy-engine): indexer with bidirectional id/address + packCoordinate (Task 4)"
```

---

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

## Task 9: 도그푸딩 fixture (qa-sdk 좌표계)

**Files:**
- Create: `docs/taxonomies/qa-sdk-coordinate-system.yaml`
- Create: `packages/taxonomy-engine/__tests__/dogfooding.test.ts`

- [ ] **Step 1: yaml 작성**

`docs/taxonomies/qa-sdk-coordinate-system.yaml`:

```yaml
taxonomy: qa-sdk-coordinate-system
version: 1
description: qa-sdk definition-catalog의 좌표/level/layer 시스템 (도그푸딩)

axes:
  scope:
    description: 시스템 경계
    entries: [apm, ingest, registry, gate, query, decode, definition, decision]
    capacity: 16
    version: 1
  aspect:
    description: 측면
    entries: [model, protocol, runtime, policy, ops, io]
    capacity: 16
    version: 1
  depth:
    description: 추상 정도
    entries: [overview, system, layer, component, entry]
    capacity: 16
    version: 1
  level:
    description: 분해 레벨 (메타)
    entries: [group, module, leaf]
    capacity: 8
    version: 1
  layer:
    description: 4계층
    entries: [domain, operation, mediation, experience]
    capacity: 8
    version: 1

relations:
  depth-contains:
    from: depth
    to: depth
    kind: contains
    rules:
      - { upper: overview, lower: system }
      - { upper: system, lower: layer }
      - { upper: layer, lower: component }
      - { upper: component, lower: entry }

  aspect-parents:
    from: aspect
    to: aspect
    kind: parent-of
    rules:
      - { child: protocol, parent: model }
      - { child: runtime, parent: protocol }
      - { child: policy, parent: runtime }
      - { child: ops, parent: runtime }
      - { child: io, parent: protocol }

constraints:
  - id: level-leaf-no-children
    kind: structural
    rule: "axis=level entry=leaf must not appear as upper in any contains relation"
    severity: error
```

- [ ] **Step 2: 도그푸딩 테스트 작성**

`__tests__/dogfooding.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, validate, codegen } from "../src/index.js";

const YAML_PATH = join(__dirname, "../../../docs/taxonomies/qa-sdk-coordinate-system.yaml");

describe("qa-sdk-coordinate-system 도그푸딩", () => {
  const yamlText = readFileSync(YAML_PATH, "utf8");

  it("parse 성공", () => {
    const r = parse(yamlText);
    expect("ir" in r).toBe(true);
  });

  it("validate errors=0", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error("parse failed");
    const diags = validate(r.ir);
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  it("codegen 결정론 — 같은 yaml → 같은 contentHash", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error();
    const a = codegen(r.ir);
    const b = codegen(r.ir);
    expect(a.contentHash).toBe(b.contentHash);
  });

  it("SCOPE_ADDR.apm은 결정론적 0", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error();
    const { files } = codegen(r.ir);
    expect(files["addresses.ts"]).toContain("apm: 0");
  });
});
```

- [ ] **Step 3: 테스트 통과 확인**

Run: `pnpm --filter taxonomy-engine test dogfooding.test`
Expected: 4 passed

- [ ] **Step 4: 커밋**

```bash
git add docs/taxonomies packages/taxonomy-engine/__tests__/dogfooding.test.ts
git commit -m "feat(taxonomy-engine): qa-sdk coordinate system dogfooding fixture (Task 9)"
```

---

## Task 10: CLI `tax validate` 명령

**Files:**
- Modify: `packages/cli/package.json` — `taxonomy-engine: workspace:*` 추가
- Create: `packages/cli/src/commands/taxonomy.ts`
- Create: `packages/cli/src/command-groups/taxonomy.commands.ts`
- Modify: `packages/cli/src/index.ts` — 3곳 wiring (import / dispatch table / TREE list)
- Create: `packages/cli/src/commands/taxonomy.test.ts`

- [ ] **Step 1: 의존 추가**

`packages/cli/package.json`의 dependencies에 추가:

```json
"taxonomy-engine": "workspace:*"
```

Run: `pnpm install`

- [ ] **Step 2: 실패하는 통합 테스트**

`packages/cli/src/commands/taxonomy.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cliTaxonomy } from "./taxonomy.js";

const GOOD_YAML = `
taxonomy: ok
version: 1
axes:
  scope:
    entries: [a, b]
    capacity: 4
`;

const BAD_YAML = `
taxonomy: bad
version: 1
axes:
  scope:
    entries: [a, b, c, d]
    capacity: 4
`;

function writeTmp(name: string, content: string): string {
  const dir = join(tmpdir(), `tax-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
}

describe("cli tax validate", () => {
  it("OK yaml → exit 0", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await cliTaxonomy(["validate", writeTmp("good.yaml", GOOD_YAML)]);
    expect(exit).not.toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });

  it("warning yaml → exit 0 (warning은 통과)", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await cliTaxonomy(["validate", writeTmp("warn.yaml", BAD_YAML)]);
    expect(exit).not.toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });

  it("--strict 시 warning을 error로 → exit 1", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await cliTaxonomy(["validate", "--strict", writeTmp("strict.yaml", BAD_YAML)]);
    expect(exit).toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm --filter @qa-sdk/cli test taxonomy.test`
Expected: FAIL — `cliTaxonomy` 없음

- [ ] **Step 4: 명령 구현**

`packages/cli/src/commands/taxonomy.ts`:

```typescript
import { readFileSync } from "node:fs";
import { parse, validate } from "taxonomy-engine";
import type { Diagnostic } from "taxonomy-engine";

export async function cliTaxonomy(rest: string[]): Promise<void> {
  const [sub, ...args] = rest;
  switch (sub) {
    case "validate":
      return validateCmd(args);
    case "help":
    case undefined:
      printHelp();
      return;
    default:
      console.error(`알 수 없는 tax 명령: ${sub}`);
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`qa-sdk tax — 텍소노미 yaml 검증

사용법:
  qa-sdk tax validate <file> [--strict] [--json]
  qa-sdk tax help
`);
}

function validateCmd(args: string[]): void {
  const strict = args.includes("--strict");
  const json = args.includes("--json");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("파일 경로 필요: qa-sdk tax validate <file>");
    process.exit(1);
  }

  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    console.error(`파일 읽기 실패: ${file} — ${(e as Error).message}`);
    process.exit(1);
    return;
  }

  const parsed = parse(text);
  if ("error" in parsed) {
    printDiagnostics([parsed.error], { json, file });
    process.exit(1);
  }

  const diags = validate(parsed.ir, undefined, { strict });
  printDiagnostics(diags, { json, file });
  const errors = diags.filter((d) => d.severity === "error");
  if (errors.length > 0) process.exit(1);
}

function printDiagnostics(
  diags: Diagnostic[],
  opts: { json: boolean; file?: string },
): void {
  if (opts.json) {
    console.log(JSON.stringify(diags, null, 2));
    return;
  }

  if (diags.length === 0) {
    console.log("✔ 검증 통과 (errors=0, warnings=0)");
    return;
  }

  const errs = diags.filter((d) => d.severity === "error").length;
  const warns = diags.filter((d) => d.severity === "warning").length;
  console.log(`${errs > 0 ? "✖" : "⚠"} ${errs} errors, ${warns} warnings`);
  console.log("");
  for (const d of diags) {
    const tag = d.severity === "error" ? "ERR " : d.severity === "warning" ? "WARN" : "INFO";
    console.log(`  ${tag} ${d.code}`);
    if (d.ref) console.log(`       ${d.ref}`);
    console.log(`       ${d.message}`);
    if (d.hint) console.log(`       hint: ${d.hint}`);
    console.log("");
  }
}
```

- [ ] **Step 5: command-group 등록**

`packages/cli/src/command-groups/taxonomy.commands.ts`:

```typescript
import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
import { cliTaxonomy } from "../commands/taxonomy.js";

export const TAXONOMY_COMMAND_DESCRIPTORS = [
  { id: "tax.help", path: ["help"], handlerKey: "tax.help" },
  { id: "tax.validate", path: ["validate"], handlerKey: "tax.validate" },
] as const satisfies readonly CommandDescriptor[];

export const TAXONOMY_COMMAND_TREE =
  descriptorsToTree(TAXONOMY_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const TAXONOMY_COMMAND_SPECS =
  collectCommandUsageSpecs(["tax"], TAXONOMY_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const TAXONOMY_TOP_LEVEL_USAGE_LINES = [
  "qa-sdk tax help                   도움말",
  "qa-sdk tax validate <file>         yaml 텍소노미 검증",
] as const;

export const TAXONOMY_HANDLER_REGISTRY = new Proxy({} as Record<string, RestCommandHandler>, {
  get(_target, prop) {
    if (typeof prop !== "string" || !prop.startsWith("tax.")) return undefined;
    return async (rest: string[]) => {
      const subcommand = prop.slice(4);
      await cliTaxonomy([...subcommand.split("."), ...rest]);
    };
  },
});
```

- [ ] **Step 6: index.ts wiring (3곳)**

`packages/cli/src/index.ts` — DEF wiring 옆에 추가:

(a) import 블록 (DEF import 옆):

```typescript
import {
  TAXONOMY_COMMAND_SPECS as TAXONOMY_GROUP_COMMAND_SPECS,
  TAXONOMY_COMMAND_TREE as TAXONOMY_GROUP_COMMAND_TREE,
  TAXONOMY_HANDLER_REGISTRY as TAXONOMY_GROUP_HANDLER_REGISTRY,
  TAXONOMY_TOP_LEVEL_USAGE_LINES as TAXONOMY_GROUP_TOP_LEVEL_USAGE_LINES,
} from './command-groups/taxonomy.commands.js';
```

(b) usage 출력 (DEF 라인 옆):

```typescript
${formatUsageLines(TAXONOMY_GROUP_TOP_LEVEL_USAGE_LINES)}
```

(c) dispatch table (DEF dispatch 옆):

```typescript
async function dispatchTaxonomyCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(TAXONOMY_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}
```

(d) TREE 등록 list 안:

```typescript
{ rootSegments: ['tax'], rootName: 'qa-sdk tax', tree: TAXONOMY_GROUP_COMMAND_TREE, dispatch: dispatchTaxonomyCommand },
```

- [ ] **Step 7: 테스트 + 빌드 통과**

Run:
```bash
pnpm --filter @qa-sdk/cli test taxonomy.test
pnpm --filter @qa-sdk/cli build
```
Expected: 3 passed + 빌드 성공

- [ ] **Step 8: 실제 도그푸딩 yaml로 CLI 실행 확인**

Run:
```bash
pnpm --filter @qa-sdk/cli build
node packages/cli/dist/index.js tax validate docs/taxonomies/qa-sdk-coordinate-system.yaml
```
Expected: `✔ 검증 통과` 출력, exit 0

- [ ] **Step 9: 커밋**

```bash
git add packages/cli
git commit -m "feat(cli): add 'tax validate' command backed by taxonomy-engine (Task 10)"
```

---

## 후속 (Out of Scope — Open Issues)

이 plan은 spec §9의 Open Issues 중 핵심 라이브러리 + 최소 CLI만 다룬다. 후속 별도 plan:

- **Web UI** — 시각화/탐색 (라이브러리 + 진단 형식 공유)
- **lesson-builder 적용** — Layer 6단을 텍소노미로 표현, mono-story 런타임 연결
- **DKG 표현 PoC** — 15노드/18엣지를 텍소노미로 표현 가능한지
- **frontmatter 승격** — `docs/proposals/taxonomy-engine/` → `docs/specs/taxonomy-engine/` 이동 + def-catalog frontmatter 부여
- **Taxonomy registry 영속화** — 메모리 → 파일 / 서비스화
- **CLI 추가 명령** — §6.3 승격 기준 만족 시 (`show`, `codegen`, `diff` 등)

## Self-Review 결과

- Spec §1~§8 모든 섹션이 Task 0~10에 매핑됨 ✓
- placeholder/TBD 없음 ✓
- 함수 시그니처 일관성 — `parse/validate/parseRef/resolveRef/codegen/TaxonomyRegistry`가 Task 1~10에서 동일 ✓
- type 일관성 — `TaxonomyIR/AxisIR/EntryIR/Diagnostic/TaxonomyRef`가 Task 1에서 정의 후 변경 없음 ✓
- 의존 순서 — Task 0(scaffold) → 1(types) → 2(parse) → 3(ref) → 4(index) → 5(registry) → 6(validate, parse+ref) → 7(codegen, parse) → 8(public) → 9(dogfood, all) → 10(cli, all) — 사이클 없음 ✓
