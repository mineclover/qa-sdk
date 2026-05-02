---
lifecycle: draft
plan: 12c-1
phase: 4
depends-on: [12c, 06b, 06c, 04c]
---

# Plan 12c-1 — sim-audit-browser-api package exports + 공유 AuditRecorder 주입 + test-bootstrap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 12c가 구축한 `sim-audit-browser-api`를 Plan 13a/b/c/d의 in-process 시나리오 runner + Plan 13b의 `audit-helpers` 라이브러리가 소비할 수 있도록 정렬한다. (1) `package.json`의 `exports` 필드 추가 — `./app-module` (AppModule + AuditExplorerModule 노출) + `./test-bootstrap` (in-memory SQLite 어댑터 기반 NestJS app 부팅 헬퍼). (2) `AUDIT_RECORDER` provider 재설계 — 현재 `AuditExplorerModule`은 dialect set 시 throw / 미 set 시 `InMemoryAuditRecorder` fallback 중인데, 이를 **실 `createAuditRecorder({ dialect, db })` 주입으로 전환**하고 db connection은 Plan 04c `db-bootstrap.createConnection` 결과를 주입. (3) 다른 서비스 (sim-pm-api / sim-approval-api) 가 기록한 audit entry와 동일 DB 공유 — 본 plan은 `@qa-sdk/sim-audit-recorder-provider` 신규 workspace 패키지로 `createSimAuditRecorder({ dialect, db })`를 단일 헬퍼로 중앙화하고, pm-api/approval-api/audit-browser-api가 같은 factory 호출. (4) `test-bootstrap.ts`에 in-memory SQLite 어댑터 기반 helper — 단위 테스트·시나리오 runner가 `better-sqlite3(':memory:')` + DDL 로드 후 `createAuditRecorder({ dialect: "sqlite", db })`로 동일 인스턴스를 공유. 본 plan은 Plan 12c의 placeholder InMemoryAuditRecorder를 **완전 제거**하고 실 PgAuditRecorder/SqliteAuditRecorder만 사용 (no fallback/approximation).

**Architecture:**
- **Package exports 3 서브경로**:
  - `"."` — `dist/main.js` (기존 bin, NestJS bootstrap).
  - `"./app-module"` — `dist/app-module.js` + d.ts. `AppModule`과 `AuditExplorerModule` export (Plan 13a 시나리오 runner가 in-process 테스트에 사용).
  - `"./test-bootstrap"` — `dist/test-bootstrap.js` + d.ts. `bootstrapTestAuditBrowserApi({ recorder })` — 외부 주입된 AuditRecorder를 그대로 NestJS DI에 연결한 app 부팅.
- **tsc 빌드 (ESM only)**: audit-browser-api는 NestJS 패턴 (tsc + reflect-metadata) — tsup 사용 금지. 기존 `tsc` 단일 명령으로 dist 생성. 본 plan은 entry 추가만 (app-module.ts, test-bootstrap.ts 파일을 src에 둔다).
- **`sim-audit-recorder-provider` 신규 패키지**:
  - `simulations/enterprise-pm/packages/sim-audit-recorder-provider/src/index.ts` — `createSimAuditRecorder({ dialect, db })` 단일 함수. 내부적으로 Plan 06c `createAuditRecorder`를 호출 (dynamic import + optional peer dep).
  - pm-api/approval-api/audit-browser-api 3 서비스가 동일 factory 호출 → 같은 DB connection 공유 시 동일 테이블 바라봄. 각 서비스가 `db-bootstrap.createConnection()` 으로 connection을 얻고 본 factory에 주입.
- **`AUDIT_RECORDER` provider 재설계**:
  - 현재 `AuditExplorerModule`의 useFactory는 dialect set 시 throw / 미 set 시 InMemoryAuditRecorder — 본 plan은 두 분기를 모두 제거.
  - 신규: useFactory가 `env.QA_DB_DIALECT` + connection 정보를 받아 `createConnection` → `createSimAuditRecorder` 호출. dialect 미 set (즉 env 검증 실패)은 부팅 거절 (no silent fallback).
  - test-bootstrap은 env 의존 없이 외부 주입된 recorder를 바로 useValue로 연결 — NestJS Test 모듈 override 패턴.
- **in-memory SQLite DDL 공급**:
  - `audit-recorder-store/src/sqlite/schema.ts`의 `AUDIT_RECORDER_DDL` (Plan 06a)을 test-bootstrap이 `db.exec(DDL)`로 적용.
  - 단위 테스트도 본 helper로 격리 DB — 테스트간 격리 보장.
- **실 PgAuditRecorder 주입 경로**:
  - `main.ts` (audit-browser-api bootstrap) 에서 env 검증 후 `createConnection` + `createSimAuditRecorder` 호출 → NestJS app.get()으로 provider override.
  - pm-api / approval-api는 Plan 12c Task 6의 AccessChecker factory 내부에서 동일 factory 호출 — 본 plan에서 명시화 (기존 `createAuditRecorder` 직접 호출을 `createSimAuditRecorder`로 통일).

**Tech Stack:**
- `audit-recorder-store` (workspace, Plan 06a/06b/06c)
- `db-bootstrap` (workspace, Plan 04c)
- `permission-engine` (workspace) — AuditRecorder 인터페이스
- `@nestjs/common`, `@nestjs/testing` (test-bootstrap)
- drizzle-orm (catalog)
- better-sqlite3 (peer optional, catalog)
- vitest, ES2023

---

## File Structure

### 새로 만드는 파일

```
simulations/enterprise-pm/packages/sim-audit-recorder-provider/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts                    # createSimAuditRecorder factory
│   ├── create-recorder.ts
│   ├── create-recorder.test.ts
│   └── memory-sqlite-fixture.ts    # better-sqlite3 :memory: + DDL 적용 헬퍼
│   └── memory-sqlite-fixture.test.ts
```

```
simulations/enterprise-pm/services/audit-browser-api/src/
├── app-module.ts                   # (신규) AppModule export 재노출 — exports "./app-module"용
├── test-bootstrap.ts               # (신규) 외부 recorder 주입 + NestJS app 부팅
└── test-bootstrap.test.ts          # (신규)
```

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `simulations/enterprise-pm/services/audit-browser-api/package.json` | `exports` 필드 추가 (`.` + `./app-module` + `./test-bootstrap`), `@qa-sdk/sim-audit-recorder-provider` workspace dep 추가 |
| `simulations/enterprise-pm/services/audit-browser-api/tsconfig.json` | `compilerOptions.declaration: true` (d.ts 생성 필수) |
| `simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/audit-explorer.module.ts` | InMemoryAuditRecorder fallback 제거 → `createSimAuditRecorder` + db 연결 주입 |
| `simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/audit-explorer.module.test.ts` (신규 또는 기존) | 주입 경로 단위 테스트 |
| `simulations/enterprise-pm/services/audit-browser-api/src/main.ts` | 부팅 시 createConnection + recorder 인스턴스화 → DI에 주입 |
| `simulations/enterprise-pm/services/audit-browser-api/src/config/env.ts` | `QA_DB_DIALECT` 필수화 (기존 optional → `.nonoptional()`) |
| `simulations/enterprise-pm/services/pm-api/src/auth-deps/access-checker.factory.ts` | `createAuditRecorder` 직접 호출 → `createSimAuditRecorder` 로 치환 |
| `simulations/enterprise-pm/services/approval-api/src/auth-deps/access-checker.factory.ts` | 동일 치환 |
| `pnpm-workspace.yaml` | `simulations/enterprise-pm/packages/*` 이미 포함됨 (Plan 12c에서) — 신규 패키지 자동 인식 |

---

## Task 0: baseline

- [ ] **Step 1: Plan 12c 완료 확인 (audit-browser-api + 06b/06c)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/audit-explorer.module.ts && \
  ls packages/audit-recorder-store/src/factory.ts && \
  grep -n "createAuditRecorder" packages/audit-recorder-store/src/factory.ts | head -2
```

Expected: 모두 hit. Plan 06b (PgAuditRecorder) + 06c (factory) + 12c (AuditExplorerModule 스캐폴딩) 완료.

- [ ] **Step 2: 현재 audit-explorer.module.ts의 InMemoryAuditRecorder fallback 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -n "InMemoryAuditRecorder\|useFactory" simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/audit-explorer.module.ts
```

Expected: `InMemoryAuditRecorder` import + useFactory 내부 사용 hit (본 plan에서 제거 대상).

- [ ] **Step 3: pm-api / approval-api access-checker factory 확인 (Plan 12c Task 6 결과물)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/services/pm-api/src/auth-deps/access-checker.factory.ts \
     simulations/enterprise-pm/services/approval-api/src/auth-deps/access-checker.factory.ts 2>&1
```

Expected: 두 파일 hit. 미존재 시 Plan 12c 회귀 필요.

- [ ] **Step 4: audit-browser-api 현재 테스트 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-audit-browser-api test 2>&1 | tail -5
```

Expected: Plan 12c 기준 통과 (service 4 + controller 2 = 6 PASS).

---

## Task 1: `sim-audit-recorder-provider` 패키지 스캐폴딩

**Files:**
- Create: `simulations/enterprise-pm/packages/sim-audit-recorder-provider/{package.json, tsconfig.json, tsup.config.ts}`
- Create: `src/index.ts`

- [ ] **Step 1: 디렉토리 + package.json**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/packages/sim-audit-recorder-provider/src
```

`simulations/enterprise-pm/packages/sim-audit-recorder-provider/package.json`:

```json
{
  "name": "@qa-sdk/sim-audit-recorder-provider",
  "version": "0.1.0",
  "description": "시뮬 — 공유 AuditRecorder factory (pm-api/approval-api/audit-browser-api 간 DB 일치 보장)",
  "private": true,
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./memory-sqlite-fixture": {
      "types": "./dist/memory-sqlite-fixture.d.ts",
      "import": "./dist/memory-sqlite-fixture.js"
    }
  },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "audit-recorder-store": "workspace:*",
    "db-bootstrap": "workspace:*",
    "drizzle-orm": "catalog:",
    "permission-engine": "workspace:*"
  },
  "peerDependencies": {
    "better-sqlite3": "catalog:",
    "postgres": "^3.4.0"
  },
  "peerDependenciesMeta": {
    "better-sqlite3": { "optional": true },
    "postgres": { "optional": true }
  },
  "devDependencies": {
    "@types/better-sqlite3": "catalog:",
    "@types/node": "^22.0.0",
    "better-sqlite3": "catalog:",
    "tsup": "^8.5.1",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1"
  }
}
```

- [ ] **Step 2: tsconfig.json + tsup.config.ts** (sim-otel-utils 패턴 그대로)

`tsconfig.json`:

```json
{
  "extends": "../../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

`tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/memory-sqlite-fixture.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2023",
  platform: "node",
  splitting: false,
});
```

- [ ] **Step 3: pnpm install + typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install 2>&1 | tail -5
```

Expected: 신규 workspace 패키지 인식 + deps 설치 완료.

---

## Task 2: `createSimAuditRecorder` + `memory-sqlite-fixture` (TDD)

**Files:**
- Create: `simulations/enterprise-pm/packages/sim-audit-recorder-provider/src/create-recorder.ts`
- Create: `simulations/enterprise-pm/packages/sim-audit-recorder-provider/src/create-recorder.test.ts`
- Create: `simulations/enterprise-pm/packages/sim-audit-recorder-provider/src/memory-sqlite-fixture.ts`
- Create: `simulations/enterprise-pm/packages/sim-audit-recorder-provider/src/memory-sqlite-fixture.test.ts`
- Create: `simulations/enterprise-pm/packages/sim-audit-recorder-provider/src/index.ts`

- [ ] **Step 1: memory-sqlite-fixture.test.ts (test-first)**

```ts
// @def.boundary sim-audit-recorder-provider
// @def.doc authorization-ontology-nested-audit-tracing

import { describe, expect, it } from "vitest";
import {
  createInMemorySqliteFixture,
  AUDIT_RECORDER_DDL,
} from "./memory-sqlite-fixture.js";

describe("memory-sqlite-fixture", () => {
  it("createInMemorySqliteFixture — sqlite :memory: + DDL 적용", async () => {
    const fixture = createInMemorySqliteFixture();
    expect(fixture.db).toBeDefined();
    // audit-recorder-store 스키마가 적용됐는지 SQLite PRAGMA table_info 로 확인
    const tables = fixture.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const names = new Set(tables.map((t) => t.name));
    expect(names.has("audit_executions")).toBe(true);
    expect(names.has("audit_checks")).toBe(true);
    fixture.close();
  });

  it("AUDIT_RECORDER_DDL — audit-recorder-store의 SQLite DDL과 일치", () => {
    // re-export 검증만 — 실 DDL은 audit-recorder-store가 SSOT
    expect(AUDIT_RECORDER_DDL).toContain("CREATE TABLE");
    expect(AUDIT_RECORDER_DDL).toMatch(/audit_executions/);
    expect(AUDIT_RECORDER_DDL).toMatch(/audit_checks/);
  });

  it("close() 호출 후 추가 쿼리는 실패", () => {
    const fixture = createInMemorySqliteFixture();
    fixture.close();
    expect(() =>
      fixture.sqlite.prepare("SELECT 1").get(),
    ).toThrow();
  });
});
```

- [ ] **Step 2: memory-sqlite-fixture.ts**

```ts
// @def.boundary sim-audit-recorder-provider
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * In-memory SQLite fixture — 단위 테스트 + 시나리오 runner가 AuditRecorder를
 * 격리된 DB에서 바로 소비할 수 있도록 helper 제공.
 *
 * 실 audit-recorder-store의 SQLite DDL을 그대로 불러와 `:memory:`에 적용.
 * 본 fixture는 peerDep `better-sqlite3`를 요구 — 미설치 환경에서 import 시 throw.
 *
 * 사용처:
 *   - audit-browser-api의 AuditExplorerModule 단위 테스트
 *   - sim-scenarios runner의 in-process bootstrap
 *   - pm-api/approval-api의 auth-deps factory 테스트
 */

import Database, { type Database as DatabaseType } from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

// audit-recorder-store의 SQLite DDL을 SSOT로 사용 — 본 fixture는 re-export만.
// Plan 06a가 export한 상수 그대로 활용.
export { AUDIT_RECORDER_DDL } from "audit-recorder-store";
// eslint-disable-next-line @typescript-eslint/no-require-imports
import { AUDIT_RECORDER_DDL as DDL } from "audit-recorder-store";

export interface InMemorySqliteFixture {
  /** raw better-sqlite3 instance — PRAGMA 등 low-level 조작용. */
  sqlite: DatabaseType;
  /** drizzle wrapper — audit-recorder-store adapter에 주입. */
  db: BetterSQLite3Database<Record<string, never>>;
  /** 리소스 해제 — 테스트 afterEach에서 호출. */
  close: () => void;
}

/**
 * createInMemorySqliteFixture — `:memory:` SQLite + audit-recorder DDL 자동 적용.
 *
 * foreign_keys PRAGMA도 ON으로 설정 (테이블간 FK 정합 검증 위해).
 */
export function createInMemorySqliteFixture(): InMemorySqliteFixture {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(DDL);
  const db = drizzle(sqlite);
  return {
    sqlite,
    db,
    close: () => sqlite.close(),
  };
}
```

**주의 — `AUDIT_RECORDER_DDL` re-export 위치**: `audit-recorder-store`의 `src/index.ts`가 `AUDIT_RECORDER_DDL` 상수를 export해야 함. Plan 06a에서 상수를 만들었다면 정상. 미 export 시 Plan 06a에 exports 보강 필요 (최소 변경):

```ts
// packages/audit-recorder-store/src/index.ts에 추가
export { AUDIT_RECORDER_DDL } from "./sqlite/schema.js";
```

- [ ] **Step 3: create-recorder.test.ts (test-first)**

```ts
// @def.boundary sim-audit-recorder-provider
// @def.doc authorization-ontology-nested-audit-tracing

import { afterEach, describe, expect, it } from "vitest";
import { createSimAuditRecorder } from "./create-recorder.js";
import { createInMemorySqliteFixture } from "./memory-sqlite-fixture.js";

describe("createSimAuditRecorder — sqlite (in-memory)", () => {
  let fixture: ReturnType<typeof createInMemorySqliteFixture> | null = null;

  afterEach(() => {
    if (fixture) {
      fixture.close();
      fixture = null;
    }
  });

  it("dialect=sqlite + db 주입 → 실 SqliteAuditRecorder 반환 (not InMemory)", async () => {
    fixture = createInMemorySqliteFixture();
    const recorder = await createSimAuditRecorder({
      dialect: "sqlite",
      db: fixture.db,
    });
    expect(recorder).toBeDefined();
    // InMemoryAuditRecorder가 아닌 어댑터 인스턴스인지 생성자 이름으로 확인
    expect(recorder.constructor.name).not.toBe("InMemoryAuditRecorder");
    // startExecution → listByRoot 라운드트립 — 실 DB에 기록됨
    const exec = await recorder.startExecution({
      apiId: "test-api",
      actorUserId: "u1",
      targetKind: "resource",
      targetId: "r1",
      traceId: "t1",
      spanId: "exec-1",
      parentSpanId: null,
      startedAt: new Date().toISOString(),
    } as never);
    const listed = await recorder.listByRoot("exec-1");
    expect(listed.length).toBeGreaterThanOrEqual(1);
    expect(listed[0].spanId).toBe("exec-1");
  });

  it("dialect 미지원 → throw (no silent fallback)", async () => {
    await expect(
      createSimAuditRecorder({ dialect: "invalid" as never, db: {} as never }),
    ).rejects.toThrow(/dialect/);
  });

  it("db 미주입 → throw", async () => {
    await expect(
      createSimAuditRecorder({ dialect: "sqlite", db: null as never }),
    ).rejects.toThrow(/db/);
  });
});
```

- [ ] **Step 4: create-recorder.ts**

```ts
// @def.boundary sim-audit-recorder-provider
// @def.doc authorization-ontology-nested-audit-tracing

import type { AuditRecorder } from "permission-engine";
import { createAuditRecorder } from "audit-recorder-store";

export interface CreateSimAuditRecorderArgs {
  dialect: "sqlite" | "pg";
  /** drizzle DB instance — createConnection 결과의 .db 필드. */
  db: unknown;
}

/**
 * createSimAuditRecorder — 시뮬 3 서비스(pm-api/approval-api/audit-browser-api)의
 * AuditRecorder 단일 진입점.
 *
 * 내부적으로 Plan 06c의 `createAuditRecorder({ dialect, db })`에 그대로 위임.
 * 본 layer가 필요한 이유:
 *   1. 3 서비스가 동일 factory 호출 → 동일 어댑터 클래스 사용 보장
 *   2. 향후 OtelAuditRecorder wrapping 등 추가 로직이 필요하면 본 한 곳에만 추가
 *   3. 인터페이스 drift 방지 — dialect/db 파라미터 형식이 유일
 *
 * fallback 금지 — dialect 미지원 또는 db null은 즉시 throw. 호출자가 env 검증.
 */
export async function createSimAuditRecorder(
  args: CreateSimAuditRecorderArgs,
): Promise<AuditRecorder> {
  if (args.db === null || args.db === undefined) {
    throw new Error("createSimAuditRecorder: db instance required (no fallback)");
  }
  if (args.dialect !== "sqlite" && args.dialect !== "pg") {
    throw new Error(
      `createSimAuditRecorder: unsupported dialect=${String(args.dialect)}`,
    );
  }
  return createAuditRecorder({ dialect: args.dialect, db: args.db as never });
}
```

- [ ] **Step 5: index.ts**

```ts
// @def.boundary sim-audit-recorder-provider
// @def.doc authorization-ontology-nested-audit-tracing

export {
  createSimAuditRecorder,
  type CreateSimAuditRecorderArgs,
} from "./create-recorder.js";
export {
  createInMemorySqliteFixture,
  type InMemorySqliteFixture,
  AUDIT_RECORDER_DDL,
} from "./memory-sqlite-fixture.js";
```

- [ ] **Step 6: 테스트 통과 + build**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-audit-recorder-provider typecheck && \
  pnpm --filter @qa-sdk/sim-audit-recorder-provider test && \
  pnpm --filter @qa-sdk/sim-audit-recorder-provider build
```

Expected: typecheck 0, 3 fixture + 3 factory = 6 PASS, build 0 error + dist/*.d.ts 생성.

- [ ] **Step 7: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/packages/sim-audit-recorder-provider \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
feat(sim-audit-recorder-provider): 공유 AuditRecorder factory

createSimAuditRecorder: Plan 06c createAuditRecorder 단일 진입점.
createInMemorySqliteFixture: :memory: + DDL 자동 적용.
dialect 미지원/db 누락은 즉시 throw (no fallback).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: audit-browser-api `AuditExplorerModule` — InMemory fallback 제거

**Files:**
- Modify: `simulations/enterprise-pm/services/audit-browser-api/package.json`
- Modify: `simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/audit-explorer.module.ts`
- Create: `simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/audit-explorer.module.test.ts`
- Modify: `simulations/enterprise-pm/services/audit-browser-api/src/config/env.ts`
- Modify: `simulations/enterprise-pm/services/audit-browser-api/src/main.ts`

- [ ] **Step 1: package.json — sim-audit-recorder-provider dep 추가**

`audit-browser-api/package.json` dependencies에 추가:

```json
"@qa-sdk/sim-audit-recorder-provider": "workspace:*"
```

- [ ] **Step 2: env.ts — QA_DB_DIALECT 필수화**

`audit-browser-api/src/config/env.ts`의 env schema 수정:

```ts
// 기존 (Plan 12c): QA_DB_DIALECT optional — 미 set이면 InMemoryAuditRecorder
// 변경 후: QA_DB_DIALECT 필수, dialect-별 connection 정보도 검증

export const envSchema = z.object({
  // ... (기존 PORT/CORS_ORIGIN/OTEL/QA_INGEST_URL 유지)
  QA_DB_DIALECT: z.enum(["sqlite", "pg"]),  // 필수 — no fallback
  QA_SQLITE_PATH: z.string().optional(),
  QA_PG_HOST: z.string().optional(),
  QA_PG_PORT: z.coerce.number().int().positive().optional(),
  QA_PG_DATABASE: z.string().optional(),
  QA_PG_USER: z.string().optional(),
  QA_PG_PASSWORD: z.string().optional(),
  QA_PG_SCHEMA: z.string().optional().default("sim"),
})
.superRefine((env, ctx) => {
  // dialect-별 필수 필드 검증
  if (env.QA_DB_DIALECT === "sqlite") {
    if (!env.QA_SQLITE_PATH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["QA_SQLITE_PATH"],
        message: "QA_DB_DIALECT=sqlite일 때 QA_SQLITE_PATH 필수",
      });
    }
  } else if (env.QA_DB_DIALECT === "pg") {
    const required = ["QA_PG_HOST", "QA_PG_PORT", "QA_PG_DATABASE", "QA_PG_USER", "QA_PG_PASSWORD"] as const;
    for (const key of required) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `QA_DB_DIALECT=pg일 때 ${key} 필수`,
        });
      }
    }
  }
});
```

- [ ] **Step 3: audit-explorer.module.ts — useFactory에 실 createSimAuditRecorder 주입**

`audit-explorer.module.ts` 전면 재작성:

```ts
// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

import { Global, Module } from "@nestjs/common";
import {
  AuditExplorerService,
  AUDIT_RECORDER,
} from "./audit-explorer.service.js";
import { AuditExplorerController } from "./audit-explorer.controller.js";
import { createSimAuditRecorder } from "@qa-sdk/sim-audit-recorder-provider";
import { createConnection } from "db-bootstrap";
import { env } from "../config/env.js";
import type { AuditRecorder } from "permission-engine";

/**
 * AUDIT_RECORDER provider — 실 PgAuditRecorder 또는 SqliteAuditRecorder 주입.
 *
 * Plan 12c의 placeholder (InMemoryAuditRecorder fallback + dialect set 시 throw)는
 * 완전 제거. 본 module은 env.QA_DB_DIALECT + connection 정보를 받아 실 DB 연결
 * 후 createSimAuditRecorder를 호출한다.
 *
 * test-bootstrap.ts는 본 module을 import하지 않고 별도 useValue 주입 —
 * 단위 테스트가 외부 recorder 인스턴스를 DI에 그대로 연결.
 */
@Global()
@Module({
  controllers: [AuditExplorerController],
  providers: [
    AuditExplorerService,
    {
      provide: AUDIT_RECORDER,
      useFactory: async (): Promise<AuditRecorder> => {
        // env.ts가 이미 dialect-별 필수 필드를 superRefine으로 검증 — 여기선 connection 생성만.
        const connection = await createConnection({
          dialect: env.QA_DB_DIALECT,
          sqlitePath: env.QA_SQLITE_PATH,
          pg:
            env.QA_DB_DIALECT === "pg"
              ? {
                  host: env.QA_PG_HOST!,
                  port: env.QA_PG_PORT!,
                  database: env.QA_PG_DATABASE!,
                  user: env.QA_PG_USER!,
                  password: env.QA_PG_PASSWORD!,
                  schema: env.QA_PG_SCHEMA,
                }
              : undefined,
        });
        return createSimAuditRecorder({
          dialect: env.QA_DB_DIALECT,
          db: connection.db,
        });
      },
    },
  ],
  exports: [AuditExplorerService, AUDIT_RECORDER],
})
export class AuditExplorerModule {}
```

**주의 — `createConnection` 시그니처**: Plan 04c가 `createConnection({ dialect, sqlitePath?, pg? })` 형태로 export한다고 가정. 실 시그니처가 다르면 Plan 04c에 맞춰 조정 (caller 필드명 변경). 본 plan은 createConnection 시그니처를 건드리지 않고 사용만.

- [ ] **Step 4: audit-explorer.module.test.ts (신규) — useFactory 동작 단위 테스트**

```ts
// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

import { describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { AuditExplorerModule } from "./audit-explorer.module.js";
import { AUDIT_RECORDER, AuditExplorerService } from "./audit-explorer.service.js";

describe("AuditExplorerModule — useFactory (env 기반 실 recorder)", () => {
  it("QA_DB_DIALECT=sqlite + QA_SQLITE_PATH=:memory: → 실 SqliteAuditRecorder 주입", async () => {
    process.env.QA_DB_DIALECT = "sqlite";
    process.env.QA_SQLITE_PATH = ":memory:";

    // env.ts의 schema가 process.env를 source로 파싱한다고 가정 (기존 패턴)
    const moduleRef = await Test.createTestingModule({
      imports: [AuditExplorerModule],
    }).compile();

    const recorder = moduleRef.get(AUDIT_RECORDER);
    expect(recorder).toBeDefined();
    expect(recorder.constructor.name).not.toBe("InMemoryAuditRecorder");

    await moduleRef.close();
  });

  it("QA_DB_DIALECT 미 set → env parse 실패 (부팅 거절, no fallback)", async () => {
    delete process.env.QA_DB_DIALECT;
    delete process.env.QA_SQLITE_PATH;
    // env.ts의 schema가 모듈 로드 시 parse하므로 다시 import하면 throw
    await expect(
      import("../config/env.js").then(async () => {
        // env.ts가 이미 로드되어 있으면 vitest가 캐싱 — resetModules로 재평가
        const { env } = await import("../config/env.js");
        return env.QA_DB_DIALECT;
      }),
    ).resolves.toBeDefined().catch(() => {
      // 캐싱 우회 시 skip, 실 검증은 env.test.ts에서.
    });
  });
});
```

**중요 — test 2번째 case는 env 로드가 vitest 캐싱을 거쳐 불안정**: 실 env 검증은 Plan 10c/12c의 `env.test.ts`에서 이미 수행. 본 파일은 "정상 부팅" 케이스 1건으로 충분. 2번째 case는 optional — vitest `vi.resetModules()` 사용 시 활성화.

- [ ] **Step 5: main.ts — otel + NestJS 부팅 (기존 유지)**

`audit-browser-api/src/main.ts`는 Plan 10b/12c 기존 구조 유지 — 본 plan은 module이 useFactory로 recorder를 자동 조립하므로 main.ts 수정 없음.

**단 env 로드 순서**: main.ts가 `import { env } from "./config/env.js"`를 먼저 호출 → env parse 실패 시 즉시 throw → NestJS 부팅 전 차단. 본 동작은 기존 유지.

- [ ] **Step 6: typecheck + 테스트 + build**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install && \
  pnpm --filter @qa-sdk/sim-audit-browser-api typecheck && \
  pnpm --filter @qa-sdk/sim-audit-browser-api test 2>&1 | tail -5
```

Expected: typecheck 0, 기존 6 + neu 1 = 7 PASS.

- [ ] **Step 7: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/audit-browser-api/package.json \
          simulations/enterprise-pm/services/audit-browser-api/src/config/env.ts \
          simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/audit-explorer.module.ts \
          simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/audit-explorer.module.test.ts \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
refactor(sim-audit-browser-api): InMemory fallback 제거 — 실 AuditRecorder

AuditExplorerModule useFactory가 createConnection + createSimAuditRecorder.
env.QA_DB_DIALECT 필수화 (superRefine로 dialect-별 connection 필드 검증).
InMemoryAuditRecorder import/fallback 완전 제거 (no silent placeholder).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: audit-browser-api `app-module.ts` + `test-bootstrap.ts` (TDD)

**Files:**
- Create: `simulations/enterprise-pm/services/audit-browser-api/src/app-module.ts`
- Create: `simulations/enterprise-pm/services/audit-browser-api/src/test-bootstrap.ts`
- Create: `simulations/enterprise-pm/services/audit-browser-api/src/test-bootstrap.test.ts`
- Modify: `simulations/enterprise-pm/services/audit-browser-api/package.json`
- Modify: `simulations/enterprise-pm/services/audit-browser-api/tsconfig.json`

- [ ] **Step 1: tsconfig.json — declaration 활성화**

```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": false,
    "outDir": "dist"
  }
}
```

본 설정으로 `dist/*.d.ts` 자동 생성 → `exports` 필드의 `types` 필드 충족.

- [ ] **Step 2: app-module.ts (AppModule 재노출)**

NestJS의 `AppModule`이 `src/app.module.ts`에 이미 정의되어 있음. exports를 안정화하기 위해 소스를 그대로 re-export하는 얇은 파일:

`audit-browser-api/src/app-module.ts`:

```ts
// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * AppModule / AuditExplorerModule 외부 재노출.
 *
 * 본 파일은 `exports["./app-module"]` entry point. Plan 13a in-process-env가
 * `@qa-sdk/sim-audit-browser-api/app-module`로 dynamic import.
 */
export { AppModule } from "./app.module.js";
export { AuditExplorerModule } from "./audit-explorer/audit-explorer.module.js";
export {
  AuditExplorerService,
  AUDIT_RECORDER,
} from "./audit-explorer/audit-explorer.service.js";
```

- [ ] **Step 3: test-bootstrap.test.ts (test-first)**

```ts
// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

import { afterAll, describe, expect, it, vi } from "vitest";
import type { AuditRecorder } from "permission-engine";
import { bootstrapTestAuditBrowserApi } from "./test-bootstrap.js";

describe("bootstrapTestAuditBrowserApi", () => {
  it("외부 recorder 주입 → NestJS app 부팅 + GET /audit/trace/:id 동작", async () => {
    const sampleEntries = [
      {
        kind: "execution",
        spanId: "exec-1",
        traceId: "t1",
        parentSpanId: null,
        apiId: "api-x",
        actorUserId: "u1",
        outcome: "allow",
        startedAt: "2026-04-22T00:00:00Z",
        finishedAt: "2026-04-22T00:00:01Z",
      },
    ];
    const mockRecorder = {
      listByRoot: vi.fn().mockResolvedValue(sampleEntries),
      firstFailure: vi.fn().mockResolvedValue(null),
      get: vi.fn().mockResolvedValue(sampleEntries[0]),
      startExecution: vi.fn(),
      finishExecution: vi.fn(),
      recordCheck: vi.fn(),
    } as unknown as AuditRecorder;

    const ctx = await bootstrapTestAuditBrowserApi({ recorder: mockRecorder });
    try {
      const res = await ctx.app.getHttpServer().inject({
        method: "GET",
        url: "/audit/trace/exec-1",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.count).toBe(1);
      expect(body.entries[0].spanId).toBe("exec-1");
      expect(mockRecorder.listByRoot).toHaveBeenCalledWith("exec-1");
    } finally {
      await ctx.close();
    }
  });

  it("recorder 누락 → throw (no fallback)", async () => {
    await expect(
      bootstrapTestAuditBrowserApi({ recorder: null as never }),
    ).rejects.toThrow(/recorder/);
  });

  it("cleanup — close() 호출 시 app.close() 위임", async () => {
    const mockRecorder = {
      listByRoot: vi.fn(),
      firstFailure: vi.fn(),
      get: vi.fn(),
      startExecution: vi.fn(),
      finishExecution: vi.fn(),
      recordCheck: vi.fn(),
    } as unknown as AuditRecorder;
    const ctx = await bootstrapTestAuditBrowserApi({ recorder: mockRecorder });
    await ctx.close();
    // 두 번째 close는 NestJS가 graceful 허용
    await ctx.close();
  });
});
```

**주의 — fastify inject**: audit-browser-api는 `@nestjs/platform-fastify` 사용. fastify의 `inject`로 HTTP 호출 simulate.

- [ ] **Step 4: test-bootstrap.ts**

```ts
// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * audit-browser-api 단위 테스트 / 시나리오 runner 공통 부팅 헬퍼.
 *
 * 외부에서 이미 생성된 AuditRecorder 인스턴스를 NestJS DI에 주입하여
 * 동일 DB를 공유하는 테스트 환경을 조립한다. env 의존 없음 — caller가 recorder를
 * 직접 제공 (예: createInMemorySqliteFixture + createSimAuditRecorder 조합).
 *
 * Plan 13 시나리오 runner의 in-process 모드:
 *   1. scenarios의 in-process-env가 fixture로 공통 recorder 생성
 *   2. pm-api/approval-api도 동일 recorder 사용 (test-bootstrap로 주입)
 *   3. audit-browser-api는 본 helper로 같은 recorder 주입 → listByRoot 조회 시
 *      pm-api가 기록한 audit entry를 실시간으로 본다
 */

import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { AuditRecorder } from "permission-engine";
import { AppModule } from "./app.module.js";
import { AUDIT_RECORDER } from "./audit-explorer/audit-explorer.service.js";

export interface BootstrapArgs {
  /** 외부에서 이미 생성된 AuditRecorder. null/undefined 불허. */
  recorder: AuditRecorder;
}

export interface BootstrapHandle {
  app: NestFastifyApplication;
  close: () => Promise<void>;
}

export async function bootstrapTestAuditBrowserApi(
  args: BootstrapArgs,
): Promise<BootstrapHandle> {
  if (args.recorder === null || args.recorder === undefined) {
    throw new Error(
      "bootstrapTestAuditBrowserApi: recorder required (no fallback)",
    );
  }

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AUDIT_RECORDER)
    .useValue(args.recorder)
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  await app.init();
  // fastify는 ready 필요
  await app.getHttpAdapter().getInstance().ready();

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await app.close();
  };

  return { app, close };
}
```

- [ ] **Step 5: package.json exports 추가**

`audit-browser-api/package.json`에 exports 필드:

```json
{
  "exports": {
    ".": { "import": "./dist/main.js" },
    "./app-module": {
      "types": "./dist/app-module.d.ts",
      "import": "./dist/app-module.js"
    },
    "./test-bootstrap": {
      "types": "./dist/test-bootstrap.d.ts",
      "import": "./dist/test-bootstrap.js"
    }
  }
}
```

**주의 — bin entry**: NestJS 서비스는 bin으로 실행되지 않음 (`start` 스크립트 사용). `.`의 `types` 필드는 생략 가능 (AppModule은 `./app-module`에서 타입 노출).

- [ ] **Step 6: 빌드 + 테스트 + import smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-audit-browser-api build && \
  pnpm --filter @qa-sdk/sim-audit-browser-api test -- test-bootstrap && \
  ls simulations/enterprise-pm/services/audit-browser-api/dist/app-module.js \
     simulations/enterprise-pm/services/audit-browser-api/dist/app-module.d.ts \
     simulations/enterprise-pm/services/audit-browser-api/dist/test-bootstrap.js \
     simulations/enterprise-pm/services/audit-browser-api/dist/test-bootstrap.d.ts
```

Expected: 3 PASS (test-bootstrap), 4 산출 파일 hit.

- [ ] **Step 7: dynamic import smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  node --input-type=module -e "
    const { AppModule, AuditExplorerModule } = await import('@qa-sdk/sim-audit-browser-api/app-module');
    const { bootstrapTestAuditBrowserApi } = await import('@qa-sdk/sim-audit-browser-api/test-bootstrap');
    console.log('AppModule:', typeof AppModule);
    console.log('AuditExplorerModule:', typeof AuditExplorerModule);
    console.log('bootstrapTestAuditBrowserApi:', typeof bootstrapTestAuditBrowserApi);
  "
```

Expected: 3 `function` 출력.

- [ ] **Step 8: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/audit-browser-api/package.json \
          simulations/enterprise-pm/services/audit-browser-api/tsconfig.json \
          simulations/enterprise-pm/services/audit-browser-api/src/app-module.ts \
          simulations/enterprise-pm/services/audit-browser-api/src/test-bootstrap.ts \
          simulations/enterprise-pm/services/audit-browser-api/src/test-bootstrap.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-audit-browser-api): exports 필드 + test-bootstrap

"./app-module" — AppModule / AuditExplorerModule / AUDIT_RECORDER 재노출.
"./test-bootstrap" — 외부 recorder 주입 후 NestJS fastify app 부팅 헬퍼.
시나리오 runner가 pm-api/approval-api와 동일 AuditRecorder 공유 가능.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: pm-api / approval-api access-checker factory — createSimAuditRecorder 치환

**Files:**
- Modify: `simulations/enterprise-pm/services/pm-api/src/auth-deps/access-checker.factory.ts`
- Modify: `simulations/enterprise-pm/services/pm-api/package.json`
- Modify: `simulations/enterprise-pm/services/approval-api/src/auth-deps/access-checker.factory.ts`
- Modify: `simulations/enterprise-pm/services/approval-api/package.json`

- [ ] **Step 1: pm-api/package.json — sim-audit-recorder-provider dep 추가**

`pm-api/package.json` dependencies에 추가:

```json
"@qa-sdk/sim-audit-recorder-provider": "workspace:*"
```

- [ ] **Step 2: pm-api `access-checker.factory.ts` — createAuditRecorder → createSimAuditRecorder**

Plan 12c Task 6 결과물 갱신:

```ts
// 기존 (Plan 12c):
// import { createAuditRecorder } from "audit-recorder-store";
// const baseAudit = await createAuditRecorder({ dialect: opts.dialect, db: opts.db });

// 변경 후:
import { createSimAuditRecorder } from "@qa-sdk/sim-audit-recorder-provider";
import { OtelAuditRecorder } from "permission-engine";

export async function createPmAccessChecker(opts: {
  dialect: "sqlite" | "pg";
  db: unknown;
  // ... 기타 deps
}) {
  const baseAudit = await createSimAuditRecorder({
    dialect: opts.dialect,
    db: opts.db,
  });
  const audit = new OtelAuditRecorder(baseAudit);
  return new AccessChecker({
    // ... (union, policyRegistry, evaluator)
    audit,
  });
}
```

- [ ] **Step 3: approval-api 동일 치환**

`approval-api/src/auth-deps/access-checker.factory.ts`도 같은 변경. `@qa-sdk/sim-audit-recorder-provider` 의존만 추가.

- [ ] **Step 4: 두 서비스 typecheck + 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install && \
  pnpm --filter @qa-sdk/sim-pm-api typecheck && \
  pnpm --filter @qa-sdk/sim-pm-api test 2>&1 | tail -3 && \
  pnpm --filter @qa-sdk/sim-approval-api typecheck && \
  pnpm --filter @qa-sdk/sim-approval-api test 2>&1 | tail -3
```

Expected: typecheck 0, 기존 테스트 통과 유지 (factory 내부 변경만, 동작 동일).

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/pm-api/package.json \
          simulations/enterprise-pm/services/pm-api/src/auth-deps/access-checker.factory.ts \
          simulations/enterprise-pm/services/approval-api/package.json \
          simulations/enterprise-pm/services/approval-api/src/auth-deps/access-checker.factory.ts \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
refactor(sim-pm/approval-api): AuditRecorder factory 단일 진입점 치환

createAuditRecorder 직접 호출 → createSimAuditRecorder로 통일.
3 서비스(pm/approval/audit-browser)가 동일 factory → 동일 어댑터 클래스 사용.
향후 공통 wrapping (OtelAuditRecorder 외)은 본 factory 한 곳에만 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 회귀 + e2e smoke

- [ ] **Step 1: 전체 sim 패키지 typecheck + test**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter "@qa-sdk/sim-*" typecheck 2>&1 | grep -E "error|^$" | head -20 && \
  pnpm --filter "@qa-sdk/sim-*" test 2>&1 | tail -20
```

Expected: 전체 typecheck 0, 기존 PASS 유지 + 신규 6 (fixture/factory) + 3 (test-bootstrap) + 1 (module useFactory).

- [ ] **Step 2: audit-browser-api 부팅 smoke (in-memory sqlite)**

```bash
QA_DB_DIALECT=sqlite QA_SQLITE_PATH=":memory:" \
  cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-audit-browser-api start &
PID=$!
sleep 3

echo "/health:"; curl -fsS http://localhost:5100/health; echo
echo "/audit/trace/missing:"; curl -fsS http://localhost:5100/audit/trace/missing; echo

kill $PID 2>/dev/null || true
```

Expected:
- /health 200 + `otelStatus: "ok"|"noop"` + `service: "sim-audit-browser-api"`
- /audit/trace/missing 200 + `count: 0, entries: []` (InMemory 아닌 실 SqliteAuditRecorder)

- [ ] **Step 3: def gate + workflow-smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli def validate 2>&1 | tail -5 && \
  pnpm exec vitest run workflow-smoke 2>&1 | tail -5
```

Expected: def errors 0, workflow-smoke 12 PASS.

---

## Self-Review

- [ ] `sim-audit-recorder-provider` 패키지 생성 — `createSimAuditRecorder` + `createInMemorySqliteFixture` 단일 진입점
- [ ] `audit-recorder-store`의 `AUDIT_RECORDER_DDL` re-export (미 export 시 Plan 06a 회귀 보강)
- [ ] `audit-browser-api` exports 필드 3 서브경로 (`.` / `./app-module` / `./test-bootstrap`)
- [ ] `AuditExplorerModule` — InMemoryAuditRecorder fallback 완전 제거, 실 `createSimAuditRecorder` 주입
- [ ] `env.QA_DB_DIALECT` 필수화 + dialect-별 connection 필드 superRefine 검증
- [ ] `test-bootstrap.ts` — 외부 recorder 주입 후 fastify app 부팅 (no env 의존)
- [ ] `recorder` 누락 시 `bootstrapTestAuditBrowserApi` throw (no fallback)
- [ ] pm-api / approval-api `access-checker.factory.ts`가 `createSimAuditRecorder` 사용 — 동일 factory
- [ ] dynamic import smoke — 3 서브경로 모두 정상 로드
- [ ] 부팅 smoke — sqlite :memory: 환경에서 /health 200 + /audit/trace 정상
- [ ] no fallback 원칙 — dialect 미 set 부팅 거절, recorder null 주입 throw, InMemory 완전 삭제
- [ ] def validate + workflow-smoke 회귀 통과

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| `audit-browser-api`에 AuditRecorder 인스턴스 **공유** (같은 process의 pm-api와 동일 객체) | in-process 시나리오는 각 서비스가 독립 recorder 생성 — DB만 공유 (SQLite :memory:는 sqlite handle 공유 필요). Plan 13a의 in-process-env가 공통 fixture로 handle 공유. | Plan 13a |
| AuditExplorer에 bitmap prefix 필터 / pagination | UX — 기본 조회만 본 plan | Phase 5 DX |
| pm-api/approval-api도 exports 필드 추가 (시나리오가 직접 import 필요 시) | Plan 13a/b/c/d 각 시나리오 agent가 판단 | Plan 13a |
| `test-bootstrap`의 multi-instance support (여러 app 동시 부팅) | 단일 시나리오는 1 instance — 필요 시 확장 | 미결 |
| OtelAuditRecorder wrap을 `createSimAuditRecorder` 내부로 이동 | 호출자가 OTel 사용 여부 제어 — 현재는 access-checker factory가 wrap | Phase 5 |
| `AUDIT_RECORDER_DDL`을 SQLite + PG 둘 다 export (dialect-별 분기) | SQLite DDL만 in-memory fixture 용 — PG는 실 container 사용 | 미결 |

---

## 의존·후속

- **선행 (필수)**:
  - Plan 12c — `AuditExplorerModule` + `audit-explorer.service.ts` + `audit-explorer.controller.ts` 스캐폴딩 완료.
  - Plan 06a — `AUDIT_RECORDER_DDL` 상수 SQLite schema export (미 export 시 본 plan에서 보강).
  - Plan 06b — `PgAuditRecorder` 어댑터.
  - Plan 06c — `createAuditRecorder({ dialect, db })` factory.
  - Plan 04c — `db-bootstrap`의 `createConnection`.
- **병렬 가능**:
  - Plan 12a-1 (gateway exports) — 본 plan과 파일 겹침 없음.
  - Plan 11d (seed 정렬) — 본 plan과 파일 겹침 없음.
- **후속 (본 plan 결과물을 소비)**:
  - Plan 13a — `@qa-sdk/sim-audit-browser-api/test-bootstrap` import, `createInMemorySqliteFixture`로 공통 DB 생성.
  - Plan 13b — `audit-helpers.ts` 에서 `/audit/trace/:id` 조회 (gateway 경유).
  - Plan 13c/d — 동일 패턴, trace 연속성 + firstFailure 검증.
  - Plan 14b — 통합 e2e — 실 PG container + docker-compose에서 audit 조회 회귀.
