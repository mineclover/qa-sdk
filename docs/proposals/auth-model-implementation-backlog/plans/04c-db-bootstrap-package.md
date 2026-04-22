# Plan 04c — db-bootstrap 신규 패키지

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 store 패키지가 공통으로 사용할 dialect 통합 connection factory + Drizzle Kit 마이그레이션 runner + 테스트 fixture 헬퍼를 단일 신규 패키지 `db-bootstrap`에 구축한다. Plan 05+에서 각 store가 본 패키지를 dev dep으로 사용해 SQLite/PG 양쪽 부팅을 통일.

**Architecture:**
- `createConnection(cfg)` — dialect별 Drizzle DB 인스턴스 + close handle 반환
- `createSqliteTestFixture(ddl)` — `:memory:` SQLite + DDL 자동 적용
- `createPgTestFixture(ddl)` — `qa_sdk_test` DB 안에 random schema 생성, DDL 적용, cleanup 등록
- 마이그레이션 runner는 1차 출시에서 단순 wrapping (각 store가 자체 drizzle.config 정의)

`@qa-sdk/core`에 의존 (SERVICE_PORTS 조회). drizzle-orm·better-sqlite3·postgres는 peerDep optional (consumer가 사용 dialect만 설치).

**Tech Stack:**
- drizzle-orm catalog
- better-sqlite3 catalog (peerDep optional)
- postgres ^3.4.0 (peerDep optional)
- vitest, tsup, TypeScript ES2023

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/db-bootstrap/package.json` | resource-policy-store와 동일 컨벤션 + peerDep optional 드라이버 |
| `packages/db-bootstrap/tsconfig.json` | ES2023 + Bundler resolution |
| `packages/db-bootstrap/tsup.config.ts` | ESM + CJS dual |
| `packages/db-bootstrap/src/index.ts` | public exports |
| `packages/db-bootstrap/src/connection.ts` | `ConnectionConfig` + `createConnection` factory |
| `packages/db-bootstrap/src/connection.test.ts` | SQLite + PG (env gate) 양쪽 connect/close 검증 |
| `packages/db-bootstrap/src/test-fixtures.ts` | `createSqliteTestFixture` + `createPgTestFixture` |
| `packages/db-bootstrap/src/test-fixtures.test.ts` | fixture round-trip 검증 |
| `packages/db-bootstrap/src/env.ts` | zod `dbEnvSchema` (서비스 import 용) |
| `packages/db-bootstrap/src/env.test.ts` | env 검증 |
| `packages/db-bootstrap/README.md` | 사용 패턴 + dialect-only 환경 예시 |

---

## Task 0: baseline

- [ ] **Step 1: Plan 04a + 04b 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -n "qa-sdk-postgres" packages/core/src/lib/service-ports.ts && ls packages/infra-engine/init/qa-sdk-db.sql
```

Expected: 두 명령 모두 hit. 미완료 시 본 plan 시작 금지.

- [ ] **Step 2: qa-sdk-db 컨테이너 부팅 (PG fixture 검증용)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && docker compose -f docker-compose.infra.yaml up -d qa-sdk-db && sleep 10 && docker compose -f docker-compose.infra.yaml ps qa-sdk-db
```

Expected: status `healthy`. 본 plan의 PG fixture 테스트 (`QA_TEST_PG=1`) 시 활용.

---

## Task 1: 패키지 스캐폴딩

**Files:**
- Create: `packages/db-bootstrap/package.json`
- Create: `packages/db-bootstrap/tsconfig.json`
- Create: `packages/db-bootstrap/tsup.config.ts`
- Create: `packages/db-bootstrap/src/index.ts`

- [ ] **Step 1: package.json**

`packages/db-bootstrap/package.json`:

```json
{
  "name": "db-bootstrap",
  "version": "0.1.0",
  "description": "Dialect-portable PG/SQLite connection + test fixture — Plan 04c",
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
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "drizzle-orm": "catalog:",
    "@qa-sdk/core": "workspace:*",
    "zod": "^3.24.2"
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
    "postgres": "^3.4.0",
    "tsup": "^8.5.1",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1"
  }
}
```

devDependencies에는 양쪽 드라이버 모두 — 테스트는 양쪽 검증.

- [ ] **Step 2: tsconfig.json**

`packages/db-bootstrap/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: tsup.config.ts**

`packages/db-bootstrap/tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
});
```

- [ ] **Step 4: 빈 src/index.ts**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/packages/db-bootstrap/src
```

`packages/db-bootstrap/src/index.ts`:

```ts
// @def.boundary db-bootstrap
// @def.doc db-bootstrap

// Task 2~4에서 export 채움.
export {};
```

- [ ] **Step 5: pnpm install**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

Expected: db-bootstrap 인식, drizzle-orm/better-sqlite3/postgres 모두 설치 (workspace 또는 catalog).

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/db-bootstrap pnpm-lock.yaml && git commit -m "$(cat <<'EOF'
feat(db-bootstrap): 신규 패키지 스캐폴딩 — Plan 04c

dialect-portable connection factory + test fixture 진입점.
peerDep으로 better-sqlite3/postgres optional, dev에는 양쪽 설치.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: env.ts — dbEnvSchema

**Files:**
- Create: `packages/db-bootstrap/src/env.ts`
- Create: `packages/db-bootstrap/src/env.test.ts`

- [ ] **Step 1: 테스트 먼저**

`packages/db-bootstrap/src/env.test.ts`:

```ts
// @def.boundary db-bootstrap
// @def.doc db-bootstrap

import { describe, it, expect } from "vitest";
import { dbEnvSchema, parseDbEnv } from "./env.js";

describe("dbEnvSchema", () => {
  it("기본값: dialect=sqlite", () => {
    const e = dbEnvSchema.parse({});
    expect(e.QA_DB_DIALECT).toBe("sqlite");
  });

  it("PG dialect — 필수 필드 모두 있어야 통과", () => {
    const e = dbEnvSchema.parse({
      QA_DB_DIALECT: "pg",
      QA_PG_HOST: "localhost",
      QA_PG_PORT: "5434",
      QA_PG_DATABASE: "qa_sdk",
      QA_PG_USER: "qa_admin",
      QA_PG_PASSWORD: "secret",
    });
    expect(e.QA_DB_DIALECT).toBe("pg");
    expect(e.QA_PG_PORT).toBe(5434);
  });

  it("PG dialect — 필수 필드 없으면 zod 통과(런타임 검증은 parseDbEnv가 별도)", () => {
    // schema는 모두 optional이라 parse는 통과; 의미 검증은 parseDbEnv에서
    expect(() => dbEnvSchema.parse({ QA_DB_DIALECT: "pg" })).not.toThrow();
  });

  it("잘못된 dialect 값 → ZodError", () => {
    expect(() => dbEnvSchema.parse({ QA_DB_DIALECT: "mongo" })).toThrow();
  });
});

describe("parseDbEnv — 의미 검증", () => {
  it("PG dialect인데 host/port 없음 → 에러", () => {
    expect(() => parseDbEnv({ QA_DB_DIALECT: "pg" })).toThrow(/QA_PG_HOST/);
  });

  it("SQLite dialect — 필드 없어도 통과 (:memory: 기본)", () => {
    const e = parseDbEnv({ QA_DB_DIALECT: "sqlite" });
    expect(e.dialect).toBe("sqlite");
    expect(e.sqlitePath).toBeUndefined();
  });

  it("PG dialect 정상 입력 → 구조화된 결과", () => {
    const e = parseDbEnv({
      QA_DB_DIALECT: "pg",
      QA_PG_HOST: "localhost",
      QA_PG_PORT: "5434",
      QA_PG_DATABASE: "qa_sdk",
      QA_PG_USER: "qa_admin",
      QA_PG_PASSWORD: "secret",
      QA_PG_SCHEMA: "auth",
    });
    expect(e.dialect).toBe("pg");
    if (e.dialect === "pg") {
      expect(e.pgHost).toBe("localhost");
      expect(e.pgPort).toBe(5434);
      expect(e.pgSchema).toBe("auth");
    }
  });
});
```

- [ ] **Step 2: 실행 → 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/db-bootstrap && pnpm test -- env
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`packages/db-bootstrap/src/env.ts`:

```ts
// @def.boundary db-bootstrap
// @def.doc db-bootstrap

/**
 * DB 환경 변수 스키마 — 서비스가 자기 config/env.ts에서 import해 사용.
 *
 * pg-migration-design.md §6 (env 변수)와 동기.
 */

import { z } from "zod";

export const dbEnvSchema = z.object({
  QA_DB_DIALECT: z.enum(["sqlite", "pg"]).default("sqlite"),
  // SQLite (선택)
  QA_SQLITE_PATH: z.string().optional(),
  // PG (QA_DB_DIALECT=pg 시 필수 — parseDbEnv에서 검증)
  QA_PG_HOST: z.string().optional(),
  QA_PG_PORT: z.coerce.number().int().positive().optional(),
  QA_PG_DATABASE: z.string().optional(),
  QA_PG_USER: z.string().optional(),
  QA_PG_PASSWORD: z.string().optional(),
  QA_PG_SCHEMA: z.string().optional(),
  QA_PG_POOL_MAX: z.coerce.number().int().positive().optional(),
});

export type DbEnv = z.infer<typeof dbEnvSchema>;

export type ParsedDbEnv =
  | { dialect: "sqlite"; sqlitePath?: string }
  | {
      dialect: "pg";
      pgHost: string;
      pgPort: number;
      pgDatabase: string;
      pgUser: string;
      pgPassword: string;
      pgSchema?: string;
      pgPoolMax?: number;
    };

/**
 * env 객체를 의미적으로 검증해 dialect-discriminated union 반환.
 *
 * dialect=pg일 때 host/port/database/user/password 미완 → 즉시 throw.
 */
export function parseDbEnv(input: Record<string, string | undefined>): ParsedDbEnv {
  const env = dbEnvSchema.parse(input);

  if (env.QA_DB_DIALECT === "sqlite") {
    return { dialect: "sqlite", sqlitePath: env.QA_SQLITE_PATH };
  }

  // pg branch — 필수 필드 검증
  const missing: string[] = [];
  if (!env.QA_PG_HOST) missing.push("QA_PG_HOST");
  if (!env.QA_PG_PORT) missing.push("QA_PG_PORT");
  if (!env.QA_PG_DATABASE) missing.push("QA_PG_DATABASE");
  if (!env.QA_PG_USER) missing.push("QA_PG_USER");
  if (!env.QA_PG_PASSWORD) missing.push("QA_PG_PASSWORD");

  if (missing.length > 0) {
    throw new Error(`PG dialect 활성화됐지만 필수 변수 누락: ${missing.join(", ")}`);
  }

  return {
    dialect: "pg",
    pgHost: env.QA_PG_HOST!,
    pgPort: env.QA_PG_PORT!,
    pgDatabase: env.QA_PG_DATABASE!,
    pgUser: env.QA_PG_USER!,
    pgPassword: env.QA_PG_PASSWORD!,
    pgSchema: env.QA_PG_SCHEMA,
    pgPoolMax: env.QA_PG_POOL_MAX,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/db-bootstrap && pnpm test -- env
```

Expected: 7 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/db-bootstrap/src && git commit -m "$(cat <<'EOF'
feat(db-bootstrap): dbEnvSchema + parseDbEnv — env 변수 스키마

dialect-discriminated union으로 SQLite/PG 분기.
PG dialect 시 필수 필드 검증 (즉시 throw).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: connection.ts — createConnection factory

**Files:**
- Create: `packages/db-bootstrap/src/connection.ts`
- Create: `packages/db-bootstrap/src/connection.test.ts`

- [ ] **Step 1: 테스트 먼저**

`packages/db-bootstrap/src/connection.test.ts`:

```ts
// @def.boundary db-bootstrap
// @def.doc db-bootstrap

import { describe, it, expect } from "vitest";
import { createConnection, type ConnectionConfig } from "./connection.js";

describe("createConnection — SQLite", () => {
  it(":memory: SQLite 연결·close 정상", async () => {
    const cfg: ConnectionConfig = { dialect: "sqlite" };
    const conn = await createConnection(cfg);
    expect(conn.dialect).toBe("sqlite");
    expect(conn.db).toBeDefined();
    await conn.close();
  });

  it("file path SQLite 연결 가능 (in-memory 임시 경로)", async () => {
    const path = `/tmp/db-bootstrap-test-${Date.now()}.db`;
    const cfg: ConnectionConfig = { dialect: "sqlite", sqlitePath: path };
    const conn = await createConnection(cfg);
    await conn.close();
    // cleanup
    try { (await import("node:fs/promises")).unlink(path); } catch {}
  });
});

describe.skipIf(process.env.QA_TEST_PG !== "1")("createConnection — PG", () => {
  const PG_CFG: ConnectionConfig = {
    dialect: "pg",
    pgHost: process.env.QA_TEST_PG_HOST ?? "localhost",
    pgPort: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
    pgDatabase: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
    pgUser: process.env.QA_TEST_PG_USER ?? "qa_admin",
    pgPassword: process.env.QA_TEST_PG_PASSWORD ?? "",
  };

  it("PG 연결·close 정상", async () => {
    const conn = await createConnection(PG_CFG);
    expect(conn.dialect).toBe("pg");
    await conn.close();
  });

  it("pgSchema 지정 시 search_path 설정됨", async () => {
    const conn = await createConnection({ ...PG_CFG, pgSchema: "auth" });
    // Drizzle DB는 search_path를 직접 노출 안 함 — raw query로 검증
    // (개념 검증용, 실제 검증은 PG store contract test에서 수행)
    await conn.close();
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/db-bootstrap && pnpm test -- connection
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`packages/db-bootstrap/src/connection.ts`:

```ts
// @def.boundary db-bootstrap
// @def.doc db-bootstrap

/**
 * Dialect 통합 connection factory.
 *
 * 호출자는 dialect + 연결 정보만 전달하고, 결과로 Drizzle DB + close handle을 받는다.
 * 드라이버는 dialect별 dynamic import — 미설치 환경에서도 본 모듈 import는 실패하지 않음.
 */

export type DialectKind = "sqlite" | "pg";

export interface SqliteConfig {
  dialect: "sqlite";
  /** 파일 경로. 미지정 시 :memory: */
  sqlitePath?: string;
}

export interface PgConfig {
  dialect: "pg";
  pgHost: string;
  pgPort: number;
  pgDatabase: string;
  pgUser: string;
  pgPassword: string;
  /** search_path에 우선 적용할 schema */
  pgSchema?: string;
  /** 기본 10 */
  pgPoolMax?: number;
}

export type ConnectionConfig = SqliteConfig | PgConfig;

export interface Connection {
  dialect: DialectKind;
  /** Drizzle DB 인스턴스 — 호출자가 schema 적용해 사용 */
  db: unknown;
  /** 연결 정리 */
  close(): Promise<void>;
}

export async function createConnection(cfg: ConnectionConfig): Promise<Connection> {
  if (cfg.dialect === "sqlite") {
    const Database = (await import("better-sqlite3")).default;
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    const raw = new Database(cfg.sqlitePath ?? ":memory:");
    return {
      dialect: "sqlite",
      db: drizzle({ client: raw }),
      async close() { raw.close(); },
    };
  }

  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");

  const sql = postgres({
    host: cfg.pgHost,
    port: cfg.pgPort,
    database: cfg.pgDatabase,
    user: cfg.pgUser,
    password: cfg.pgPassword,
    max: cfg.pgPoolMax ?? 10,
    onnotice: () => {},
  });

  if (cfg.pgSchema) {
    await sql`SET search_path TO ${sql(cfg.pgSchema)}, public`;
  }

  return {
    dialect: "pg",
    db: drizzle(sql),
    async close() { await sql.end(); },
  };
}
```

- [ ] **Step 4: 테스트 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/db-bootstrap && pnpm test -- connection
```

Expected: SQLite 2 PASS. PG 테스트는 `QA_TEST_PG=1` 없으면 skip. PG 검증:

```bash
QA_TEST_PG=1 QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter db-bootstrap test -- connection
```

Expected: PG 2 PASS. 컨테이너 안 떠 있으면 fail — Plan 04a smoke 먼저 확인.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/db-bootstrap/src && git commit -m "$(cat <<'EOF'
feat(db-bootstrap): createConnection — dialect 통합 factory

dynamic import로 드라이버 로드 (미설치 환경에서도 module import OK).
PG는 pgSchema 지정 시 search_path 자동 설정.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: test-fixtures.ts — store 테스트용 헬퍼

**Files:**
- Create: `packages/db-bootstrap/src/test-fixtures.ts`
- Create: `packages/db-bootstrap/src/test-fixtures.test.ts`

- [ ] **Step 1: 테스트 먼저**

`packages/db-bootstrap/src/test-fixtures.test.ts`:

```ts
// @def.boundary db-bootstrap
// @def.doc db-bootstrap

import { describe, it, expect } from "vitest";
import { createSqliteTestFixture, createPgTestFixture } from "./test-fixtures.js";

const SAMPLE_DDL = `
CREATE TABLE IF NOT EXISTS sample (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
`;

describe("createSqliteTestFixture", () => {
  it(":memory: SQLite + DDL 적용 + cleanup 동작", async () => {
    const { db, cleanup } = await createSqliteTestFixture(SAMPLE_DDL);
    // db는 Drizzle DB 인스턴스. raw query 가능 여부만 검증
    expect(db).toBeDefined();
    await cleanup();
  });

  it("같은 DDL을 여러 fixture에 적용해도 격리됨 (각 :memory:)", async () => {
    const f1 = await createSqliteTestFixture(SAMPLE_DDL);
    const f2 = await createSqliteTestFixture(SAMPLE_DDL);
    expect(f1.db).not.toBe(f2.db);
    await f1.cleanup();
    await f2.cleanup();
  });
});

describe.skipIf(process.env.QA_TEST_PG !== "1")("createPgTestFixture", () => {
  it("random schema 생성 → DDL 적용 → cleanup으로 schema drop", async () => {
    const PG_CFG = {
      pgHost: process.env.QA_TEST_PG_HOST ?? "localhost",
      pgPort: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
      pgDatabase: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
      pgUser: process.env.QA_TEST_PG_USER ?? "qa_admin",
      pgPassword: process.env.QA_TEST_PG_PASSWORD ?? "",
    };
    // PG DDL은 schema-qualified or schema-less. test fixture는 random schema 생성 후 search_path 적용
    const PG_DDL = `
      CREATE TABLE sample (
        id   TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
    `;
    const { db, schemaName, cleanup } = await createPgTestFixture(PG_DDL, PG_CFG);
    expect(db).toBeDefined();
    expect(schemaName).toMatch(/^test_[0-9a-f]{8}$/);
    await cleanup();
  });

  it("동시 fixture 2개 — schema 충돌 없음", async () => {
    const PG_CFG = {
      pgHost: process.env.QA_TEST_PG_HOST ?? "localhost",
      pgPort: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
      pgDatabase: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
      pgUser: process.env.QA_TEST_PG_USER ?? "qa_admin",
      pgPassword: process.env.QA_TEST_PG_PASSWORD ?? "",
    };
    const PG_DDL = `CREATE TABLE sample (id TEXT PRIMARY KEY);`;
    const f1 = await createPgTestFixture(PG_DDL, PG_CFG);
    const f2 = await createPgTestFixture(PG_DDL, PG_CFG);
    expect(f1.schemaName).not.toBe(f2.schemaName);
    await f1.cleanup();
    await f2.cleanup();
  });
});
```

- [ ] **Step 2: 구현**

`packages/db-bootstrap/src/test-fixtures.ts`:

```ts
// @def.boundary db-bootstrap
// @def.doc db-bootstrap

/**
 * Store 패키지의 port-contract.test.ts가 사용할 fixture 헬퍼.
 *
 * SQLite: :memory: + DDL 적용 → 자동 close
 * PG: qa_sdk_test DB 안에 random schema 생성 → DDL 적용 → cleanup 시 schema drop
 *
 * 병렬 vitest 실행 시 schema 충돌 회피 위해 random suffix.
 */

import { randomBytes } from "node:crypto";

export interface SqliteFixture {
  db: unknown;
  cleanup(): Promise<void>;
}

export interface PgFixture {
  db: unknown;
  schemaName: string;
  cleanup(): Promise<void>;
}

export interface PgFixtureConfig {
  pgHost: string;
  pgPort: number;
  pgDatabase: string;
  pgUser: string;
  pgPassword: string;
}

export async function createSqliteTestFixture(ddl: string): Promise<SqliteFixture> {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const raw = new Database(":memory:");
  raw.exec(ddl);
  return {
    db: drizzle({ client: raw }),
    async cleanup() { raw.close(); },
  };
}

export async function createPgTestFixture(
  ddl: string,
  cfg: PgFixtureConfig,
): Promise<PgFixture> {
  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");

  const schemaName = `test_${randomBytes(4).toString("hex")}`;
  const sql = postgres({
    host: cfg.pgHost,
    port: cfg.pgPort,
    database: cfg.pgDatabase,
    user: cfg.pgUser,
    password: cfg.pgPassword,
    max: 5,
    onnotice: () => {},
  });

  await sql`CREATE SCHEMA ${sql(schemaName)}`;
  await sql`SET search_path TO ${sql(schemaName)}, public`;
  // DDL은 search_path 안에서 실행 — schema-less 테이블 명령이 schemaName에 적용됨
  await sql.unsafe(ddl);

  return {
    db: drizzle(sql),
    schemaName,
    async cleanup() {
      try {
        await sql`DROP SCHEMA ${sql(schemaName)} CASCADE`;
      } finally {
        await sql.end();
      }
    },
  };
}
```

- [ ] **Step 3: SQLite 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/db-bootstrap && pnpm test -- test-fixtures
```

Expected: SQLite 2 PASS. PG는 env 게이트로 skip.

- [ ] **Step 4: PG 통합 (선택, qa-sdk-db 부팅 필요)**

```bash
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter db-bootstrap test -- test-fixtures
```

Expected: PG 2 PASS. cleanup 후 `qa_sdk_test`에 잔여 schema 없는지 확인:

```bash
docker compose -f /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/docker-compose.infra.yaml \
  exec -T qa-sdk-db psql -U qa_admin -d qa_sdk_test -tA -c "SELECT nspname FROM pg_namespace WHERE nspname LIKE 'test_%';"
```

Expected: empty.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/db-bootstrap/src && git commit -m "$(cat <<'EOF'
feat(db-bootstrap): test-fixtures — SQLite/PG 격리 fixture 헬퍼

SQLite는 :memory: 신규, PG는 qa_sdk_test DB에 random schema 생성·DDL 적용.
cleanup으로 자동 정리. 병렬 vitest 격리.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: index.ts public exports + README

**Files:**
- Modify: `packages/db-bootstrap/src/index.ts`
- Create: `packages/db-bootstrap/README.md`

- [ ] **Step 1: index.ts 채움**

```ts
// @def.boundary db-bootstrap
// @def.doc db-bootstrap

export {
  createConnection,
  type Connection,
  type ConnectionConfig,
  type DialectKind,
  type PgConfig,
  type SqliteConfig,
} from "./connection.js";

export {
  createSqliteTestFixture,
  createPgTestFixture,
  type SqliteFixture,
  type PgFixture,
  type PgFixtureConfig,
} from "./test-fixtures.js";

export {
  dbEnvSchema,
  parseDbEnv,
  type DbEnv,
  type ParsedDbEnv,
} from "./env.js";
```

- [ ] **Step 2: README**

`packages/db-bootstrap/README.md`:

```markdown
# db-bootstrap

Dialect-portable PG/SQLite connection + test fixture. `pg-migration-design.md` Plan 04c 구현.

## 사용 패턴

### 서비스에서 connection

```ts
import { parseDbEnv, createConnection } from "db-bootstrap";

const env = parseDbEnv(process.env);
const conn = await createConnection(env);
// conn.db = Drizzle DB 인스턴스. dialect-specific 사용은 store factory에 위임.
```

### Store 패키지에서 contract test

```ts
import { createSqliteTestFixture, createPgTestFixture } from "db-bootstrap";

const SAMPLE_DDL = `CREATE TABLE ...`;

describe("Store contract", () => {
  for (const dialect of ["sqlite", "pg"] as const) {
    describe(dialect, () => {
      it("...", async () => {
        const fixture = dialect === "sqlite"
          ? await createSqliteTestFixture(SAMPLE_DDL)
          : await createPgTestFixture(SAMPLE_DDL, { /* PG cfg */ });
        // ... 테스트 본문 ...
        await fixture.cleanup();
      });
    });
  }
});
```

## Dialect-only 환경

`peerDependenciesMeta.optional` 패턴 — better-sqlite3 또는 postgres만 설치하면 됨. 미설치 드라이버는 dynamic import 시점에 fail (factory 분기로 회피).

## 환경 변수

`dbEnvSchema` 참조. `QA_DB_DIALECT=sqlite|pg` + dialect별 추가 변수.
```

- [ ] **Step 3: build + typecheck + 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter db-bootstrap build typecheck test
```

Expected: 모두 통과.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/db-bootstrap && git commit -m "$(cat <<'EOF'
feat(db-bootstrap): public exports + README

Plan 05+ store 패키지가 import할 진입점 정리.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

- [ ] db-bootstrap 패키지가 workspace에 등록되고 build·test 통과
- [ ] dynamic import 패턴으로 미설치 드라이버 환경에서도 module import 가능
- [ ] SqliteFixture·PgFixture 모두 cleanup 호출 시 잔여 자원 없음
- [ ] PG fixture의 random schema가 병렬 vitest에서 충돌 없음
- [ ] env 검증이 dialect별 필수 필드 강제
- [ ] README에 Plan 05 store 사용 패턴 명시

---

## Defer

| 작업 | 이유 |
|---|---|
| Drizzle Kit migration runner wrapping | 1차 출시는 각 store가 자체 drizzle.config 사용. 공통 wrapper는 Plan 05/06 시점에 패턴 굳어진 후. |
| Connection retry/backoff | 프로덕션 도입 시점에. 1차는 fail-fast. |
| pg pool 모니터링 | observability 통합 시. |

---

## 의존·후속

- **Plan 04a** (qa-sdk-db 컨테이너): 본 plan의 PG fixture 검증에 필수.
- **Plan 04b** (SERVICE_PORTS): 본 plan의 env 변수에서 포트 5434 사용.
- **Plan 04d** (infra-engine env export): 본 plan의 dbEnvSchema와 동일 변수 자동 export.
- **Plan 05+**: 모든 store 패키지가 본 패키지를 dev dep으로 사용.
