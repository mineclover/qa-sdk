# Plan 15b — 보호 대상 식별 + RLS 정책 템플릿

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `authorization-ontology-rls-enforcement.spec.md` §방법 **Phase 2 — 보호 대상 식별**을 구현한다. qa-sdk 가 현재 RLS placeholder(`rp_temp_allow_all`, `ae_temp_allow_all` 등) 로만 덮어놓은 4 테이블 — `auth.resource_policies`, `audit.audit_entries`, `ingest.key_observations`, `ingest.event_records` — 에 spec §정의 3·5 의 실제 RLS 정책을 정의한다. 정책은 Plan 15a 의 helper 함수(`auth.current_user_id()`, `auth.has_bit(pos)`, `auth.resource_state(rid)`, `auth.current_role_tag()`) 를 조건식에서 호출하며, SELECT·INSERT·UPDATE·DELETE 별로 분리 정책 + admin bypass 정책을 둔다. 각 store 패키지의 `src/pg/schema.ts` 의 raw DDL 을 갱신 (RLS placeholder → 실제 정책) 하고, 단위 테스트 3 세트(Layer 2b PG-specific) 를 추가한다.

**Architecture:**
- **보호 대상 매트릭스**:

  | 테이블 | owner 컬럼 | 타입 레벨 bit 기준 | 인스턴스 정책 근거 |
  |---|---|---|---|
  | `auth.resource_policies` | `owner_id` | `rp_read`(bit 10)/`rp_write`(bit 11) | `auth.resource_state(resource_id) = 'UNREGISTERED'` → owner only, REGISTERED/DELEGATED → DB 직접 접근 금지 (spec §정의 3 핵심 결정) |
  | `audit.audit_entries` | `actor_user_id` | `audit_read`(bit 20) | write-only-ish — `audit_app` 은 INSERT/SELECT 만, UPDATE/DELETE 는 별도 `audit_writer` role 전용 (pg-migration-design §3) |
  | `ingest.key_observations` | (없음 — tenant scoping 은 prefix_id) | `ingest_read`(bit 30) | tenant 경계는 `app.tenant_id = split_part(prefix_id, '_', 1)` 휴리스틱 또는 prefix ownership index (spec §구성 3 cross-tenant 차단) |
  | `ingest.event_records` | `actor_id`·`user_id`·`qa_session_id` | `event_read`(bit 31) | actor_id 가 `current_user_id()` 와 일치하거나 admin 일 때만 read |

- **bit address 할당 규칙**: `packages/permission-engine` 의 DisjointUnionIndex 로 등록된 프리픽스 주소 공간을 기준으로 고정. 본 plan 에서는 네이밍만 확정(`rp_read=10`, `rp_write=11`, `audit_read=20`, `ingest_read=30`, `event_read=31`) 하고, 실제 address 는 `packages/resource-policy-store/src/pg/rls-bits.ts` 신규 파일에 상수로 export — application 레이어(Plan 15c 세션 미들웨어)가 bitmap 발급 시 같은 상수를 참조. **하드코딩 금지 원칙 준수**: SQL 정책에서는 `auth.has_bit(10)` 처럼 숫자 리터럴이 필요하지만, 이 숫자의 출처는 `rls-bits.ts` SSOT 로 일원화.
- **정책 이름 체계**: `<table_abbrev>_<op>_policy` — 예 `rp_select_policy`, `ae_insert_policy`. admin bypass 는 `<table_abbrev>_admin_bypass`.
- **PERMISSIVE (기본) vs RESTRICTIVE**: PG RLS 는 여러 PERMISSIVE 정책이 OR 로 합쳐지고 RESTRICTIVE 는 AND 로 조합. 본 plan 은 기본 PERMISSIVE 만 사용 — admin bypass + 주 정책 OR.
- **FORCE 는 본 plan 에서 **적용하지 않는다**** — spec §방법 Phase 4(shadow)·Phase 5(enforce)에서 토글. 본 plan 은 정책 정의 + `ENABLE ROW LEVEL SECURITY` 만 (placeholder 제거).
- **테스트 전략** (spec §테스트 전략 "정책 시나리오"):
  - Layer 2b PG-specific 에 `rls-policy.test.ts` 추가: owner·non-owner·admin × SELECT/INSERT/UPDATE/DELETE 매트릭스 일부 — 단 **FORCE 가 없으므로 table owner(연결 role = `qa_admin`) 는 bypass 되어 full visible**. 테스트는 low-privilege role(`auth_app`) 로 재연결해야 실제 정책이 적용된다. fixture 에서 `sql.unsafe(\`SET ROLE auth_app\`)` 으로 role 전환.

**Tech Stack:**
- PostgreSQL 16 RLS (PERMISSIVE policies)
- drizzle-orm raw DDL (마이그레이션 SSOT)
- vitest PG fixture (Plan 04c db-bootstrap)

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/resource-policy-store/src/pg/rls-bits.ts` | bit address 상수 SSOT (rls-bits.ts · export `RP_READ_BIT=10` 등) |
| `packages/resource-policy-store/src/pg/rls-bits.test.ts` | bit 상수 유니크성 + 범위 검증 |
| `packages/resource-policy-store/src/pg/rls-policy.test.ts` | auth.resource_policies RLS 시나리오 (owner/non-owner/state 매트릭스) |
| `packages/audit-recorder-store/src/pg/rls-policy.test.ts` | audit.audit_entries RLS 시나리오 (actor/admin/write-only) |
| `packages/ingest-server/src/stores/pg/rls-policy.test.ts` | ingest.* RLS 시나리오 (tenant scoping / actor match) |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/resource-policy-store/src/pg/schema.ts` | `RESOURCE_POLICIES_PG_DDL` 의 `rp_temp_allow_all` 제거 → 실제 정책 DDL 로 교체 |
| `packages/audit-recorder-store/src/pg/schema.ts` | `AUDIT_ENTRIES_PG_DDL` 의 `ae_temp_allow_all` 제거 → 실제 정책 DDL 로 교체 |
| `packages/ingest-server/src/stores/pg/schema.ts` | `KEY_OBSERVATIONS_PG_DDL`, `EVENT_RECORDS_PG_DDL` 에 RLS ENABLE + 실제 정책 추가 (현재는 ENABLE/정책 둘 다 없음) |
| `packages/resource-policy-store/src/index.ts` | `RP_READ_BIT` 등 rls-bits re-export |

---

## Task 0: baseline

- [ ] **Step 1: Plan 15a 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls packages/infra-engine/init/qa-sdk-db-helpers.sql && \
  ls packages/infra-engine/scripts/test-rls-helpers.sh
```

Expected: 둘 다 hit. helper 함수가 qa-sdk-db 에 등록되어 있어야 본 plan 의 정책이 동작.

- [ ] **Step 2: Plan 05b / 06b / 07b+07c 완료 확인 (placeholder DDL 존재)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -n "rp_temp_allow_all"  packages/resource-policy-store/src/pg/schema.ts && \
  grep -n "ae_temp_allow_all"  packages/audit-recorder-store/src/pg/schema.ts && \
  grep -n "ingest.key_observations" packages/ingest-server/src/stores/pg/schema.ts
```

Expected: 3 hit. 본 plan 이 이 placeholder 를 본격 정책으로 교체.

- [ ] **Step 3: qa-sdk-db helper 함수 smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && ./scripts/test-rls-helpers.sh 2>&1 | tail -3
```

Expected: `✓ RLS helpers smoke 통과`. 미통과 시 Plan 15a 의 `apply-rls-helpers.sh` 재실행.

- [ ] **Step 4: 기존 테스트 baseline (회귀 대비)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store --filter audit-recorder-store --filter ingest-server test 2>&1 | tail -10
```

Expected: 모두 PASS. 본 plan 완료 후 다시 돌려 회귀 0 확인.

---

## Task 1: rls-bits.ts — bit address SSOT

**Files:**
- Create: `packages/resource-policy-store/src/pg/rls-bits.ts`
- Create: `packages/resource-policy-store/src/pg/rls-bits.test.ts`
- Modify: `packages/resource-policy-store/src/index.ts`

bit address 는 결정론적 숫자여야 하고, SQL 정책(`auth.has_bit(10)`)에서 리터럴로 쓰이므로 TypeScript 상수와 동기화 필수. 본 파일이 SSOT.

- [ ] **Step 1: rls-bits.ts 작성**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/packages/resource-policy-store/src/pg
```

`packages/resource-policy-store/src/pg/rls-bits.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

/**
 * RLS 정책이 참조하는 타입-레벨 bitmap bit address SSOT.
 *
 * SQL 정책 DDL 에 숫자 리터럴로 하드코딩되므로 값 변경은 마이그레이션 동반 필수.
 * 본 파일이 유일한 source — application (bitmap 발급자) 은 본 상수를 import.
 *
 * 숫자 할당 규칙:
 *   - 10~19: resource_policies 관련 (read / write / delete)
 *   - 20~29: audit 관련 (read / admin_scope)
 *   - 30~39: ingest 관련 (key_observations / event_records read)
 *   - 40+ : 후속 도메인 예약
 */

export const RP_READ_BIT    = 10;
export const RP_WRITE_BIT   = 11;
export const RP_DELETE_BIT  = 12;

export const AUDIT_READ_BIT = 20;

export const INGEST_READ_BIT = 30;
export const EVENT_READ_BIT  = 31;

/** 테스트·문서에서 전체 목록을 순회해야 할 때 사용. */
export const RLS_BIT_CATALOG = Object.freeze({
  RP_READ_BIT,
  RP_WRITE_BIT,
  RP_DELETE_BIT,
  AUDIT_READ_BIT,
  INGEST_READ_BIT,
  EVENT_READ_BIT,
} as const);

export type RlsBitName = keyof typeof RLS_BIT_CATALOG;
```

- [ ] **Step 2: rls-bits.test.ts — 유니크성 + 범위**

`packages/resource-policy-store/src/pg/rls-bits.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RLS_BIT_CATALOG } from "./rls-bits.js";

describe("RLS bit catalog", () => {
  it("모든 값이 정수", () => {
    for (const [name, val] of Object.entries(RLS_BIT_CATALOG)) {
      expect(Number.isInteger(val), `${name}=${val} 정수여야 함`).toBe(true);
      expect(val, `${name} ≥ 0`).toBeGreaterThanOrEqual(0);
    }
  });

  it("bit 값이 모두 유니크", () => {
    const values = Object.values(RLS_BIT_CATALOG);
    expect(new Set(values).size).toBe(values.length);
  });

  it("도메인 범위 규약 준수 — 10s=rp, 20s=audit, 30s=ingest", () => {
    expect(RLS_BIT_CATALOG.RP_READ_BIT).toBeGreaterThanOrEqual(10);
    expect(RLS_BIT_CATALOG.RP_READ_BIT).toBeLessThan(20);
    expect(RLS_BIT_CATALOG.AUDIT_READ_BIT).toBeGreaterThanOrEqual(20);
    expect(RLS_BIT_CATALOG.AUDIT_READ_BIT).toBeLessThan(30);
    expect(RLS_BIT_CATALOG.INGEST_READ_BIT).toBeGreaterThanOrEqual(30);
    expect(RLS_BIT_CATALOG.EVENT_READ_BIT).toBeGreaterThanOrEqual(30);
  });
});
```

- [ ] **Step 3: index.ts re-export**

`packages/resource-policy-store/src/index.ts` 끝에:

```ts
// RLS bit catalog (Plan 15b)
export {
  RP_READ_BIT,
  RP_WRITE_BIT,
  RP_DELETE_BIT,
  AUDIT_READ_BIT,
  INGEST_READ_BIT,
  EVENT_READ_BIT,
  RLS_BIT_CATALOG,
  type RlsBitName,
} from "./pg/rls-bits.js";
```

- [ ] **Step 4: typecheck + test**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store typecheck && \
  pnpm --filter resource-policy-store test -- rls-bits
```

Expected: 3 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/resource-policy-store/src/pg/rls-bits.ts \
          packages/resource-policy-store/src/pg/rls-bits.test.ts \
          packages/resource-policy-store/src/index.ts && \
  git commit -m "$(cat <<'EOF'
feat(resource-policy-store): rls-bits.ts — bit address SSOT

RP_READ_BIT=10 / RP_WRITE_BIT=11 / RP_DELETE_BIT=12
AUDIT_READ_BIT=20
INGEST_READ_BIT=30 / EVENT_READ_BIT=31
SQL 정책의 has_bit(n) 리터럴과 동기화 필수 — 값 변경은 마이그레이션 동반.
3 단위 테스트 (정수성·유니크성·범위 규약).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: auth.resource_policies 실제 RLS 정책

**Files:**
- Modify: `packages/resource-policy-store/src/pg/schema.ts`

spec §정의 3 + §정의 5 를 그대로 이식. 핵심 결정: **REGISTERED/DELEGATED 리소스는 DB 직접 접근 금지** — UNREGISTERED 만 owner 허용.

- [ ] **Step 1: `RESOURCE_POLICIES_PG_DDL` 교체**

`packages/resource-policy-store/src/pg/schema.ts` 의 `RESOURCE_POLICIES_PG_DDL` 마지막 RLS 블록(`ENABLE ROW LEVEL SECURITY` + `rp_temp_allow_all`) 을 다음으로 교체:

```sql
-- RLS — Phase 3 Plan 15b 실제 정책
-- helper: auth.has_bit / auth.current_user_id / auth.resource_state / auth.current_role_tag (Plan 15a)
-- bit 상수: packages/resource-policy-store/src/pg/rls-bits.ts (RP_READ_BIT=10 / WRITE=11 / DELETE=12)

ALTER TABLE auth.resource_policies ENABLE ROW LEVEL SECURITY;

-- 0. admin bypass — qa_admin role 이면서 session 에 app.role='admin' 주입된 경우에만
CREATE POLICY rp_admin_bypass ON auth.resource_policies
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

-- 1. SELECT — Pass 1: RP_READ_BIT(10) set AND Pass 2: UNREGISTERED & owner 본인
CREATE POLICY rp_select_policy ON auth.resource_policies
  FOR SELECT
  USING (
    auth.has_bit(10)
    AND state = 'UNREGISTERED'
    AND owner_id = auth.current_user_id()
  );

-- 2. INSERT — owner_id 가 현재 세션과 일치 + RP_WRITE_BIT(11)
CREATE POLICY rp_insert_policy ON auth.resource_policies
  FOR INSERT
  WITH CHECK (
    auth.has_bit(11)
    AND owner_id = auth.current_user_id()
  );

-- 3. UPDATE — 기존 row 가 UNREGISTERED & owner + 변경 후에도 owner 유지
CREATE POLICY rp_update_policy ON auth.resource_policies
  FOR UPDATE
  USING (
    auth.has_bit(11)
    AND state = 'UNREGISTERED'
    AND owner_id = auth.current_user_id()
  )
  WITH CHECK (
    owner_id = auth.current_user_id()
  );

-- 4. DELETE — UNREGISTERED & owner + RP_DELETE_BIT(12)
CREATE POLICY rp_delete_policy ON auth.resource_policies
  FOR DELETE
  USING (
    auth.has_bit(12)
    AND state = 'UNREGISTERED'
    AND owner_id = auth.current_user_id()
  );

-- REGISTERED/DELEGATED 리소스 DB 직접 접근 의도적 차단 (spec §정의 3 핵심 결정).
-- 해당 상태의 row 는 모든 non-admin 정책이 false 반환 → invisible.
-- 관리 CLI 등은 admin bypass(app.role='admin') 경로로만 접근 가능.
```

- [ ] **Step 2: 주석 블록 갱신 — `// RLS는 본 schema에 enable만` → Phase 3 완료 표기**

`RESOURCE_POLICIES_PG_DDL` 위 JSDoc 블록의 `RLS는 본 schema에 enable만, 정책 정의는 Phase 3 RLS plan.` 을 다음으로 변경:

```ts
 * RLS 정책: Plan 15b (Phase 3) 로 rp_select/insert/update/delete/admin_bypass 5 정책 배포 완료.
 * FORCE 활성화는 Plan 15e 에서 토글.
```

- [ ] **Step 3: typecheck + SQLite 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store typecheck && \
  pnpm --filter resource-policy-store test -- sqlite 2>&1 | tail -3
```

Expected: SQLite 테스트는 영향 없음 (SQL 은 PG 전용 raw DDL 이므로).

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/resource-policy-store/src/pg/schema.ts && \
  git commit -m "$(cat <<'EOF'
feat(resource-policy-store): auth.resource_policies RLS 실제 정책 5종

rp_admin_bypass / rp_select / rp_insert / rp_update / rp_delete.
spec §3 핵심 결정 (REGISTERED/DELEGATED 는 DB 직접 접근 금지) 이행.
UNREGISTERED & owner_id=current_user_id() 만 통과.
bit 상수는 rls-bits.ts SSOT — has_bit(10/11/12) 로 참조.
FORCE 는 Plan 15e 에서 토글.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: auth.resource_policies RLS 시나리오 테스트

**Files:**
- Create: `packages/resource-policy-store/src/pg/rls-policy.test.ts`

`qa_admin` 연결로 DDL + seed → `SET ROLE auth_app` 후 정책 효과 검증. RLS 는 FORCE 가 없으면 table owner/superuser 를 bypass 하므로 반드시 low-priv role 로 실행.

- [ ] **Step 1: 테스트 작성**

`packages/resource-policy-store/src/pg/rls-policy.test.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { PgResourcePolicyRegistry } from "./adapter.js";
import { RESOURCE_POLICIES_PG_DDL } from "./schema.js";
import { RP_READ_BIT, RP_WRITE_BIT } from "./rls-bits.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

/**
 * hex bitmap 에서 특정 pos 의 비트를 set. 무한 확장.
 */
function setBit(pos: number, hex = ""): string {
  const byteIdx = Math.floor(pos / 8);
  const bitIdx = pos % 8;
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  while (bytes.length <= byteIdx) bytes.push(0);
  bytes[byteIdx] |= 1 << bitIdx;
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe.skipIf(!PG_AVAILABLE)("auth.resource_policies RLS — Plan 15b", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";

  let adminSql: ReturnType<typeof postgres>;
  let appSql: ReturnType<typeof postgres>;
  let registry: PgResourcePolicyRegistry;
  let testSchema: string;

  beforeEach(async () => {
    testSchema = `rls_${randomBytes(4).toString("hex")}`;
    adminSql = postgres({ host: PG_HOST, port: PG_PORT, database: PG_DATABASE, user: PG_USER, password: PG_PASSWORD, max: 3, onnotice: () => {} });

    // 테스트 schema 로 DDL 이식 (auth. → testSchema.)
    const ddl = RESOURCE_POLICIES_PG_DDL
      .replaceAll("auth.resource_policies", `${testSchema}.resource_policies`)
      .replace("CREATE SCHEMA IF NOT EXISTS auth", `CREATE SCHEMA IF NOT EXISTS ${testSchema}`)
      .replaceAll("ON auth.resource_policies", `ON ${testSchema}.resource_policies`);
    // helper 함수는 여전히 auth.* 사용 (SSOT 공유) — test schema 로 교체하지 않음
    await adminSql.unsafe(ddl);
    // auth_app 에 test schema USAGE + 테이블 DML grant (DEFAULT PRIVILEGES 는 auth schema 에만 있으므로 수동)
    await adminSql.unsafe(`GRANT USAGE ON SCHEMA ${testSchema} TO auth_app`);
    await adminSql.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${testSchema}.resource_policies TO auth_app`);

    // low-priv 연결 (auth_app) — RLS 가 실제로 걸리는 role
    appSql = postgres({
      host: PG_HOST, port: PG_PORT, database: PG_DATABASE,
      user: "auth_app",
      password: process.env.QA_TEST_PG_AUTH_APP_PASSWORD ?? "",
      max: 3, onnotice: () => {},
    });
    await appSql`SET search_path TO ${appSql(testSchema)}, public`;
    registry = new PgResourcePolicyRegistry(drizzle(appSql));
  });

  afterEach(async () => {
    try { await adminSql.unsafe(`DROP SCHEMA ${testSchema} CASCADE`); } finally {
      await adminSql.end();
      await appSql.end();
    }
  });

  it("SELECT — 세션 미주입 → 0 row (default deny)", async () => {
    // admin 으로 seed
    await adminSql.unsafe(`
      INSERT INTO ${testSchema}.resource_policies (resource_id, resource_type, state, owner_id, updated_at)
      VALUES ('r1', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')
    `);
    // app_sql 세션에는 SET LOCAL 주입 없음 → helper 모두 NULL → 정책 false
    const rows = await appSql`SELECT * FROM ${appSql(testSchema)}.resource_policies`;
    expect(rows.length).toBe(0);
  });

  it("SELECT — owner + RP_READ_BIT set → 1 row", async () => {
    await adminSql.unsafe(`
      INSERT INTO ${testSchema}.resource_policies (resource_id, resource_type, state, owner_id, updated_at)
      VALUES ('r1', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')
    `);
    const mask = setBit(RP_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'alice', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT resource_id FROM ${tx(testSchema)}.resource_policies`;
      expect(rows.length).toBe(1);
      expect(rows[0].resource_id).toBe("r1");
    });
  });

  it("SELECT — non-owner 는 RP_READ_BIT 있어도 0 row", async () => {
    await adminSql.unsafe(`
      INSERT INTO ${testSchema}.resource_policies (resource_id, resource_type, state, owner_id, updated_at)
      VALUES ('r1', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')
    `);
    const mask = setBit(RP_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'bob', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT * FROM ${tx(testSchema)}.resource_policies`;
      expect(rows.length).toBe(0);
    });
  });

  it("SELECT — REGISTERED 상태는 owner 여도 0 row (DB 직접 접근 금지)", async () => {
    await adminSql.unsafe(`
      INSERT INTO ${testSchema}.resource_policies (resource_id, resource_type, state, owner_id, updated_at)
      VALUES ('r1', 'doc', 'REGISTERED', 'alice', '2026-04-22')
    `);
    const mask = setBit(RP_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'alice', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT * FROM ${tx(testSchema)}.resource_policies`;
      expect(rows.length).toBe(0);
    });
  });

  it("INSERT — owner 일치 + RP_WRITE_BIT → 성공", async () => {
    const mask = setBit(RP_WRITE_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'alice', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      await tx`INSERT INTO ${tx(testSchema)}.resource_policies (resource_id, resource_type, state, owner_id, updated_at) VALUES ('r-ok', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')`;
    });
    const rows = await adminSql`SELECT resource_id FROM ${adminSql(testSchema)}.resource_policies WHERE resource_id='r-ok'`;
    expect(rows.length).toBe(1);
  });

  it("INSERT — owner 불일치 → 실패", async () => {
    const mask = setBit(RP_WRITE_BIT);
    await expect(
      appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.user_id', 'alice', true)`;
        await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
        await tx`INSERT INTO ${tx(testSchema)}.resource_policies (resource_id, resource_type, state, owner_id, updated_at) VALUES ('r-bad', 'doc', 'UNREGISTERED', 'bob', '2026-04-22')`;
      }),
    ).rejects.toThrow(/row-level security|row violates/i);
  });

  it("admin bypass — app.role=admin 이면 모든 state 가시", async () => {
    await adminSql.unsafe(`
      INSERT INTO ${testSchema}.resource_policies (resource_id, resource_type, state, owner_id, updated_at)
      VALUES ('r-reg', 'doc', 'REGISTERED', 'alice', '2026-04-22')
    `);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.role', 'admin', true)`;
      const rows = await tx`SELECT resource_id FROM ${tx(testSchema)}.resource_policies WHERE resource_id='r-reg'`;
      expect(rows.length).toBe(1);
    });
  });
});
```

- [ ] **Step 2: 실행 (env gate)**

```bash
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep '^QA_SDK_ADMIN_PASSWORD=' /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker | cut -d= -f2) \
  QA_TEST_PG_AUTH_APP_PASSWORD=$(grep '^QA_SDK_AUTH_PASSWORD=' /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter resource-policy-store test -- pg/rls-policy 2>&1 | tail -10
```

Expected: 7 PASS.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/resource-policy-store/src/pg/rls-policy.test.ts && \
  git commit -m "$(cat <<'EOF'
test(resource-policy-store): auth.resource_policies RLS 매트릭스 7종

auth_app role 로 저-권한 연결 (FORCE 없이 RLS 실적용 재현).
default deny / owner match / non-owner / REGISTERED 가림 / INSERT owner 불일치 / admin bypass.
spec §테스트 전략 "정책 시나리오 매트릭스" 이행.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: audit.audit_entries 실제 RLS 정책

**Files:**
- Modify: `packages/audit-recorder-store/src/pg/schema.ts`
- Create: `packages/audit-recorder-store/src/pg/rls-policy.test.ts`

audit 도메인은 **write-mostly** — `audit_app` 은 INSERT/SELECT 만 (UPDATE/DELETE grant 자체 없음). RLS 정책도 같은 경계:
- SELECT: actor 본인 trace 또는 admin
- INSERT: actor_user_id 가 current_user_id 와 일치 (대리 기록 금지)
- UPDATE/DELETE: admin bypass 만

- [ ] **Step 1: `AUDIT_ENTRIES_PG_DDL` 교체**

`packages/audit-recorder-store/src/pg/schema.ts` 의 RLS 블록(ENABLE + `ae_temp_allow_all` + grant 주석) 을 다음으로 교체:

```sql
-- RLS — Phase 3 Plan 15b 실제 정책
-- helper: auth.* (Plan 15a). bit 상수: AUDIT_READ_BIT=20 (rls-bits.ts).

ALTER TABLE audit.audit_entries ENABLE ROW LEVEL SECURITY;

-- 0. admin bypass
CREATE POLICY ae_admin_bypass ON audit.audit_entries
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

-- 1. SELECT — Pass 1: AUDIT_READ_BIT set + Pass 2: actor 본인
CREATE POLICY ae_select_policy ON audit.audit_entries
  FOR SELECT
  USING (
    auth.has_bit(20)
    AND actor_user_id = auth.current_user_id()
  );

-- 2. INSERT — actor_user_id 가 세션 사용자와 일치 (대리 기록 금지)
--    nullable 이지만 set 된 경우 일치 필수
CREATE POLICY ae_insert_policy ON audit.audit_entries
  FOR INSERT
  WITH CHECK (
    actor_user_id IS NULL
    OR actor_user_id = auth.current_user_id()
  );

-- UPDATE/DELETE 는 admin bypass 만 — ae_admin_bypass 에서 커버.
-- finishExecution 에서 사용되는 UPDATE 경로는 별도 audit_writer role + admin 세션 컨텍스트 필요 (spec §주의사항).

-- grant 모델 (init.sql 또는 도메인 service 부트 시점 부여):
--   GRANT USAGE          ON SCHEMA audit              TO audit_app;
--   GRANT SELECT, INSERT ON audit.audit_entries       TO audit_app;
--   GRANT USAGE          ON SCHEMA audit              TO qa_admin;
--   GRANT SELECT         ON audit.audit_entries       TO qa_admin;
```

- [ ] **Step 2: JSDoc 주석 갱신** — `RLS는 본 schema에 ENABLE만` → Phase 3 완료 표기.

- [ ] **Step 3: rls-policy.test.ts 작성**

`packages/audit-recorder-store/src/pg/rls-policy.test.ts`:

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { AUDIT_ENTRIES_PG_DDL } from "./schema.js";
import { AUDIT_READ_BIT } from "resource-policy-store";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

function setBit(pos: number): string {
  const byteIdx = Math.floor(pos / 8);
  const bitIdx = pos % 8;
  const bytes = new Array(byteIdx + 1).fill(0);
  bytes[byteIdx] = 1 << bitIdx;
  return bytes.map((b: number) => b.toString(16).padStart(2, "0")).join("");
}

describe.skipIf(!PG_AVAILABLE)("audit.audit_entries RLS — Plan 15b", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";
  const AUDIT_APP_PASSWORD = process.env.QA_TEST_PG_AUDIT_APP_PASSWORD ?? "";

  let adminSql: ReturnType<typeof postgres>;
  let appSql: ReturnType<typeof postgres>;
  let testSchema: string;

  beforeEach(async () => {
    testSchema = `rls_audit_${randomBytes(4).toString("hex")}`;
    adminSql = postgres({ host: PG_HOST, port: PG_PORT, database: PG_DATABASE, user: PG_USER, password: PG_PASSWORD, max: 3, onnotice: () => {} });

    const ddl = AUDIT_ENTRIES_PG_DDL
      .replaceAll("audit.audit_entries", `${testSchema}.audit_entries`)
      .replace("CREATE SCHEMA IF NOT EXISTS audit", `CREATE SCHEMA IF NOT EXISTS ${testSchema}`)
      .replaceAll("ON audit.audit_entries", `ON ${testSchema}.audit_entries`);
    await adminSql.unsafe(ddl);
    await adminSql.unsafe(`GRANT USAGE ON SCHEMA ${testSchema} TO audit_app`);
    await adminSql.unsafe(`GRANT SELECT, INSERT ON ${testSchema}.audit_entries TO audit_app`);

    appSql = postgres({
      host: PG_HOST, port: PG_PORT, database: PG_DATABASE,
      user: "audit_app", password: AUDIT_APP_PASSWORD, max: 3, onnotice: () => {},
    });
    await appSql`SET search_path TO ${appSql(testSchema)}, public`;
  });

  afterEach(async () => {
    try { await adminSql.unsafe(`DROP SCHEMA ${testSchema} CASCADE`); } finally {
      await adminSql.end();
      await appSql.end();
    }
  });

  const seedEntry = (actor: string | null) => adminSql.unsafe(`
    INSERT INTO ${testSchema}.audit_entries (span_id, trace_id, root_span_id, depth, kind, actor_user_id, started_at)
    VALUES ('span-${actor ?? "null"}', 'trace-1', 'span-${actor ?? "null"}', 0, 'execution', ${actor === null ? "NULL" : `'${actor}'`}, '2026-04-22')
  `);

  it("SELECT — 세션 미주입 → 0 row", async () => {
    await seedEntry("alice");
    const rows = await appSql`SELECT * FROM ${appSql(testSchema)}.audit_entries`;
    expect(rows.length).toBe(0);
  });

  it("SELECT — actor 본인 + AUDIT_READ_BIT → 1 row", async () => {
    await seedEntry("alice");
    const mask = setBit(AUDIT_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'alice', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT span_id FROM ${tx(testSchema)}.audit_entries`;
      expect(rows.length).toBe(1);
    });
  });

  it("SELECT — 다른 actor 는 0 row", async () => {
    await seedEntry("alice");
    const mask = setBit(AUDIT_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'bob', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT * FROM ${tx(testSchema)}.audit_entries`;
      expect(rows.length).toBe(0);
    });
  });

  it("INSERT — actor_user_id NULL 은 통과 (시스템 trace)", async () => {
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'system', true)`;
      await tx`INSERT INTO ${tx(testSchema)}.audit_entries (span_id, trace_id, root_span_id, depth, kind, started_at) VALUES ('sp-sys', 't1', 'sp-sys', 0, 'execution', '2026-04-22')`;
    });
    const rows = await adminSql`SELECT span_id FROM ${adminSql(testSchema)}.audit_entries WHERE span_id='sp-sys'`;
    expect(rows.length).toBe(1);
  });

  it("INSERT — 대리 기록 (actor 불일치) 차단", async () => {
    await expect(
      appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.user_id', 'alice', true)`;
        await tx`INSERT INTO ${tx(testSchema)}.audit_entries (span_id, trace_id, root_span_id, depth, kind, actor_user_id, started_at) VALUES ('sp-bad', 't1', 'sp-bad', 0, 'execution', 'bob', '2026-04-22')`;
      }),
    ).rejects.toThrow(/row-level security|row violates/i);
  });

  it("admin bypass — app.role=admin 은 모든 actor 조회 가능", async () => {
    await seedEntry("alice");
    await seedEntry("bob");
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.role', 'admin', true)`;
      const rows = await tx`SELECT span_id FROM ${tx(testSchema)}.audit_entries ORDER BY span_id`;
      expect(rows.length).toBe(2);
    });
  });
});
```

- [ ] **Step 4: 실행**

```bash
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep '^QA_SDK_ADMIN_PASSWORD=' /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker | cut -d= -f2) \
  QA_TEST_PG_AUDIT_APP_PASSWORD=$(grep '^QA_SDK_AUDIT_PASSWORD=' /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter audit-recorder-store test -- pg/rls-policy 2>&1 | tail -10
```

Expected: 6 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/audit-recorder-store/src/pg/schema.ts \
          packages/audit-recorder-store/src/pg/rls-policy.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(audit-recorder-store): audit.audit_entries RLS 실제 정책 3종 + admin bypass

ae_admin_bypass / ae_select_policy / ae_insert_policy.
actor_user_id = current_user_id() 일치 필수 — 대리 기록 차단.
write-mostly 경계 유지: UPDATE/DELETE 는 admin bypass 전용.
RLS 매트릭스 테스트 6종 (audit_app 저권한 role 연결).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: ingest.key_observations · event_records RLS 정책

**Files:**
- Modify: `packages/ingest-server/src/stores/pg/schema.ts`
- Create: `packages/ingest-server/src/stores/pg/rls-policy.test.ts`

ingest 도메인은 **tenant 경계**가 주된 격리 축 (spec §구성 3). `ingest.key_observations` 에는 owner/actor 컬럼이 없고 `prefix_id` 만 있음 → tenant 경계는 spec §1 Session context 의 `app.tenant_id` GUC 와 prefix_id naming convention 으로 매칭. `ingest.event_records` 는 `actor_id` / `user_id` 존재.

**tenant 경계 스킴** — prefix_id 는 `<tenant>_<domain>_<action>` 네이밍 컨벤션 가정 (existing SDK) → `split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true)` 로 cross-tenant row 차단. tenant_id 주입 없으면 default deny.

- [ ] **Step 1: `KEY_OBSERVATIONS_PG_DDL` 에 RLS 추가**

`packages/ingest-server/src/stores/pg/schema.ts` 의 `KEY_OBSERVATIONS_PG_DDL` 끝에 추가:

```sql

-- RLS — Phase 3 Plan 15b 실제 정책
-- helper: auth.* (Plan 15a). bit: INGEST_READ_BIT=30 (rls-bits.ts).
-- tenant 경계: prefix_id 앞 segment 가 app.tenant_id 와 일치해야 함.

ALTER TABLE ingest.key_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ko_admin_bypass ON ingest.key_observations
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

CREATE POLICY ko_select_policy ON ingest.key_observations
  FOR SELECT
  USING (
    auth.has_bit(30)
    AND split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true)
    AND current_setting('app.tenant_id', true) IS NOT NULL
    AND current_setting('app.tenant_id', true) <> ''
  );

CREATE POLICY ko_insert_policy ON ingest.key_observations
  FOR INSERT
  WITH CHECK (
    split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true)
    AND current_setting('app.tenant_id', true) IS NOT NULL
    AND current_setting('app.tenant_id', true) <> ''
  );

-- UPDATE (count 증가 upsert) 은 INSERT 와 동일 tenant 조건
CREATE POLICY ko_update_policy ON ingest.key_observations
  FOR UPDATE
  USING (
    split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true)
  );

-- key_observation_prefixes 도 동일 tenant 경계
ALTER TABLE ingest.key_observation_prefixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY kop_admin_bypass ON ingest.key_observation_prefixes
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

CREATE POLICY kop_all_policy ON ingest.key_observation_prefixes
  FOR ALL
  USING (split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true))
  WITH CHECK (split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true));
```

- [ ] **Step 2: `EVENT_RECORDS_PG_DDL` 에 RLS 추가**

`packages/ingest-server/src/stores/pg/schema.ts` 의 `EVENT_RECORDS_PG_DDL` 끝에 추가:

```sql

-- RLS — Phase 3 Plan 15b
-- actor_id OR user_id 가 current_user_id() 와 일치하는 row 만 read.
-- INSERT 는 actor_id = current_user_id() 또는 NULL.

ALTER TABLE ingest.event_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY er_admin_bypass ON ingest.event_records
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

CREATE POLICY er_select_policy ON ingest.event_records
  FOR SELECT
  USING (
    auth.has_bit(31)
    AND (
      actor_id = auth.current_user_id()
      OR user_id = auth.current_user_id()
    )
  );

CREATE POLICY er_insert_policy ON ingest.event_records
  FOR INSERT
  WITH CHECK (
    actor_id IS NULL
    OR actor_id = auth.current_user_id()
  );
```

- [ ] **Step 3: rls-policy.test.ts 작성**

`packages/ingest-server/src/stores/pg/rls-policy.test.ts`:

```ts
// @def.boundary ingest-system
// @def.doc authorization-ontology-rls-enforcement

import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import {
  KEY_OBSERVATIONS_PG_DDL,
  EVENT_RECORDS_PG_DDL,
} from "./schema.js";
import {
  INGEST_READ_BIT,
  EVENT_READ_BIT,
} from "resource-policy-store";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

function setBit(pos: number): string {
  const byteIdx = Math.floor(pos / 8);
  const bitIdx = pos % 8;
  const bytes = new Array(byteIdx + 1).fill(0);
  bytes[byteIdx] = 1 << bitIdx;
  return bytes.map((b: number) => b.toString(16).padStart(2, "0")).join("");
}

describe.skipIf(!PG_AVAILABLE)("ingest.* RLS — Plan 15b", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";
  const INGEST_APP_PASSWORD = process.env.QA_TEST_PG_INGEST_APP_PASSWORD ?? "";

  let adminSql: ReturnType<typeof postgres>;
  let appSql: ReturnType<typeof postgres>;
  let testSchema: string;

  beforeEach(async () => {
    testSchema = `rls_ingest_${randomBytes(4).toString("hex")}`;
    adminSql = postgres({ host: PG_HOST, port: PG_PORT, database: PG_DATABASE, user: PG_USER, password: PG_PASSWORD, max: 3, onnotice: () => {} });

    const koDdl = KEY_OBSERVATIONS_PG_DDL
      .replaceAll("ingest.key_observations", `${testSchema}.key_observations`)
      .replaceAll("ingest.key_observation_prefixes", `${testSchema}.key_observation_prefixes`)
      .replace("CREATE SCHEMA IF NOT EXISTS ingest", `CREATE SCHEMA IF NOT EXISTS ${testSchema}`)
      .replaceAll("ON ingest.key_observations", `ON ${testSchema}.key_observations`)
      .replaceAll("ON ingest.key_observation_prefixes", `ON ${testSchema}.key_observation_prefixes`);
    const erDdl = EVENT_RECORDS_PG_DDL
      .replaceAll("ingest.event_records", `${testSchema}.event_records`)
      .replace("CREATE SCHEMA IF NOT EXISTS ingest", "-- schema already created")
      .replaceAll("ON ingest.event_records", `ON ${testSchema}.event_records`);
    await adminSql.unsafe(koDdl);
    await adminSql.unsafe(erDdl);
    await adminSql.unsafe(`GRANT USAGE ON SCHEMA ${testSchema} TO ingest_app`);
    await adminSql.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${testSchema}.key_observations TO ingest_app`);
    await adminSql.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${testSchema}.key_observation_prefixes TO ingest_app`);
    await adminSql.unsafe(`GRANT SELECT, INSERT ON ${testSchema}.event_records TO ingest_app`);

    appSql = postgres({
      host: PG_HOST, port: PG_PORT, database: PG_DATABASE,
      user: "ingest_app", password: INGEST_APP_PASSWORD, max: 3, onnotice: () => {},
    });
    await appSql`SET search_path TO ${appSql(testSchema)}, public`;
  });

  afterEach(async () => {
    try { await adminSql.unsafe(`DROP SCHEMA ${testSchema} CASCADE`); } finally {
      await adminSql.end();
      await appSql.end();
    }
  });

  const seedKeyObs = (prefixId: string) => adminSql.unsafe(`
    INSERT INTO ${testSchema}.key_observations (prefix_id, version, address, packed_key, first_seen, last_seen)
    VALUES ('${prefixId}', 'v1', 0, '${prefixId}:0', '2026-04-22', '2026-04-22')
  `);

  it("key_observations SELECT — tenant 불일치 → 0 row", async () => {
    await seedKeyObs("acme_user_login");   // tenant=acme
    await seedKeyObs("globex_user_login"); // tenant=globex
    const mask = setBit(INGEST_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', 'acme', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT prefix_id FROM ${tx(testSchema)}.key_observations`;
      expect(rows.length).toBe(1);
      expect(rows[0].prefix_id).toBe("acme_user_login");
    });
  });

  it("key_observations INSERT — tenant 접두 불일치 차단", async () => {
    await expect(
      appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.tenant_id', 'acme', true)`;
        await tx`INSERT INTO ${tx(testSchema)}.key_observations (prefix_id, version, address, packed_key, first_seen, last_seen) VALUES ('globex_evil', 'v1', 0, 'x', '2026-04-22', '2026-04-22')`;
      }),
    ).rejects.toThrow(/row-level security|row violates/i);
  });

  it("key_observations — tenant 미주입 시 default deny", async () => {
    await seedKeyObs("acme_user_login");
    const mask = setBit(INGEST_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      // tenant_id 미주입
      const rows = await tx`SELECT * FROM ${tx(testSchema)}.key_observations`;
      expect(rows.length).toBe(0);
    });
  });

  const seedEvent = (actor: string | null, user: string | null, logId: string) => adminSql.unsafe(`
    INSERT INTO ${testSchema}.event_records (log_id, trace_id, span_id, timestamp, record_kind, event_key, event_version, payload_format, payload_encoding, created_at, actor_id, user_id)
    VALUES ('${logId}', 't', 'sp', '2026-04-22', 'event', 'k', 'v1', 'json', 'utf8', '2026-04-22', ${actor === null ? "NULL" : `'${actor}'`}, ${user === null ? "NULL" : `'${user}'`})
  `);

  it("event_records SELECT — actor 본인 OR user 본인 일치 row 만 가시", async () => {
    await seedEvent("alice", null, "l1");
    await seedEvent("bob", null, "l2");
    await seedEvent(null, "alice", "l3");
    const mask = setBit(EVENT_READ_BIT);
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'alice', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT log_id FROM ${tx(testSchema)}.event_records ORDER BY log_id`;
      const ids = rows.map((r) => r.log_id);
      expect(ids).toEqual(["l1", "l3"]);
    });
  });

  it("event_records INSERT — actor_id 불일치 차단", async () => {
    await expect(
      appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.user_id', 'alice', true)`;
        await tx`INSERT INTO ${tx(testSchema)}.event_records (log_id, trace_id, span_id, timestamp, record_kind, event_key, event_version, payload_format, payload_encoding, created_at, actor_id) VALUES ('l-bad', 't', 'sp', '2026-04-22', 'event', 'k', 'v1', 'json', 'utf8', '2026-04-22', 'bob')`;
      }),
    ).rejects.toThrow(/row-level security|row violates/i);
  });

  it("admin bypass — 모든 ingest row 가시", async () => {
    await seedKeyObs("acme_x");
    await seedKeyObs("globex_y");
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.role', 'admin', true)`;
      const rows = await tx`SELECT prefix_id FROM ${tx(testSchema)}.key_observations ORDER BY prefix_id`;
      expect(rows.length).toBe(2);
    });
  });
});
```

- [ ] **Step 4: 실행**

```bash
QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep '^QA_SDK_ADMIN_PASSWORD=' /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker | cut -d= -f2) \
  QA_TEST_PG_INGEST_APP_PASSWORD=$(grep '^QA_SDK_INGEST_PASSWORD=' /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter ingest-server test -- pg/rls-policy 2>&1 | tail -10
```

Expected: 6 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/ingest-server/src/stores/pg/schema.ts \
          packages/ingest-server/src/stores/pg/rls-policy.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(ingest-server): ingest.{key_observations,event_records} RLS 정책

key_observations: tenant 경계 (split_part(prefix_id, '_', 1) = app.tenant_id).
event_records: actor_id/user_id = current_user_id().
admin bypass 정책 전 테이블 공통.
RLS 매트릭스 테스트 6종 (ingest_app 저권한).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 회귀 점검

- [ ] **Step 1: 3 store SQLite + 기존 PG 테스트 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter resource-policy-store --filter audit-recorder-store --filter ingest-server test 2>&1 | tail -15
```

Expected: 모두 PASS. RLS 신규는 env gate 로 별도 실행.

- [ ] **Step 2: Plan 15a smoke 재실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && ./scripts/test-rls-helpers.sh 2>&1 | tail -3
```

Expected: helpers 통과. Task 2~5 의 DDL 변경이 helper 함수에 영향 없음.

- [ ] **Step 3: def gate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli def validate 2>&1 | tail -5
```

Expected: errors 0.

---

## Self-Review

- [ ] `rls-bits.ts` 가 RP/AUDIT/INGEST/EVENT bit 상수 SSOT — 6 상수 유니크
- [ ] `auth.resource_policies` 에 5 정책 (admin bypass + SELECT/INSERT/UPDATE/DELETE) — `rp_temp_allow_all` 제거됨
- [ ] `audit.audit_entries` 에 3 정책 (admin bypass + SELECT + INSERT) — UPDATE/DELETE 는 admin 전용
- [ ] `ingest.key_observations` + `ingest.key_observation_prefixes` 에 tenant 경계 정책 5종
- [ ] `ingest.event_records` 에 actor/user 본인 경계 정책 3종
- [ ] 매트릭스 테스트 3 파일: 7 + 6 + 6 = 19 assertion (env gate `QA_TEST_PG=1`)
- [ ] FORCE 는 적용하지 않음 — Plan 15e 에서 토글 (spec §방법 Phase 4·5)
- [ ] REGISTERED/DELEGATED DB 직접 접근은 admin bypass 만 허용 (spec §정의 3 핵심 결정)
- [ ] 모든 정책이 helper 함수 경유 — bitmap_mask 없으면 default deny

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| SET LOCAL 자동 주입 미들웨어 | Phase 3 범위 | Plan 15c |
| FORCE ROW LEVEL SECURITY | Phase 5 범위 | Plan 15e |
| shadow 로깅 (정책 적용 결과만 수집) | Phase 4 범위 | Plan 15d |
| tenant_id 주입 경로 — JWT claim 에서 추출 | Plan 15c 와 함께 | Plan 15c |
| `audit_writer` 별도 role 분리 (UPDATE 허용) | 운영 시점 | Plan 15e 이후 |
| `prefix_id` tenant prefix 검증 리팩토링 (현재는 split_part 휴리스틱) | 안정 후 | 후속 proposal |

---

## 의존·후속

- **Plan 15a (RLS helper functions)**: 본 plan 의 필수 선행 — 모든 정책이 `auth.has_bit`·`auth.current_user_id`·`auth.resource_state`·`auth.current_role_tag` 에 의존.
- **Plan 05b / 06b / 07b / 07c**: 테이블 DDL 및 placeholder RLS 가 본 plan 에서 교체되는 대상.
- **Plan 15c (session context middleware)**: 본 plan 의 정책이 요구하는 세션 GUC (`app.user_id`, `app.bitmap_mask`, `app.tenant_id`, `app.role`) 를 application 레이어에서 주입. 본 plan 과 병렬 가능하지만 15c 완료 전까지는 실 서비스 호출 시 default deny.
- **Plan 15d (shadow mode)**: 본 plan 의 정책이 정의된 상태에서 실측 트래픽으로 false positive 분석.
- **Plan 15e (enforce mode)**: 본 plan 의 정책에 FORCE 추가 + admin bypass role 강화.
- **시나리오 검증 — Plan 13b (Scenario 4 cross-department deny)**: 본 plan 의 정책 구조 만으로는 **부서 경계 자체를 DB RLS 로 표현하지 않는다** (spec §정의 3 "복잡한 정책 판정은 RLS 내에서 수행하지 않는다"). Scenario 4 의 cross-dept deny 는 application-level AccessChecker 가 최종 판정하고, RLS 는 REGISTERED 리소스의 DB 직접 접근 자체를 봉쇄하는 보조 방어선 — 시나리오 4 는 bob 이 REGISTERED budget_request row 를 API 우회로 조회하려 해도 RLS default deny 로 막히는 것을 별도 회귀로 검증 (Plan 15e 에서 추가).
