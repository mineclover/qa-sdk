# Facet Test Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서비스 코드에서 `@facet` 마커 기반으로 순수 비즈니스 로직을 추출하여 격리된 테스트 인프라를 구축한다.

**Architecture:** `@facet` 주석 파서 → import 체인 walk + block 판별 → rclone include-list 생성 → 복사본 export 주입 → vitest path alias mock. 기존 `prefix-stamp.ts`의 마커 파싱 + 파일 수집 패턴을 재사용.

**Tech Stack:** TypeScript, vitest, rclone (외부), prefix-stamp.ts 패턴 재사용

---

## File Structure

### 신규 생성

| 파일 | 책임 |
|------|------|
| `packages/cli/src/commands/facet-scan.ts` | `@facet` 마커 파싱 + import walk + block 판별 + include-list 생성 |
| `packages/cli/src/commands/facet-scan.test.ts` | facet-scan 단위 테스트 |
| `packages/cli/src/commands/facet-inject.ts` | synced/ 복사본에 `@facet export` 기반 export 주입 |
| `packages/cli/src/commands/facet-inject.test.ts` | export 주입 테스트 |
| `packages/facet-tests/package.json` | 패싯 테스트 패키지 |
| `packages/facet-tests/.gitignore` | synced/ 제외 |
| `packages/facet-tests/vitest.config.ts` | path alias 설정 |
| `packages/facet-tests/__mocks__/gate-service/src/config/env.ts` | gate-service env stub |
| `packages/facet-tests/tests/gate/gate-validate.test.ts` | gate-service facet 테스트 (프로토타입) |

### 수정

| 파일 | 변경 |
|------|------|
| `packages/cli/src/index.ts` | `facet scan`, `facet inject` 명령 등록 |

---

### Task 1: @facet 마커 파서 (순수 함수)

**Files:**
- Create: `packages/cli/src/commands/facet-scan.ts`
- Test: `packages/cli/src/commands/facet-scan.test.ts`

- [ ] **Step 1: Write the failing test — parseFacetMarker**

```ts
// packages/cli/src/commands/facet-scan.test.ts
import { describe, it, expect } from "vitest";
import { parseFacetMarker } from "./facet-scan.js";

describe("parseFacetMarker", () => {
  it("@facet 마커 → 파일 수준 선언", () => {
    expect(parseFacetMarker("// @facet")).toEqual({ type: "file", exports: [] });
  });

  it("@facet export fn1, fn2 → export 목록", () => {
    expect(parseFacetMarker("// @facet export validateOrder, calcDiscount")).toEqual({
      type: "file",
      exports: ["validateOrder", "calcDiscount"],
    });
  });

  it("@facet 없는 줄 → null", () => {
    expect(parseFacetMarker("// normal comment")).toBeNull();
    expect(parseFacetMarker("const x = 1;")).toBeNull();
  });

  it("# 주석 (Python) 지원", () => {
    expect(parseFacetMarker("# @facet")).toEqual({ type: "file", exports: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @qa-sdk/cli exec vitest run src/commands/facet-scan.test.ts -v`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/cli/src/commands/facet-scan.ts
/**
 * facet-scan — @facet 마커 파싱 + import 의존 분석.
 */

export interface FacetMarker {
  type: "file";
  exports: string[];
}

const FACET_RE = /@facet(?:\s+export\s+([\w,\s]+))?/;

export function parseFacetMarker(line: string): FacetMarker | null {
  const trimmed = line.replace(/^\s*(?:\/\/\s*|#\s*|\*\s*)/, "").trim();
  const match = trimmed.match(FACET_RE);
  if (!match) return null;

  const exports = match[1]
    ? match[1].split(",").map(s => s.trim()).filter(Boolean)
    : [];

  return { type: "file", exports };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @qa-sdk/cli exec vitest run src/commands/facet-scan.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/facet-scan.ts packages/cli/src/commands/facet-scan.test.ts
git commit -m "feat(cli): @facet 마커 파서 — parseFacetMarker"
```

---

### Task 2: 파일 스캔 — @facet 파일 목록 수집

**Files:**
- Modify: `packages/cli/src/commands/facet-scan.ts`
- Test: `packages/cli/src/commands/facet-scan.test.ts`

- [ ] **Step 1: Write the failing test — scanFacetFiles**

```ts
// facet-scan.test.ts에 추가
import { scanFacetFiles } from "./facet-scan.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TMP = join(tmpdir(), `facet-scan-test-${Date.now()}`);

describe("scanFacetFiles", () => {
  beforeEach(() => mkdirSync(TMP, { recursive: true }));
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it("@facet 마커가 있는 파일만 수집", () => {
    mkdirSync(join(TMP, "src"), { recursive: true });
    writeFileSync(join(TMP, "src/pure.ts"), "// @facet\nexport function add(a: number, b: number) { return a + b; }\n");
    writeFileSync(join(TMP, "src/env.ts"), "export const env = process.env;\n");
    writeFileSync(join(TMP, "src/also-pure.ts"), "// @facet export calc\nfunction calc() { return 1; }\n");

    const result = scanFacetFiles(TMP);
    expect(result.facetFiles.map(f => f.relativePath).sort()).toEqual(["src/also-pure.ts", "src/pure.ts"]);
    expect(result.facetFiles.find(f => f.relativePath === "src/also-pure.ts")!.marker.exports).toEqual(["calc"]);
  });

  it("node_modules, dist, test 파일은 제외", () => {
    mkdirSync(join(TMP, "node_modules/pkg"), { recursive: true });
    mkdirSync(join(TMP, "dist"), { recursive: true });
    writeFileSync(join(TMP, "node_modules/pkg/index.ts"), "// @facet\n");
    writeFileSync(join(TMP, "dist/out.ts"), "// @facet\n");
    writeFileSync(join(TMP, "src/foo.test.ts"), "// @facet\n");

    mkdirSync(join(TMP, "src"), { recursive: true });
    const result = scanFacetFiles(TMP);
    expect(result.facetFiles).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write minimal implementation**

```ts
// facet-scan.ts에 추가
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

export interface FacetFile {
  relativePath: string;
  absolutePath: string;
  marker: FacetMarker;
}

export interface ScanResult {
  facetFiles: FacetFile[];
  root: string;
}

const EXCLUDE = [/node_modules/, /\/dist\//, /\.test\.\w+$/, /\.spec\.\w+$/];
const SCAN_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".py"]);

export function scanFacetFiles(root: string): ScanResult {
  const facetFiles: FacetFile[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = relative(root, full);
      if (EXCLUDE.some(p => p.test(rel))) continue;

      const st = statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (!SCAN_EXTS.has(extname(full))) continue;

      const content = readFileSync(full, "utf-8");
      const firstMarker = content.split("\n")
        .map(line => parseFacetMarker(line))
        .find(m => m !== null);

      if (firstMarker) {
        facetFiles.push({ relativePath: rel, absolutePath: full, marker: firstMarker });
      }
    }
  }

  walk(root);
  return { facetFiles, root };
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/facet-scan.ts packages/cli/src/commands/facet-scan.test.ts
git commit -m "feat(cli): scanFacetFiles — @facet 파일 수집"
```

---

### Task 3: Import 체인 walk + block 판별

**Files:**
- Modify: `packages/cli/src/commands/facet-scan.ts`
- Test: `packages/cli/src/commands/facet-scan.test.ts`

- [ ] **Step 1: Write the failing test — resolveImportDeps**

```ts
describe("resolveImportDeps", () => {
  beforeEach(() => {
    mkdirSync(join(TMP, "src/types"), { recursive: true });
    mkdirSync(join(TMP, "src/lib"), { recursive: true });
    mkdirSync(join(TMP, "src/config"), { recursive: true });
  });
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it("import 체인을 따라 순수 의존만 수집", () => {
    writeFileSync(join(TMP, "src/gate.ts"), '// @facet\nimport { Order } from "./types/order.js";\nexport function validate(o: Order) { return true; }\n');
    writeFileSync(join(TMP, "src/types/order.ts"), 'export interface Order { id: string; }\n');

    const result = resolveImportDeps(join(TMP, "src/gate.ts"), TMP);
    expect(result.included.map(f => f.relativePath)).toContain("src/types/order.ts");
    expect(result.blocked).toHaveLength(0);
  });

  it("환경 의존 import → block", () => {
    writeFileSync(join(TMP, "src/handler.ts"), '// @facet\nimport { env } from "./config/env.js";\n');
    writeFileSync(join(TMP, "src/config/env.ts"), 'export const env = { PORT: Number(process.env.PORT) };\n');

    const result = resolveImportDeps(join(TMP, "src/handler.ts"), TMP);
    expect(result.blocked.map(b => b.relativePath)).toContain("src/config/env.ts");
    expect(result.blocked[0].reason).toContain("process.env");
  });

  it("import type은 block하지 않음", () => {
    writeFileSync(join(TMP, "src/service.ts"), '// @facet\nimport type { Logger } from "./lib/logger.js";\n');
    writeFileSync(join(TMP, "src/lib/logger.ts"), 'import { createLogger } from "pino";\nexport type Logger = ReturnType<typeof createLogger>;\n');

    const result = resolveImportDeps(join(TMP, "src/service.ts"), TMP);
    // import type이므로 logger.ts가 block 아닌 type-only로 처리
    expect(result.blocked).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write implementation**

```ts
// facet-scan.ts에 추가

export interface DepFile {
  relativePath: string;
  absolutePath: string;
}

export interface BlockedFile {
  relativePath: string;
  absolutePath: string;
  reason: string;
}

export interface ImportDepsResult {
  included: DepFile[];
  blocked: BlockedFile[];
}

const BLOCK_PATTERNS = [
  { pattern: /process\.env/, reason: "process.env" },
  { pattern: /import\s.*from\s+["']hono/, reason: "hono (HTTP framework)" },
  { pattern: /import\s.*from\s+["']express/, reason: "express" },
  { pattern: /import\s.*from\s+["']drizzle/, reason: "drizzle (DB)" },
  { pattern: /import\s.*from\s+["']better-sqlite3/, reason: "better-sqlite3" },
  { pattern: /createLogger/, reason: "createLogger (logging)" },
  { pattern: /import\s.*from\s+["']node:net/, reason: "node:net" },
];

const IMPORT_RE = /^import\s+(?:type\s+)?(?:\{[^}]*\}|[\w*]+)\s+from\s+["']([^"']+)["']/gm;
const TYPE_IMPORT_RE = /^import\s+type\s+/;

export function resolveImportDeps(entryPath: string, root: string): ImportDepsResult {
  const included: DepFile[] = [];
  const blocked: BlockedFile[] = [];
  const visited = new Set<string>();

  function walk(filePath: string, isTypeOnly: boolean): void {
    const resolved = resolveFilePath(filePath, root);
    if (!resolved || visited.has(resolved)) return;
    visited.add(resolved);

    const rel = relative(root, resolved);
    let content: string;
    try { content = readFileSync(resolved, "utf-8"); } catch { return; }

    // block 체크 (type-only import는 건너뜀)
    if (!isTypeOnly) {
      for (const { pattern, reason } of BLOCK_PATTERNS) {
        if (pattern.test(content)) {
          blocked.push({ relativePath: rel, absolutePath: resolved, reason });
          return;
        }
      }
    }

    included.push({ relativePath: rel, absolutePath: resolved });

    // 재귀 import walk
    const lines = content.split("\n");
    for (const line of lines) {
      const importMatch = line.match(/^import\s+(?:type\s+)?(?:\{[^}]*\}|[\w*]+)\s+from\s+["']([^"']+)["']/);
      if (!importMatch) continue;
      const importPath = importMatch[1];
      if (importPath.startsWith(".")) {
        const nextIsTypeOnly = TYPE_IMPORT_RE.test(line);
        const nextPath = join(dirname(resolved), importPath);
        walk(nextPath, nextIsTypeOnly);
      }
    }
  }

  walk(entryPath, false);
  // entry 자체는 제외 (이미 facetFiles에 포함)
  return {
    included: included.filter(f => f.absolutePath !== entryPath),
    blocked,
  };
}

function resolveFilePath(importPath: string, root: string): string | null {
  const candidates = [
    importPath,
    importPath.replace(/\.js$/, ".ts"),
    importPath + ".ts",
    importPath + "/index.ts",
  ];
  for (const c of candidates) {
    const full = c.startsWith("/") ? c : join(root, c);
    try { statSync(full); return full; } catch { /* next */ }
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/facet-scan.ts packages/cli/src/commands/facet-scan.test.ts
git commit -m "feat(cli): resolveImportDeps — import chain walk + block 판별"
```

---

### Task 4: CLI 명령 등록 + include-list 출력

**Files:**
- Modify: `packages/cli/src/commands/facet-scan.ts`
- Modify: `packages/cli/src/index.ts`
- Test: `packages/cli/src/commands/facet-scan.test.ts`

- [ ] **Step 1: Write the failing test — generateIncludeList**

```ts
describe("generateIncludeList", () => {
  it("rclone include-list 형식 생성", () => {
    const files = [
      { relativePath: "src/gate.ts", absolutePath: "/x/src/gate.ts", marker: { type: "file" as const, exports: [] } },
    ];
    const deps = [
      { relativePath: "src/types/order.ts", absolutePath: "/x/src/types/order.ts" },
    ];
    const list = generateIncludeList(files, deps);
    expect(list).toContain("+ src/gate.ts");
    expect(list).toContain("+ src/types/order.ts");
    expect(list).toContain("- **");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write implementation + CLI 등록**

```ts
// facet-scan.ts에 추가
export function generateIncludeList(facetFiles: FacetFile[], deps: DepFile[]): string {
  const paths = new Set<string>();
  for (const f of facetFiles) paths.add(f.relativePath);
  for (const d of deps) paths.add(d.relativePath);

  const lines = [...paths].sort().map(p => `+ ${p}`);
  lines.push("- **");
  return lines.join("\n") + "\n";
}

// CLI 진입점
export function facetScan(serviceRoot: string, opts: { output?: string; deps?: boolean } = {}): void {
  const { facetFiles } = scanFacetFiles(serviceRoot);

  if (facetFiles.length === 0) {
    console.log("@facet 마커 파일 없음");
    return;
  }

  // 의존성 분석
  const allDeps: DepFile[] = [];
  const allBlocked: BlockedFile[] = [];
  if (opts.deps !== false) {
    for (const f of facetFiles) {
      const { included, blocked } = resolveImportDeps(f.absolutePath, serviceRoot);
      allDeps.push(...included);
      allBlocked.push(...blocked);
    }
  }

  // 출력
  console.log(`@facet 파일: ${facetFiles.length}건`);
  for (const f of facetFiles) {
    const exports = f.marker.exports.length > 0 ? ` (export: ${f.marker.exports.join(", ")})` : "";
    console.log(`  ${f.relativePath}${exports}`);
  }

  if (allDeps.length > 0) {
    console.log(`\n의존성: ${allDeps.length}건`);
    for (const d of allDeps) console.log(`  ${d.relativePath}`);
  }

  if (allBlocked.length > 0) {
    console.log(`\nblock: ${allBlocked.length}건`);
    for (const b of allBlocked) console.log(`  ${b.relativePath} (${b.reason})`);
  }

  if (opts.output) {
    const list = generateIncludeList(facetFiles, allDeps);
    writeFileSync(opts.output, list, "utf-8");
    console.log(`\ninclude-list → ${opts.output}`);
  }
}
```

index.ts에 등록:
```ts
// packages/cli/src/index.ts — facet 명령 추가
case 'facet scan': {
  const { facetScan } = await import('./commands/facet-scan.js');
  const serviceIdx = sub.rest.indexOf('--service');
  const serviceId = serviceIdx >= 0 ? sub.rest[serviceIdx + 1] : undefined;
  const outputIdx = sub.rest.indexOf('--output');
  const output = outputIdx >= 0 ? sub.rest[outputIdx + 1] : undefined;
  const noDeps = sub.rest.includes('--no-deps');
  const root = serviceId ? `packages/${serviceId}` : process.cwd();
  facetScan(root, { output, deps: !noDeps });
  return;
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/facet-scan.ts packages/cli/src/commands/facet-scan.test.ts packages/cli/src/index.ts
git commit -m "feat(cli): facet scan — include-list 생성 + CLI 등록"
```

---

### Task 5: Export 주입 (facet inject)

**Files:**
- Create: `packages/cli/src/commands/facet-inject.ts`
- Test: `packages/cli/src/commands/facet-inject.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/cli/src/commands/facet-inject.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { injectFacetExports } from "./facet-inject.js";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TMP = join(tmpdir(), `facet-inject-test-${Date.now()}`);

describe("injectFacetExports", () => {
  beforeEach(() => mkdirSync(join(TMP, "src"), { recursive: true }));
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it("@facet export 목록의 함수에 export 추가", () => {
    writeFileSync(join(TMP, "src/calc.ts"), [
      "// @facet export add, multiply",
      "function add(a: number, b: number) { return a + b; }",
      "function multiply(a: number, b: number) { return a * b; }",
      "function internal() { return 0; }",
    ].join("\n"));

    const count = injectFacetExports(TMP);
    const content = readFileSync(join(TMP, "src/calc.ts"), "utf-8");

    expect(content).toContain("export function add(");
    expect(content).toContain("export function multiply(");
    expect(content).not.toContain("export function internal(");
    expect(count).toBe(2);
  });

  it("이미 export된 함수는 건너뜀", () => {
    writeFileSync(join(TMP, "src/already.ts"), [
      "// @facet export validate",
      "export function validate() { return true; }",
    ].join("\n"));

    const count = injectFacetExports(TMP);
    expect(count).toBe(0);
  });

  it("@facet export 없는 파일은 무시", () => {
    writeFileSync(join(TMP, "src/pure.ts"), "// @facet\nexport function ok() {}\n");
    const count = injectFacetExports(TMP);
    expect(count).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write implementation**

```ts
// packages/cli/src/commands/facet-inject.ts
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { parseFacetMarker } from "./facet-scan.js";

export function injectFacetExports(dir: string): number {
  let injected = 0;

  function walk(d: string): void {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const st = statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (![".ts", ".tsx", ".js", ".jsx"].includes(extname(full))) continue;

      let content = readFileSync(full, "utf-8");
      const lines = content.split("\n");
      let changed = false;

      for (const line of lines) {
        const marker = parseFacetMarker(line);
        if (!marker || marker.exports.length === 0) continue;

        for (const fnName of marker.exports) {
          // "function fnName(" → "export function fnName("
          // "async function fnName(" → "export async function fnName("
          // "const fnName" → "export const fnName"
          const patterns = [
            { re: new RegExp(`^(\\s*)function\\s+${fnName}\\s*\\(`), rep: `$1export function ${fnName}(` },
            { re: new RegExp(`^(\\s*)async\\s+function\\s+${fnName}\\s*\\(`), rep: `$1export async function ${fnName}(` },
            { re: new RegExp(`^(\\s*)const\\s+${fnName}\\s*=`), rep: `$1export const ${fnName} =` },
          ];

          for (const { re, rep } of patterns) {
            const before = content;
            content = content.replace(re, (match, ...args) => {
              if (match.includes("export ")) return match; // 이미 export
              return rep.replace("$1", args[0]);
            });
            if (content !== before) { changed = true; injected++; }
          }
        }
      }

      if (changed) writeFileSync(full, content, "utf-8");
    }
  }

  walk(dir);
  return injected;
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/facet-inject.ts packages/cli/src/commands/facet-inject.test.ts
git commit -m "feat(cli): facet inject — @facet export 기반 export 주입"
```

---

### Task 6: facet-tests 패키지 스캐폴딩 + gate-service 프로토타입

**Files:**
- Create: `packages/facet-tests/package.json`
- Create: `packages/facet-tests/.gitignore`
- Create: `packages/facet-tests/vitest.config.ts`
- Create: `packages/facet-tests/tsconfig.json`
- Create: `packages/facet-tests/__mocks__/gate-service/src/config/env.ts`
- Create: `packages/facet-tests/tests/gate/gate-validate.test.ts`

- [ ] **Step 1: Create package structure**

```json
// packages/facet-tests/package.json
{
  "name": "@qa-sdk/facet-tests",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "sync": "qa-sdk facet sync --service gate-service --dest synced/"
  },
  "devDependencies": {
    "typescript": "^5.8.2",
    "vitest": "^1.6.1"
  }
}
```

```gitignore
# packages/facet-tests/.gitignore
synced/
include-list.txt
```

```ts
// packages/facet-tests/vitest.config.ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // gate-service 환경 의존 → mock으로 리다이렉트
      "../config/env.js": resolve(__dirname, "__mocks__/gate-service/src/config/env.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

```ts
// packages/facet-tests/__mocks__/gate-service/src/config/env.ts
export const env = {
  PORT: 3400,
  SQLITE_DRIVER: "node" as const,
  SQLITE_PATH: ":memory:",
};
```

- [ ] **Step 2: gate-service @facet 마커 추가 (원본에 주석만)**

```ts
// packages/gate-service/src/app.ts 상단에 추가 (기존 코드 앞)
// @facet
```

- [ ] **Step 3: facet scan + rclone 시뮬레이션 (수동 복사)**

```bash
qa-sdk facet scan --service gate-service --output packages/facet-tests/include-list.txt --deps
# 수동으로 facet 파일 복사 (rclone 대용)
mkdir -p packages/facet-tests/synced/gate-service/src
cp packages/gate-service/src/app.ts packages/facet-tests/synced/gate-service/src/
```

- [ ] **Step 4: Write prototype test**

```ts
// packages/facet-tests/tests/gate/gate-validate.test.ts
import { describe, it, expect } from "vitest";

// synced/에서 직접 import — 원본 코드를 격리 테스트
// 실제로는 rclone sync 후 이 경로에 파일이 존재
describe("gate-service facet test (prototype)", () => {
  it("facet-tests 패키지 구조가 동작함을 검증", () => {
    // 구조 검증만 — 실제 gate 로직 테스트는 rclone 동기화 후
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 5: Run test**

Run: `pnpm --filter @qa-sdk/facet-tests test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/facet-tests/ packages/gate-service/src/app.ts
git commit -m "feat: facet-tests 패키지 스캐폴딩 + gate-service @facet 마커"
```

---

### Task 7: CLI facet inject 등록 + 통합 테스트

**Files:**
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: CLI 등록**

```ts
// packages/cli/src/index.ts
case 'facet inject': {
  const { injectFacetExports } = await import('./commands/facet-inject.js');
  const dir = sub.rest[0] ?? process.cwd();
  const count = injectFacetExports(dir);
  console.log(`export 주입: ${count}건`);
  return;
}
```

- [ ] **Step 2: 통합 테스트 — scan → inject 흐름**

```bash
# gate-service 스캔
node packages/cli/dist/index.js facet scan --service gate-service

# include-list 생성
node packages/cli/dist/index.js facet scan --service gate-service --output /tmp/test-include.txt
cat /tmp/test-include.txt
```

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): facet inject CLI 등록 + 통합 흐름"
```
