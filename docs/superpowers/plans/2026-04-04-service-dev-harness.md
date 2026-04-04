# Service Dev Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TestScenario 독립 레지스트리(B 좌표) + spec-first CLI 워크플로우로 서비스 개발 하네스 1단계를 구현한다.

**Architecture:** 스펙 frontmatter의 `tests:` 선언이 A 좌표(파생)를 생성하고, `qa-sdk test assign`이 B 좌표(`test_scenario:v1:M`)를 부여한다. `test-scenario-store` 패키지가 SQLite 레지스트리를, CLI가 scan/assign/scaffold/status/report 워크플로우를 담당한다.

**Tech Stack:** TypeScript, vitest, drizzle-orm 1.0.0-beta.20, node:sqlite (index-meta), tsup (dual ESM+CJS), parseArgs

**Note:** 0단계(sum model 선행 작업)는 이미 구현 완료 — `packages/core/src/catalog/catalog.types.ts` + `path-summation.ts` 참조.

---

## 파일 구조

```
packages/test-scenario-store/       ← 신규 패키지
  src/
    types.ts                        — TestKind, TestScope, TestLifecycle, TestScenario 타입
    db/schema.ts                    — drizzle 스키마 (test_scenarios, test_scenario_runs)
    store.ts                        — SqliteTestScenarioStore 클래스
    index.ts                        — public exports
  drizzle/                          — 마이그레이션 파일 (drizzle-kit generate로 생성)
  drizzle.config.ts
  package.json
  tsconfig.json
  tsup.config.ts

packages/demo-snapshot/src/
  demo-catalog.ts                   — test_kind, test_scope, test_seq 축 + test_scenario prefix 추가

packages/cli/src/
  commands/test.ts                  — testScan, testAssign, testScaffold, testStatus, testReport
  index.ts                          — test 명령군 import + switch case 추가
```

---

## Task 1: demo-catalog에 test 축 + prefix 추가

**Files:**
- Modify: `packages/demo-snapshot/src/demo-catalog.ts`

- [ ] **Step 1: DEMO_CATALOG.axes에 test_kind 축 추가**

`packages/demo-snapshot/src/demo-catalog.ts`의 `DEMO_CATALOG` 객체 `axes` 섹션에 추가:

```typescript
test_kind: {
  id: "test_kind",
  name: "테스트 유형",
  versions: {
    v1: {
      entries: [
        "unit",
        "ui-logic",
        "ui",
        "db-transaction",
        "data-exchange",
        "auth-flow",
        "e2e",
        "simulation",
      ],
      capacity: 16,
    },
  },
},
test_scope: {
  id: "test_scope",
  name: "테스트 범위",
  versions: {
    v1: {
      entries: ["single", "pair", "multi", "system"],
      capacity: 8,
    },
  },
},
test_seq: {
  id: "test_seq",
  name: "테스트 시나리오 순번",
  versions: {
    v1: {
      entries: [] as const, // 동적 할당, 빈 배열
      capacity: 2048,
    },
  },
},
```

- [ ] **Step 2: DEMO_CATALOG.prefixes에 test_scenario prefix 추가**

```typescript
test_scenario: {
  id: "test_scenario",
  name: "테스트 시나리오",
  description: "스펙 의도와 연결된 테스트 시나리오 좌표",
  labels: ["test_kind", "test_scope", "test_seq"],
  dims: {
    test_kind: { kind: "axis", axisId: "test_kind" },
    test_scope: { kind: "axis", axisId: "test_scope" },
    test_seq:   { kind: "axis", axisId: "test_seq" },
  },
  versions: [
    {
      version: "v1",
      axisVersions: {
        test_kind:  "v1",
        test_scope: "v1",
        test_seq:   "v1",
      },
    },
  ],
  meta: {
    category: "state",
    layer: 2,
    detailKind: "generic",
  },
  addressModel: "product",
} satisfies PrefixDef,
```

- [ ] **Step 3: 빌드 + 타입 체크**

```bash
pnpm --filter demo-snapshot build
pnpm --filter demo-snapshot typecheck
```

Expected: 빌드 성공, 타입 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add packages/demo-snapshot/src/demo-catalog.ts
git commit -m "feat: demo-catalog에 test_kind/test_scope/test_scenario 추가"
```

---

## Task 2: test-scenario-store 패키지 생성

**Files:**
- Create: `packages/test-scenario-store/package.json`
- Create: `packages/test-scenario-store/tsconfig.json`
- Create: `packages/test-scenario-store/tsup.config.ts`
- Create: `packages/test-scenario-store/drizzle.config.ts`
- Create: `packages/test-scenario-store/src/types.ts`
- Create: `packages/test-scenario-store/src/db/schema.ts`
- Create: `packages/test-scenario-store/src/store.ts`
- Create: `packages/test-scenario-store/src/index.ts`

- [ ] **Step 1: package.json 생성**

```json
{
  "name": "test-scenario-store",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "db:generate": "drizzle-kit generate"
  },
  "dependencies": {
    "drizzle-orm": "1.0.0-beta.20",
    "index-meta": "workspace:*"
  },
  "devDependencies": {
    "drizzle-kit": "1.0.0-beta.20",
    "tsup": "*",
    "typescript": "*",
    "vitest": "*"
  }
}
```

- [ ] **Step 2: tsconfig.json 생성**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: tsup.config.ts 생성**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  onSuccess: "cp -r drizzle dist/drizzle 2>/dev/null || true",
});
```

- [ ] **Step 4: drizzle.config.ts 생성**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
```

- [ ] **Step 5: src/types.ts 생성**

```typescript
export type TestKind =
  | "unit"
  | "ui-logic"
  | "ui"
  | "db-transaction"
  | "data-exchange"
  | "auth-flow"
  | "e2e"
  | "simulation";

export type TestScope = "single" | "pair" | "multi" | "system";

export type TestLifecycle =
  | "declared"
  | "assigned"
  | "collected"
  | "verified"
  | "archived";

export interface TestScenario {
  /** B 좌표 — test_scenario:v1:M (assigned 이후 부여) */
  id: string;
  /** A 좌표 — def:{spec_address}/{test_kind} */
  aCoord: string;
  /** 스펙 문서 address (def_document:v2:N) */
  specAddress: string;
  kind: TestKind;
  scope: TestScope;
  lifecycle: TestLifecycle;
  /** 테스트 의도 (스펙 frontmatter tests[].intent) */
  intent: string;
  /** 진입점 서비스 모듈 import 경로 */
  primarySvc: string;
  /** 교차 서비스 목록 (JSON 직렬화) */
  participants: string[];
  /** 실제 테스트 파일 경로 */
  filePath: string | null;
  /** 연결된 PipeSpec 주소 (simulation 타입) */
  simulationRef: string | null;
  /** 스펙 lifecycle 버전 */
  specVersion: string | null;
  /** convention_violation 마킹 */
  conventionViolation: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TestScenarioRun {
  id: number;
  scenarioId: string;
  passed: boolean;
  commitHash: string | null;
  runAt: string;
  durationMs: number | null;
}

export interface CreateTestScenarioInput {
  aCoord: string;
  specAddress: string;
  kind: TestKind;
  scope: TestScope;
  intent: string;
  primarySvc: string;
  participants?: string[];
}
```

- [ ] **Step 6: src/db/schema.ts 생성**

```typescript
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const testScenarios = sqliteTable(
  "test_scenarios",
  {
    id: text("id").primaryKey(),
    aCoord: text("a_coord").notNull().unique(),
    specAddress: text("spec_address").notNull(),
    kind: text("kind").notNull(),
    scope: text("scope").notNull().default("single"),
    lifecycle: text("lifecycle").notNull().default("declared"),
    intent: text("intent").notNull(),
    primarySvc: text("primary_svc").notNull(),
    participants: text("participants").notNull().default("[]"),
    filePath: text("file_path"),
    simulationRef: text("simulation_ref"),
    specVersion: text("spec_version"),
    conventionViolation: integer("convention_violation", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_ts_spec").on(table.specAddress),
    index("idx_ts_kind").on(table.kind),
    index("idx_ts_lifecycle").on(table.lifecycle),
  ],
);

export const testScenarioRuns = sqliteTable(
  "test_scenario_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scenarioId: text("scenario_id").notNull(),
    passed: integer("passed", { mode: "boolean" }).notNull(),
    commitHash: text("commit_hash"),
    durationMs: integer("duration_ms"),
    runAt: text("run_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_tsr_scenario").on(table.scenarioId),
    index("idx_tsr_run_at").on(table.runAt),
  ],
);
```

- [ ] **Step 7: src/store.ts 생성**

```typescript
import { getDatabaseSync, type DatabaseSyncInstance } from "index-meta";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { eq, and } from "drizzle-orm";
import { resolve } from "node:path";
import { testScenarios, testScenarioRuns } from "./db/schema.js";
import type {
  TestScenario,
  TestScenarioRun,
  CreateTestScenarioInput,
  TestLifecycle,
} from "./types.js";

type DrizzleDb = ReturnType<typeof drizzle>;

export class SqliteTestScenarioStore {
  private rawDb: DatabaseSyncInstance;
  private db: DrizzleDb;

  constructor(path: string = ":memory:") {
    const DatabaseSync = getDatabaseSync();
    this.rawDb = new DatabaseSync(path);
    this.rawDb.exec("PRAGMA journal_mode = WAL");
    this.rawDb.exec("PRAGMA busy_timeout = 3000");
    this.db = drizzle({ client: this.rawDb });
    migrate(this.db, {
      migrationsFolder: resolve(__dirname, "../drizzle"),
    });
  }

  upsertDeclared(input: CreateTestScenarioInput): void {
    const existing = this.db
      .select()
      .from(testScenarios)
      .where(eq(testScenarios.aCoord, input.aCoord))
      .get();

    if (existing) return; // 이미 존재하면 skip (lifecycle 변경 안 함)

    this.db.insert(testScenarios).values({
      id: input.aCoord, // declared 상태에서는 A 좌표가 임시 id
      aCoord: input.aCoord,
      specAddress: input.specAddress,
      kind: input.kind,
      scope: input.scope ?? "single",
      lifecycle: "declared",
      intent: input.intent,
      primarySvc: input.primarySvc,
      participants: JSON.stringify(input.participants ?? []),
    }).run();
  }

  assign(aCoord: string, bCoord: string, filePath: string, violation: boolean): void {
    this.db
      .update(testScenarios)
      .set({
        id: bCoord,
        lifecycle: "assigned",
        filePath,
        conventionViolation: violation,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(testScenarios.aCoord, aCoord))
      .run();
  }

  recordRun(scenarioId: string, passed: boolean, commitHash: string | null, durationMs: number | null): void {
    this.db.insert(testScenarioRuns).values({
      scenarioId,
      passed,
      commitHash,
      durationMs,
    }).run();

    // collected 상태로 전이 (아직 collected 아니면)
    const scenario = this.getById(scenarioId);
    if (scenario && scenario.lifecycle === "assigned") {
      this.db
        .update(testScenarios)
        .set({ lifecycle: "collected", updatedAt: new Date().toISOString() })
        .where(eq(testScenarios.id, scenarioId))
        .run();
    }
  }

  getByACoord(aCoord: string): TestScenario | undefined {
    const row = this.db
      .select()
      .from(testScenarios)
      .where(eq(testScenarios.aCoord, aCoord))
      .get();
    return row ? this.rowToScenario(row) : undefined;
  }

  getById(id: string): TestScenario | undefined {
    const row = this.db
      .select()
      .from(testScenarios)
      .where(eq(testScenarios.id, id))
      .get();
    return row ? this.rowToScenario(row) : undefined;
  }

  listAll(): TestScenario[] {
    return this.db.select().from(testScenarios).all().map(r => this.rowToScenario(r));
  }

  listByLifecycle(lifecycle: TestLifecycle): TestScenario[] {
    return this.db
      .select()
      .from(testScenarios)
      .where(eq(testScenarios.lifecycle, lifecycle))
      .all()
      .map(r => this.rowToScenario(r));
  }

  nextSeq(kind: string, scope: string): number {
    const count = this.db
      .select()
      .from(testScenarios)
      .where(and(eq(testScenarios.kind, kind), eq(testScenarios.scope, scope)))
      .all().length;
    return count + 1;
  }

  private rowToScenario(row: typeof testScenarios.$inferSelect): TestScenario {
    return {
      id: row.id,
      aCoord: row.aCoord,
      specAddress: row.specAddress,
      kind: row.kind as TestScenario["kind"],
      scope: row.scope as TestScenario["scope"],
      lifecycle: row.lifecycle as TestScenario["lifecycle"],
      intent: row.intent,
      primarySvc: row.primarySvc,
      participants: JSON.parse(row.participants),
      filePath: row.filePath,
      simulationRef: row.simulationRef,
      specVersion: row.specVersion,
      conventionViolation: row.conventionViolation,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
```

- [ ] **Step 8: src/index.ts 생성**

```typescript
export { SqliteTestScenarioStore } from "./store.js";
export type {
  TestKind,
  TestScope,
  TestLifecycle,
  TestScenario,
  TestScenarioRun,
  CreateTestScenarioInput,
} from "./types.js";
```

- [ ] **Step 9: drizzle 마이그레이션 생성**

```bash
cd packages/test-scenario-store
pnpm db:generate
```

Expected: `drizzle/` 폴더에 `*.sql` 마이그레이션 파일 생성됨

- [ ] **Step 10: 빌드**

```bash
pnpm --filter test-scenario-store build
```

Expected: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` 생성, `dist/drizzle/` 복사됨

- [ ] **Step 11: 기본 store 테스트 작성 + 실행**

`packages/test-scenario-store/src/store.test.ts` 생성:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { SqliteTestScenarioStore } from "./store.js";

describe("SqliteTestScenarioStore", () => {
  let store: SqliteTestScenarioStore;

  beforeEach(() => {
    store = new SqliteTestScenarioStore(":memory:");
  });

  it("upsertDeclared → declared 상태로 저장", () => {
    store.upsertDeclared({
      aCoord: "def:42/unit",
      specAddress: "def:42",
      kind: "unit",
      scope: "single",
      intent: "입력 검증",
      primarySvc: "@qa-sdk/auth/process-auth",
    });

    const s = store.getByACoord("def:42/unit");
    expect(s?.lifecycle).toBe("declared");
    expect(s?.kind).toBe("unit");
  });

  it("중복 upsertDeclared는 skip", () => {
    const input = {
      aCoord: "def:42/unit",
      specAddress: "def:42",
      kind: "unit" as const,
      scope: "single" as const,
      intent: "테스트",
      primarySvc: "@qa-sdk/auth/process-auth",
    };
    store.upsertDeclared(input);
    store.upsertDeclared(input);
    expect(store.listAll().length).toBe(1);
  });

  it("assign → assigned 상태 + B 좌표 부여", () => {
    store.upsertDeclared({
      aCoord: "def:42/unit",
      specAddress: "def:42",
      kind: "unit",
      scope: "single",
      intent: "테스트",
      primarySvc: "@qa-sdk/auth/process-auth",
    });

    store.assign("def:42/unit", "test_scenario:v1:1", "packages/auth-service/src/auth.test.ts", false);

    const s = store.getById("test_scenario:v1:1");
    expect(s?.lifecycle).toBe("assigned");
    expect(s?.filePath).toBe("packages/auth-service/src/auth.test.ts");
  });

  it("recordRun → collected 상태 전이", () => {
    store.upsertDeclared({
      aCoord: "def:42/unit",
      specAddress: "def:42",
      kind: "unit",
      scope: "single",
      intent: "테스트",
      primarySvc: "@qa-sdk/auth/process-auth",
    });
    store.assign("def:42/unit", "test_scenario:v1:1", "auth.test.ts", false);
    store.recordRun("test_scenario:v1:1", true, "abc123", 200);

    const s = store.getById("test_scenario:v1:1");
    expect(s?.lifecycle).toBe("collected");
  });
});
```

```bash
pnpm --filter test-scenario-store test
```

Expected: 4 tests PASS

- [ ] **Step 12: pnpm workspace에 등록 확인**

```bash
pnpm --filter test-scenario-store build
```

Expected: 정상 빌드

- [ ] **Step 13: 커밋**

```bash
git add packages/test-scenario-store/
git commit -m "feat: test-scenario-store 패키지 추가 — SQLite TestScenario 레지스트리"
```

---

## Task 3: CLI qa-sdk test scan 구현

**Files:**
- Create: `packages/cli/src/commands/test.ts`

`qa-sdk test scan`은 `docs/` 하위 스펙 파일의 frontmatter `tests:` 배열을 읽어 `test-scenario-store`에 `declared` 상태로 upsert한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/cli/src/commands/test.test.ts` 생성:

```typescript
import { describe, it, expect } from "vitest";
import { parseTestsDeclaration } from "./test.js";

describe("parseTestsDeclaration", () => {
  it("frontmatter tests 배열 파싱", () => {
    const raw = [
      { kind: "unit", intent: "입력 검증", module: "@qa-sdk/auth/process-auth" },
      { kind: "auth-flow", intent: "관리자 권한", scope: "pair", participants: ["gateway"] },
    ];
    const result = parseTestsDeclaration(raw, "def:42");
    expect(result).toHaveLength(2);
    expect(result[0].aCoord).toBe("def:42/unit");
    expect(result[0].kind).toBe("unit");
    expect(result[1].scope).toBe("pair");
    expect(result[1].participants).toEqual(["gateway"]);
  });

  it("kind 없는 항목은 skip", () => {
    const raw = [{ intent: "의도만 있음" }];
    const result = parseTestsDeclaration(raw, "def:42");
    expect(result).toHaveLength(0);
  });
});
```

```bash
pnpm --filter @qa-sdk/cli test -- --reporter=verbose test.test.ts
```

Expected: FAIL (parseTestsDeclaration not found)

- [ ] **Step 2: packages/cli/src/commands/test.ts 생성**

```typescript
/**
 * qa-sdk test — TestScenario 하네스 CLI.
 *
 * scan:    스펙 frontmatter tests: 선언 → declared 상태 upsert
 * assign:  모듈화 체크 → B 좌표 부여 → assigned
 * scaffold: 테스트 스텁 파일 생성
 * status:  생명주기 현황 매트릭스
 * report:  커버리지 매트릭스
 */

import { join, relative, resolve, dirname } from "node:path";
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { SqliteTestScenarioStore } from "test-scenario-store";
import type { TestKind, TestScope, CreateTestScenarioInput } from "test-scenario-store";
import { getQaSdkDir } from "../lib/qa-dir.js";

const VALID_KINDS = new Set<string>([
  "unit", "ui-logic", "ui", "db-transaction",
  "data-exchange", "auth-flow", "e2e", "simulation",
]);
const VALID_SCOPES = new Set<string>(["single", "pair", "multi", "system"]);

// ── 파싱 유틸 (테스트 가능한 순수 함수) ──────────────────

export interface ParsedTestDeclaration {
  aCoord: string;
  specAddress: string;
  kind: TestKind;
  scope: TestScope;
  intent: string;
  primarySvc: string;
  participants: string[];
}

export function parseTestsDeclaration(
  raw: unknown[],
  specAddress: string,
): ParsedTestDeclaration[] {
  const results: ParsedTestDeclaration[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const kind = obj["kind"] as string | undefined;
    if (!kind || !VALID_KINDS.has(kind)) continue;

    const scope = (obj["scope"] as string | undefined) ?? "single";
    const intent = (obj["intent"] as string | undefined) ?? "";
    const primarySvc = (obj["module"] as string | undefined) ?? "";
    const participants = Array.isArray(obj["participants"])
      ? (obj["participants"] as string[])
      : [];

    results.push({
      aCoord: `${specAddress}/${kind}`,
      specAddress,
      kind: kind as TestKind,
      scope: VALID_SCOPES.has(scope) ? (scope as TestScope) : "single",
      intent,
      primarySvc,
      participants,
    });
  }
  return results;
}

// ── frontmatter 추출 (YAML-lite) ──────────────────────────

function extractFrontmatterTests(content: string): unknown[] {
  // tests: 섹션을 JSON 또는 YAML 배열로 파싱
  // 간단 구현: frontmatter 블록에서 tests: 이후를 읽음
  const match = content.match(/^---\n([\s\S]*?)\n---/m);
  if (!match) return [];
  const fm = match[1];

  // tests: 배열 찾기 (- kind: ... 형태)
  const testsMatch = fm.match(/^tests:\s*\n((?:  - [\s\S]*?)(?=\n\S|$))/m);
  if (!testsMatch) return [];

  // 단순 파싱: - kind: xxx 항목들을 파싱
  const lines = testsMatch[1].split("\n");
  const items: Record<string, unknown>[] = [];
  let current: Record<string, unknown> | null = null;

  for (const line of lines) {
    const itemMatch = line.match(/^  - (.+)/);
    if (itemMatch) {
      current = {};
      items.push(current);
      const kv = itemMatch[1].match(/^(\w+):\s*(.+)/);
      if (kv && current) current[kv[1]] = kv[2].trim();
      continue;
    }
    if (current && line.match(/^    \w+:/)) {
      const kv = line.trim().match(/^(\w+):\s*(.+)/);
      if (kv) current[kv[1]] = kv[2].trim();
    }
  }

  return items;
}

function extractSpecAddress(content: string): string | null {
  // def: id: xxx 또는 address: N 형태에서 address 추출
  const match = content.match(/address:\s*(\d+)/);
  if (match) return `def:${match[1]}`;
  // id fallback
  const idMatch = content.match(/^  id:\s*(.+)/m);
  if (idMatch) return `def:${idMatch[1].trim()}`;
  return null;
}

// ── testScan ─────────────────────────────────────────────

export function testScan(opts: { dir?: string; db?: string }): void {
  const root = opts.dir ?? process.cwd();
  const docsDir = join(root, "docs");
  const dbPath = opts.db ?? join(getQaSdkDir(), "test-scenarios.sqlite");

  if (!existsSync(docsDir)) {
    console.error(`docs/ 디렉토리 없음: ${docsDir}`);
    process.exitCode = 1;
    return;
  }

  const store = new SqliteTestScenarioStore(dbPath);
  let declared = 0;
  let skipped = 0;

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith(".spec.md")) continue;

      const content = readFileSync(fullPath, "utf-8");
      const specAddress = extractSpecAddress(content);
      if (!specAddress) continue;

      const rawTests = extractFrontmatterTests(content);
      if (rawTests.length === 0) continue;

      const parsed = parseTestsDeclaration(rawTests, specAddress);
      for (const p of parsed) {
        store.upsertDeclared(p);
        declared++;
      }
    }
  }

  walk(docsDir);
  console.log(`scan 완료: ${declared}개 선언됨, ${skipped}개 skip`);
}

// ── testAssign ───────────────────────────────────────────

export function testAssign(opts: { aCoord?: string; force?: boolean; db?: string }): void {
  const dbPath = opts.db ?? join(getQaSdkDir(), "test-scenarios.sqlite");
  const store = new SqliteTestScenarioStore(dbPath);

  const targets = opts.aCoord
    ? [store.getByACoord(opts.aCoord)].filter(Boolean)
    : store.listByLifecycle("declared");

  if (targets.length === 0) {
    console.log("할당할 declared 시나리오 없음. qa-sdk test scan을 먼저 실행하세요.");
    return;
  }

  for (const scenario of targets) {
    if (!scenario) continue;

    // 체크 1: import 경로 존재 여부
    const modulePath = scenario.primarySvc;
    const hasValidModule = modulePath.length > 0;

    let violation = false;

    if (!hasValidModule) {
      console.warn(`⚠ [${scenario.aCoord}] primarySvc 미선언 — 모듈 경로 추가 필요`);
      violation = true;
      if (!opts.force) {
        console.log("  --force로 강제 진행 가능");
        continue;
      }
    }

    // B 좌표 계산: test_scenario:v1:{seq}
    const seq = store.nextSeq(scenario.kind, scenario.scope);
    const bCoord = `test_scenario:v1:${seq}`;

    // file_path 기본값: 모듈 경로에서 .test.ts 파생
    const filePath = scenario.filePath ?? deriveFilePath(modulePath, scenario.kind);

    store.assign(scenario.aCoord, bCoord, filePath, violation);

    if (violation) {
      console.log(`⚠ ${scenario.aCoord} → ${bCoord} (convention_violation 마킹)`);
    } else {
      console.log(`✓ ${scenario.aCoord} → ${bCoord}`);
    }
  }
}

function deriveFilePath(modulePath: string, kind: TestKind): string {
  // @qa-sdk/auth/process-auth → packages/auth/src/process-auth.test.ts
  const packageName = modulePath.replace(/^@qa-sdk\//, "").replace(/^workspace:/, "");
  const parts = packageName.split("/");
  if (parts.length >= 2) {
    return `packages/${parts[0]}/src/${parts.slice(1).join("/")}.${kind}.test.ts`;
  }
  return `packages/${packageName}/src/index.${kind}.test.ts`;
}

// ── testScaffold ─────────────────────────────────────────

export function testScaffold(opts: { bCoord?: string; mirror?: string; db?: string }): void {
  const dbPath = opts.db ?? join(getQaSdkDir(), "test-scenarios.sqlite");
  const store = new SqliteTestScenarioStore(dbPath);

  const targets = opts.bCoord
    ? [store.getById(opts.bCoord)].filter(Boolean)
    : store.listByLifecycle("assigned");

  for (const scenario of targets) {
    if (!scenario || !scenario.filePath) continue;

    const fullPath = resolve(process.cwd(), scenario.filePath);
    if (existsSync(fullPath)) {
      console.log(`skip (이미 존재): ${scenario.filePath}`);
      continue;
    }

    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, generateTestStub(scenario.primarySvc, scenario.kind, scenario.intent), "utf-8");
    console.log(`생성: ${scenario.filePath}`);
  }
}

function generateTestStub(modulePath: string, kind: TestKind, intent: string): string {
  return `import { describe, it, expect } from "vitest";
// import { ... } from "${modulePath}";

// 의도: ${intent}
// 테스트 유형: ${kind}

describe("${intent}", () => {
  it("TODO: 테스트를 작성하세요", () => {
    // arrange
    // act
    // assert
    expect(true).toBe(true);
  });
});
`;
}

// ── testStatus ───────────────────────────────────────────

export function testStatus(opts: { db?: string }): void {
  const dbPath = opts.db ?? join(getQaSdkDir(), "test-scenarios.sqlite");
  const store = new SqliteTestScenarioStore(dbPath);
  const all = store.listAll();

  if (all.length === 0) {
    console.log("시나리오 없음. qa-sdk test scan을 먼저 실행하세요.");
    return;
  }

  const byLifecycle: Record<string, number> = {
    declared: 0, assigned: 0, collected: 0, verified: 0, archived: 0,
  };
  for (const s of all) {
    byLifecycle[s.lifecycle] = (byLifecycle[s.lifecycle] ?? 0) + 1;
  }

  console.log("\n테스트 시나리오 생명주기 현황");
  console.log("─".repeat(40));
  for (const [state, count] of Object.entries(byLifecycle)) {
    const bar = "█".repeat(count);
    console.log(`${state.padEnd(12)} ${String(count).padStart(4)}  ${bar}`);
  }
  console.log("─".repeat(40));
  console.log(`합계: ${all.length}개`);

  const violations = all.filter(s => s.conventionViolation);
  if (violations.length > 0) {
    console.log(`\n⚠ convention_violation: ${violations.length}개`);
    for (const v of violations) {
      console.log(`  ${v.aCoord} (${v.kind})`);
    }
  }
}

// ── testReport ───────────────────────────────────────────

const KINDS: TestKind[] = [
  "unit", "ui-logic", "ui", "db-transaction",
  "data-exchange", "auth-flow", "e2e", "simulation",
];

const LIFECYCLE_ICON: Record<string, string> = {
  declared: "·",
  assigned: "○",
  collected: "🔄",
  verified: "✅",
  archived: "—",
};

export function testReport(opts: { db?: string }): void {
  const dbPath = opts.db ?? join(getQaSdkDir(), "test-scenarios.sqlite");
  const store = new SqliteTestScenarioStore(dbPath);
  const all = store.listAll();

  if (all.length === 0) {
    console.log("시나리오 없음.");
    return;
  }

  // primarySvc 기준으로 행 구성
  const svcs = [...new Set(all.map(s => s.primarySvc))].sort();

  const colWidth = 10;
  const header = "서비스".padEnd(30) + KINDS.map(k => k.slice(0, colWidth - 1).padEnd(colWidth)).join("");
  console.log("\n" + header);
  console.log("─".repeat(header.length));

  for (const svc of svcs) {
    const scenarios = all.filter(s => s.primarySvc === svc);
    const cells = KINDS.map(kind => {
      const s = scenarios.find(x => x.kind === kind);
      return s ? (LIFECYCLE_ICON[s.lifecycle] ?? "?") : "-";
    });
    const row = svc.slice(-28).padEnd(30) + cells.map(c => c.padEnd(colWidth)).join("");
    console.log(row);
  }

  console.log("\n범례: ✅ verified  🔄 collected  ○ assigned  · declared  - 없음");
}
```

- [ ] **Step 3: 테스트 실행**

```bash
pnpm --filter @qa-sdk/cli test -- --reporter=verbose test.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 4: 커밋**

```bash
git add packages/cli/src/commands/test.ts packages/cli/src/commands/test.test.ts
git commit -m "feat: qa-sdk test scan/assign/scaffold/status/report 명령 구현"
```

---

## Task 4: CLI에 test-scenario-store 의존 추가 + 명령 등록

**Files:**
- Modify: `packages/cli/package.json`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: cli/package.json에 test-scenario-store 의존 추가**

`packages/cli/package.json`의 `dependencies`에 추가:

```json
"test-scenario-store": "workspace:*"
```

- [ ] **Step 2: pnpm install**

```bash
pnpm install
```

Expected: workspace 링크 생성됨

- [ ] **Step 3: index.ts에 import 추가**

`packages/cli/src/index.ts` 상단 imports 섹션에 추가:

```typescript
import {
  testScan,
  testAssign,
  testScaffold,
  testStatus,
  testReport,
} from './commands/test.js';
```

- [ ] **Step 4: USAGE 문자열에 test 명령 추가**

`packages/cli/src/index.ts`의 `USAGE` 상수에 추가:

```
  qa-sdk test scan [--dir <path>]    스펙 frontmatter tests: 선언 → declared
  qa-sdk test assign [--a-coord <c>] 모듈화 체크 → B 좌표 부여
  qa-sdk test scaffold [--b-coord]   테스트 스텁 파일 생성
  qa-sdk test status                 생명주기 현황
  qa-sdk test report                 커버리지 매트릭스
```

- [ ] **Step 5: index.ts switch에 test case 추가**

기존 CLI switch/if-else 구조에 `test` 명령 처리 추가. 기존 패턴 참고:

```typescript
} else if (command === "test") {
  const sub = positionals[1];
  const { values } = parseArgs({
    args: positionals.slice(2).concat(
      Object.entries(remainingArgs).flatMap(([k, v]) =>
        v === true ? [`--${k}`] : [`--${k}`, String(v)]
      )
    ),
    options: {
      dir:      { type: "string" },
      "a-coord": { type: "string" },
      "b-coord": { type: "string" },
      mirror:    { type: "string" },
      force:    { type: "boolean" },
      db:       { type: "string" },
    },
    allowPositionals: true,
  });

  if (sub === "scan") {
    testScan({ dir: values["dir"], db: values["db"] });
  } else if (sub === "assign") {
    testAssign({ aCoord: values["a-coord"], force: values["force"], db: values["db"] });
  } else if (sub === "scaffold") {
    testScaffold({ bCoord: values["b-coord"], mirror: values["mirror"], db: values["db"] });
  } else if (sub === "status") {
    testStatus({ db: values["db"] });
  } else if (sub === "report") {
    testReport({ db: values["db"] });
  } else {
    console.log("qa-sdk test <scan|assign|scaffold|status|report>");
  }
```

- [ ] **Step 6: CLI 빌드**

```bash
pnpm --filter @qa-sdk/cli build
```

Expected: `dist/index.js` 빌드 성공

- [ ] **Step 7: 통합 smoke test**

```bash
# 워크스페이스 루트에서
node packages/cli/dist/index.js test scan --dir .
node packages/cli/dist/index.js test status
node packages/cli/dist/index.js test report
```

Expected: 에러 없이 실행됨 (docs/에 tests: 선언 없으면 "0개 선언됨" 출력)

- [ ] **Step 8: 커밋**

```bash
git add packages/cli/package.json packages/cli/src/index.ts
git commit -m "feat: CLI에 qa-sdk test 명령군 등록"
```

---

## Task 5: 스펙 frontmatter tests: 선언 예시 추가 + 통합 검증

**Files:**
- Modify: `docs/superpowers/specs/2026-04-04-service-dev-harness-design.md` (선행 작업 완료 표시)
- 선택: 기존 스펙 파일 1개에 `tests:` 선언 추가하여 end-to-end 검증

- [ ] **Step 1: 설계 문서 선행 작업 완료 표시 업데이트**

`docs/superpowers/specs/2026-04-04-service-dev-harness-design.md`의 "선행 작업" 섹션 수정:

```markdown
## 선행 작업 (구현 전 완료 필수)

> **완료됨** — `packages/core/src/catalog/catalog.types.ts` + `path-summation.ts`에
> `AddressModel`, `PathSegment`, `PrefixDef.addressModel`이 모두 구현되어 있음.
> 별도 선행 작업 불필요.
```

- [ ] **Step 2: 테스트 스펙 frontmatter 선언 예시 추가**

기존 스펙 파일 하나 (예: `docs/specs/quality-gates/harness-model.spec.md`)에 `tests:` 선언 추가:

```yaml
tests:
  - kind: unit
    intent: deriveHarnessState 4단계 상태 판별
    module: work-domain/harness-model
  - kind: integration
    intent: concept-defined → verified 전이 검증
    module: work-domain/harness-model
    scope: single
```

- [ ] **Step 3: end-to-end 검증**

```bash
node packages/cli/dist/index.js test scan --dir .
node packages/cli/dist/index.js test status
node packages/cli/dist/index.js test assign
node packages/cli/dist/index.js test scaffold
node packages/cli/dist/index.js test report
```

Expected:
- scan: "2개 선언됨"
- status: declared 2개
- assign: "def:harness-model-spec/unit → test_scenario:v1:1"
- scaffold: 테스트 스텁 파일 생성됨
- report: 커버리지 매트릭스 출력

- [ ] **Step 4: 최종 커밋**

```bash
git add docs/superpowers/specs/2026-04-04-service-dev-harness-design.md
git commit -m "docs: 하네스 설계 — 선행작업 완료 반영 + 스펙 tests: 예시 추가"
```

---

## Self-Review

### Spec Coverage

| 스펙 요구사항 | 구현 Task |
|---|---|
| A 좌표 (def:{N}/{kind}) | Task 3 — parseTestsDeclaration |
| B 좌표 (test_scenario:v1:M) | Task 3 — testAssign, nextSeq |
| test_kind + test_scope axes | Task 1 |
| test_scenario prefix | Task 1 |
| 5단계 lifecycle | Task 2 — SqliteTestScenarioStore |
| 모듈화 게이트 (advisory) | Task 3 — testAssign |
| file_path 메타데이터 | Task 2 — schema + store.assign |
| participants[] 메타데이터 | Task 2 — schema |
| scan CLI | Task 3 — testScan |
| assign CLI | Task 3 — testAssign |
| scaffold CLI | Task 3 — testScaffold |
| status CLI | Task 3 — testStatus |
| report CLI | Task 3 — testReport |
| CLI 등록 | Task 4 |

**미구현 (후속 플랜):**
- simulation 연결 (2단계)
- spec_path 합산 모델 적용 (3단계 — path-summation.ts 활용)
- mirror 패키지 (4단계)
- harness-tracker 연동 (ingest 수집)
- verified 상태 전이 (pass rate 계산)

### 타입 일관성 체크

- `TestKind` — types.ts 정의, test.ts에서 import ✓
- `TestScope` — types.ts 정의, test.ts에서 import ✓
- `SqliteTestScenarioStore.upsertDeclared(input: CreateTestScenarioInput)` — types.ts 정의 ✓
- `store.assign(aCoord, bCoord, filePath, violation)` — store.ts 정의, test.ts에서 호출 ✓
- `store.nextSeq(kind, scope)` — store.ts 정의, test.ts에서 호출 ✓
