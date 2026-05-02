# Plan 05b — resource-policy-store PG schema + adapter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `resource-policy-store`에 `src/pg/` 하위 디렉토리 신규 생성. `pgSchema("auth")`로 PG `auth` schema 안에 `resource_policies` 테이블 정의 + `PgResourcePolicyRegistry` 어댑터 구현. RLS는 placeholder만 (정책 미정의 — Phase 3 RLS plan에서 본격).

**Architecture:**
- `src/pg/schema.ts` — `pgSchema("auth").table("resource_policies", {...})` + DDL 상수
- `src/pg/adapter.ts` — `PgResourcePolicyRegistry implements ResourcePolicyRegistry`. SqliteResourcePolicyRegistry와 비즈니스 로직 동일, SQL dialect만 다름.
- `src/pg/adapter.test.ts` — PG-specific 단위 테스트 (qa-sdk-db 컨테이너 의존, env gate)
- `peerDependencies`에 `postgres` 추가 (optional). 비즈니스 로직(state machine)은 permission-engine의 순수 함수 그대로 재사용.

**Tech Stack:** drizzle-orm/postgres-js + postgres ^3.4.0 (peerDep optional). qa-sdk-postgres:5434 (Plan 04a 컨테이너).

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/resource-policy-store/src/pg/schema.ts` | `auth.resource_policies` Drizzle 정의 + DDL |
| `packages/resource-policy-store/src/pg/adapter.ts` | `PgResourcePolicyRegistry` |
| `packages/resource-policy-store/src/pg/adapter.test.ts` | PG-specific 테스트 (env gate `QA_TEST_PG=1`) |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/resource-policy-store/package.json` | `postgres` peerDep optional + dev 추가 |
| `packages/resource-policy-store/src/index.ts` | PG adapter + schema re-export 추가 |

---

## Task 0: baseline

- [ ] **Step 1: Plan 05a 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && ls packages/resource-policy-store/src/sqlite/adapter.ts && grep -n "SqliteResourcePolicyRegistry" packages/resource-policy-store/src/index.ts
```

Expected: 둘 다 hit. 미완료 시 본 plan 시작 금지.

- [ ] **Step 2: Plan 04a (qa-sdk-db) 부팅 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && docker compose -f docker-compose.infra.yaml ps qa-sdk-db | grep healthy
```

Expected: healthy. 미부팅 시 `docker compose up -d qa-sdk-db && sleep 10`.

- [ ] **Step 3: Plan 05a SQLite 테스트 회귀 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store test 2>&1 | tail -3
```

Expected: 12+ PASS.

---

## Task 1: package.json — postgres peerDep + dev

**Files:**
- Modify: `packages/resource-policy-store/package.json`

- [ ] **Step 1: peerDependencies + peerDependenciesMeta + devDependencies에 추가**

기존 `dependencies`에서 `better-sqlite3`를 `peerDependencies`로 이동 + `postgres` 신규 추가. `peerDependenciesMeta.optional` 양쪽 모두.

```json
{
  "dependencies": {
    "drizzle-orm": "catalog:",
    "permission-engine": "workspace:*",
    "weighted-index": "workspace:*"
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

- [ ] **Step 2: pnpm install**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/resource-policy-store/package.json pnpm-lock.yaml && git commit -m "$(cat <<'EOF'
chore(resource-policy-store): postgres peerDep optional 추가

dialect-only 환경 지원 — better-sqlite3·postgres 모두 optional peerDep.
dev에는 둘 다 설치 (테스트가 양쪽 검증).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: pg/schema.ts — auth.resource_policies

**Files:**
- Create: `packages/resource-policy-store/src/pg/schema.ts`

- [ ] **Step 1: 디렉토리 + 파일 생성**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/packages/resource-policy-store/src/pg
```

`packages/resource-policy-store/src/pg/schema.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

import { index, pgSchema, text, varchar } from "drizzle-orm/pg-core";

/**
 * auth schema 안의 resource_policies 테이블.
 *
 * SQLite 버전(sqlite/schema.ts)과 동일 컬럼·인덱스. PG-specific 변경:
 *   - state는 PG enum 대신 CHECK constraint 유지 (varchar + check)
 *     (SQLite와 동일 패턴, drizzle pg enum은 별도 마이그레이션 필요해 회피)
 *   - text 컬럼은 PG에서도 text (둘 다 unbounded)
 *
 * RLS는 본 schema에 enable만, 정책 정의는 Phase 3 RLS plan.
 */
const authSchema = pgSchema("auth");

export const resourcePolicies = authSchema.table(
  "resource_policies",
  {
    resourceId: text("resource_id").primaryKey(),
    resourceType: text("resource_type").notNull(),
    state: varchar("state", { length: 16 }).notNull(),  // CHECK는 raw DDL에서
    ownerId: text("owner_id").notNull(),
    cerbosPolicyRef: text("cerbos_policy_ref"),
    graphRootId: text("graph_root_id"),
    registeredAt: text("registered_at"),
    delegatedAt: text("delegated_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_rp_owner_pg").on(t.ownerId),
    index("idx_rp_state_pg").on(t.state),
    index("idx_rp_type_pg").on(t.resourceType),
  ],
);

/**
 * PG raw DDL — Drizzle Kit 마이그레이션 정착 전까지 fixture/migration용.
 * RLS는 placeholder (`ENABLE`만, 정책 미정의 — Phase 3에서 추가).
 */
export const RESOURCE_POLICIES_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.resource_policies (
  resource_id       TEXT PRIMARY KEY,
  resource_type     TEXT NOT NULL,
  state             VARCHAR(16) NOT NULL CHECK (state IN ('UNREGISTERED','REGISTERED','DELEGATED')),
  owner_id          TEXT NOT NULL,
  cerbos_policy_ref TEXT,
  graph_root_id     TEXT,
  registered_at     TEXT,
  delegated_at      TEXT,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rp_owner_pg ON auth.resource_policies(owner_id);
CREATE INDEX IF NOT EXISTS idx_rp_state_pg ON auth.resource_policies(state);
CREATE INDEX IF NOT EXISTS idx_rp_type_pg ON auth.resource_policies(resource_type);

-- RLS placeholder — Phase 3 RLS plan에서 정책 추가
ALTER TABLE auth.resource_policies ENABLE ROW LEVEL SECURITY;
-- 현재는 정책 없음 → 모든 row invisible. Phase 3 전까지는 owner role bypass 필수.
-- 임시 fallback 정책 (Phase 3에서 더 정교한 정책으로 교체):
CREATE POLICY rp_temp_allow_all ON auth.resource_policies
  USING (true)
  WITH CHECK (true);
`;
```

- [ ] **Step 2: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store typecheck
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/resource-policy-store/src/pg/schema.ts && git commit -m "$(cat <<'EOF'
feat(resource-policy-store): pg/schema.ts — auth.resource_policies + DDL

pgSchema("auth") + raw DDL 병행 (Drizzle Kit 정착 전까지).
RLS placeholder (rp_temp_allow_all 정책) — Phase 3에서 본격 정책.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: pg/adapter.ts — PgResourcePolicyRegistry

**Files:**
- Create: `packages/resource-policy-store/src/pg/adapter.ts`

`SqliteResourcePolicyRegistry`와 동일 비즈니스 로직 — `permission-engine`의 순수 함수(`createUnregistered`, `registerResourcePolicy`, `delegateResourcePolicy`) 재사용. 차이는 driver type만.

- [ ] **Step 1: adapter.ts 작성**

`packages/resource-policy-store/src/pg/adapter.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

/**
 * PgResourcePolicyRegistry — ResourcePolicyRegistry의 PostgreSQL 영속 구현.
 *
 * SqliteResourcePolicyRegistry와 동일 비즈니스 로직.
 * permission-engine의 순수 FSM 함수를 그대로 재사용 — dialect 차이는 driver type만.
 */

import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import {
  DuplicatePolicyError,
  PolicyNotFoundError,
  createUnregistered,
  delegateResourcePolicy,
  registerResourcePolicy,
  type ResourcePolicy,
  type ResourcePolicyCreateArgs,
  type ResourcePolicyDelegateArgs,
  type ResourcePolicyRegisterArgs,
  type ResourcePolicyRegistry,
  type ResourcePolicyState,
} from "permission-engine";

import { resourcePolicies } from "./schema.js";

type Row = typeof resourcePolicies.$inferSelect;

function toPolicy(row: Row): ResourcePolicy {
  return {
    resourceId: row.resourceId,
    resourceType: row.resourceType,
    state: row.state as ResourcePolicyState,
    ownerId: row.ownerId,
    cerbosPolicyRef: row.cerbosPolicyRef ?? undefined,
    graphRootId: row.graphRootId ?? undefined,
    registeredAt: row.registeredAt ?? undefined,
    delegatedAt: row.delegatedAt ?? undefined,
    updatedAt: row.updatedAt,
  };
}

function toRow(p: ResourcePolicy): typeof resourcePolicies.$inferInsert {
  return {
    resourceId: p.resourceId,
    resourceType: p.resourceType,
    state: p.state,
    ownerId: p.ownerId,
    cerbosPolicyRef: p.cerbosPolicyRef ?? null,
    graphRootId: p.graphRootId ?? null,
    registeredAt: p.registeredAt ?? null,
    delegatedAt: p.delegatedAt ?? null,
    updatedAt: p.updatedAt,
  };
}

export class PgResourcePolicyRegistry implements ResourcePolicyRegistry {
  constructor(private readonly db: PostgresJsDatabase) {}

  async resolve(resourceId: string): Promise<ResourcePolicy | null> {
    const rows = await this.db
      .select().from(resourcePolicies)
      .where(eq(resourcePolicies.resourceId, resourceId))
      .limit(1);
    return rows.length === 0 ? null : toPolicy(rows[0]);
  }

  async create(args: ResourcePolicyCreateArgs): Promise<ResourcePolicy> {
    const existing = await this.resolve(args.resourceId);
    if (existing) throw new DuplicatePolicyError(args.resourceId);
    const policy = createUnregistered(args);
    await this.db.insert(resourcePolicies).values(toRow(policy));
    return policy;
  }

  async register(
    resourceId: string,
    args: ResourcePolicyRegisterArgs,
  ): Promise<ResourcePolicy> {
    const cur = await this.resolve(resourceId);
    if (!cur) throw new PolicyNotFoundError(resourceId);
    const next = registerResourcePolicy(cur, args);
    await this.db.update(resourcePolicies)
      .set(toRow(next))
      .where(eq(resourcePolicies.resourceId, resourceId));
    return next;
  }

  async delegate(
    resourceId: string,
    args: ResourcePolicyDelegateArgs,
  ): Promise<ResourcePolicy> {
    const cur = await this.resolve(resourceId);
    if (!cur) throw new PolicyNotFoundError(resourceId);
    const next = delegateResourcePolicy(cur, args);
    await this.db.update(resourcePolicies)
      .set(toRow(next))
      .where(eq(resourcePolicies.resourceId, resourceId));
    return next;
  }

  async remove(resourceId: string): Promise<void> {
    await this.db.delete(resourcePolicies)
      .where(eq(resourcePolicies.resourceId, resourceId));
  }

  async listByOwner(ownerId: string): Promise<ResourcePolicy[]> {
    const rows = await this.db
      .select().from(resourcePolicies)
      .where(eq(resourcePolicies.ownerId, ownerId));
    return rows.map(toPolicy);
  }

  async listByState(state: ResourcePolicyState): Promise<ResourcePolicy[]> {
    const rows = await this.db
      .select().from(resourcePolicies)
      .where(eq(resourcePolicies.state, state));
    return rows.map(toPolicy);
  }
}
```

- [ ] **Step 2: index.ts re-export 추가**

`packages/resource-policy-store/src/index.ts` 끝에:

```ts
// PG 어댑터 (Plan 05b)
export { PgResourcePolicyRegistry } from "./pg/adapter.js";
export { resourcePolicies as resourcePoliciesPg, RESOURCE_POLICIES_PG_DDL } from "./pg/schema.js";
```

`resourcePoliciesPg` alias 사용 — SQLite 버전과 이름 충돌 회피.

- [ ] **Step 3: typecheck + build**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store typecheck && pnpm --filter resource-policy-store build
```

Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/resource-policy-store/src && git commit -m "$(cat <<'EOF'
feat(resource-policy-store): pg/adapter.ts — PgResourcePolicyRegistry

permission-engine FSM 순수 함수 재사용 — 비즈니스 로직 100% 동일, driver type만 다름.
public exports에 PG schema alias 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: pg/adapter.test.ts — PG-specific 검증 (env gate)

**Files:**
- Create: `packages/resource-policy-store/src/pg/adapter.test.ts`

contract test (Plan 05c)와 별도. 본 파일은 PG-specific edge:
- search_path 설정 동작
- RLS placeholder 정책의 임시 통과 확인
- pg_isready·schema 존재성

- [ ] **Step 1: 테스트 작성**

`packages/resource-policy-store/src/pg/adapter.test.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { PgResourcePolicyRegistry } from "./adapter.js";
import { RESOURCE_POLICIES_PG_DDL } from "./schema.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

describe.skipIf(!PG_AVAILABLE)("PgResourcePolicyRegistry — PG-specific", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";

  let sql: ReturnType<typeof postgres>;
  let registry: PgResourcePolicyRegistry;
  let testSchema: string;

  beforeEach(async () => {
    testSchema = `test_${randomBytes(4).toString("hex")}`;
    sql = postgres({
      host: PG_HOST, port: PG_PORT, database: PG_DATABASE,
      user: PG_USER, password: PG_PASSWORD, max: 5, onnotice: () => {},
    });
    // 테스트 schema 생성 + RLS placeholder DDL의 'auth' schema 변경
    const ddl = RESOURCE_POLICIES_PG_DDL.replaceAll("auth.", `${testSchema}.`).replace(
      "CREATE SCHEMA IF NOT EXISTS auth",
      `CREATE SCHEMA IF NOT EXISTS ${testSchema}`,
    );
    await sql.unsafe(ddl);
    await sql`SET search_path TO ${sql(testSchema)}, public`;
    registry = new PgResourcePolicyRegistry(drizzle(sql));
  });

  afterEach(async () => {
    try { await sql`DROP SCHEMA ${sql(testSchema)} CASCADE`; } finally { await sql.end(); }
  });

  it("create + resolve — PG에서도 동일 동작", async () => {
    await registry.create({ resourceId: "d", resourceType: "doc", ownerId: "u" });
    const p = await registry.resolve("d");
    expect(p?.state).toBe("UNREGISTERED");
  });

  it("RLS placeholder 정책이 임시 통과 (rp_temp_allow_all)", async () => {
    // RLS는 enabled이지만 임시 정책으로 모두 통과해야 함
    await registry.create({ resourceId: "d1", resourceType: "doc", ownerId: "u1" });
    const p = await registry.resolve("d1");
    expect(p).not.toBeNull();
  });

  it("CHECK constraint 동작 — invalid state 거절", async () => {
    // 어댑터를 우회한 raw INSERT로만 검증 가능 (어댑터는 valid 값만 사용)
    await expect(
      sql`INSERT INTO ${sql(testSchema)}.resource_policies (resource_id, resource_type, state, owner_id, updated_at)
          VALUES ('bad', 'doc', 'INVALID_STATE', 'u', '2026-04-22')`,
    ).rejects.toThrow();
  });

  it("listByState — PG 인덱스 사용 plan (smoke)", async () => {
    await registry.create({ resourceId: "d1", resourceType: "doc", ownerId: "u" });
    await registry.create({ resourceId: "d2", resourceType: "doc", ownerId: "u" });
    const unreg = await registry.listByState("UNREGISTERED");
    expect(unreg).toHaveLength(2);
  });
});
```

- [ ] **Step 2: PG 환경 변수로 실행**

```bash
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep QA_SDK_ADMIN_PASSWORD /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter resource-policy-store test -- pg/adapter
```

Expected: 4 PASS (qa-sdk-db 부팅 가정).

- [ ] **Step 3: 환경 변수 없을 때 skip 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store test -- pg/adapter
```

Expected: PG suite 자체 skip (`describe.skipIf`로). 다른 SQLite 테스트는 정상.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/resource-policy-store/src && git commit -m "$(cat <<'EOF'
test(resource-policy-store): pg/adapter PG-specific 단위

env gate (QA_TEST_PG=1) — qa-sdk-db 컨테이너 의존.
RLS placeholder + CHECK constraint + search_path 동작 검증.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 회귀

- [ ] **Step 1: SQLite 어댑터 회귀 (Plan 05a 결과 영향 없음)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter resource-policy-store test 2>&1 | tail -10
```

Expected: SQLite + e2e 모두 통과. PG는 env 없으면 skip.

- [ ] **Step 2: permission-engine 회귀 (외부 호출자)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter permission-engine test 2>&1 | tail -5
```

Expected: 통과.

- [ ] **Step 3: 의존자 typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter "...^resource-policy-store" typecheck 2>&1 | tail -5
```

Expected: 에러 없음.

---

## Self-Review

- [ ] `pg/schema.ts`가 `pgSchema("auth")` 사용 + RLS ENABLE
- [ ] `PgResourcePolicyRegistry`가 permission-engine FSM 순수 함수 100% 재사용
- [ ] PG-specific 테스트 4건 (env gate)
- [ ] postgres peerDep optional (dialect-only 환경 지원)
- [ ] SQLite 회귀 0
- [ ] permission-engine 회귀 0

---

## Defer

| 작업 | 이유 |
|---|---|
| RLS 본격 정책 (`auth.user_id` 기반 등) | Phase 3 RLS plan |
| Drizzle Kit 마이그레이션 (raw DDL 대신) | 패턴 안정 후 — 06b 또는 별도 plan |
| Connection retry/backoff | 프로덕션 도입 시 |
| Performance index 추가 (cerbos_policy_ref 등) | 실 트래픽 측정 후 |

---

## 의존·후속

- **Plan 05a**: 본 plan의 직접 의존 (sqlite/ 평행 구조).
- **Plan 04a/04c**: PG 컨테이너 + db-bootstrap fixture는 본 plan 테스트에서 사용.
- **Plan 05c** (factory + contract test): 본 plan 완료 후. 양쪽 어댑터를 hooking.
- **Phase 3 RLS plan**: 본 plan의 placeholder 정책을 본격 정책으로 교체.
