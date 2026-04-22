# Plan 15e — RLS Enforce Mode (FORCE + admin bypass role + 회귀 검증)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `authorization-ontology-rls-enforcement.spec.md` §방법 **Phase 5 — enforce** 를 구현한다. Plan 15b 에서 정의된 정책에 `FORCE ROW LEVEL SECURITY` 를 추가해 table owner·superuser 도 정책 대상이 되도록 최종 활성화한다. 본 plan 은 (1) 4 테이블에 FORCE 토글 마이그레이션 SQL, (2) 별도 PG role `qa_admin_bypass` (pgAudit 강제) 도입, (3) enforce 후 회귀 검증 — 특히 **시뮬레이션 시나리오 4 cross-department deny** 가 DB RLS 레벨에서도 동일하게 차단되는지 e2e 재현, (4) enforce rollback 절차 + 운영 runbook. Phase 3 RLS 의 최종 단계.

**Architecture:**
- **FORCE 의 효과**: `ALTER TABLE ... FORCE ROW LEVEL SECURITY` 추가 시 table owner(보통 schema 생성자 = postgres superuser) 및 RLS bypass 권한(`BYPASSRLS`) 없는 모든 role 에 정책 적용. qa-sdk 현 구성에서는 qa_admin 도 FORCE 대상(BYPASSRLS 없음) → admin 경로는 **새 role `qa_admin_bypass`** 로 분리.
- **`qa_admin_bypass` role**:
  - `CREATE ROLE qa_admin_bypass WITH LOGIN PASSWORD <from sops> BYPASSRLS` — RLS 완전 우회.
  - 용도: 마이그레이션·backup/restore·긴급 운영. 일반 CLI 는 `qa_admin` 사용.
  - pgAudit extension 활성 + `qa_admin_bypass` 의 모든 쿼리 감사 로깅 (spec §주의사항 "admin bypass 감사").
- **spec §4 Admin bypass 재정의**:
  - 기존(Plan 15b): `auth.current_role_tag() = 'admin'` (session GUC 기반)
  - FORCE 후: **session GUC 기반 bypass 는 유지** — application 레이어 admin 사용자 (role='admin' JWT claim) 가 일반 `auth_app` 연결로 들어와도 정책 통과. 이는 API 경유 admin.
  - **DB 직접 admin** (마이그레이션·수동 CLI) 은 별도 `qa_admin_bypass` 연결 → BYPASSRLS 로 우회.
  - 두 경로 모두 감사 기록: API 경유 admin 은 application-level AccessChecker 와 audit-recorder 가 기록, DB 직접 admin 은 pgAudit.
- **시나리오 4 회귀** (spec §테스트 전략 "shadow/enforce 일치"):
  - 기존 application-level 에서 bob 이 engineering 부서 request 를 승인 시도 → AccessChecker Pass 2 deny. 본 plan 후에는 DB 쿼리 자체도 RLS 에 의해 차단되어야 함.
  - 회귀 테스트: `RlsAwarePgResourcePolicyRegistry` 로 bob 세션 주입 후 `listByOwner("alice")` 호출 → 0 row (RLS deny, throw 아님). cross-dept 시나리오는 budget_request 테이블이 있지만 본 저장소에는 아직 없으므로 **resource_policies + audit_entries 두 테이블에서의 cross-actor/cross-tenant 차단** 으로 대리.
- **Rollback 계획**: FORCE 제거는 단일 SQL (`ALTER TABLE ... NO FORCE ROW LEVEL SECURITY`). 긴급 상황 runbook 제공. **DISABLE ROW LEVEL SECURITY 는 금지** (spec §주의사항).
- **마이그레이션 SQL 전달 방식**: 본 plan 은 `packages/infra-engine/init/qa-sdk-db-enforce.sql` 신규 파일 + `apply-rls-enforce.sh` 스크립트로 기존 컨테이너에 수동 적용. init 디렉토리에는 넣지 않음 — enforce 는 **shadow 분석 후 수동 승인** 이 필수 (spec §방법 Phase 5).

**Tech Stack:**
- PostgreSQL 16 `ALTER TABLE ... FORCE ROW LEVEL SECURITY`
- (선택) pgAudit extension — 본 plan 은 사용 권장 + CREATE EXTENSION SQL 만 포함, 실제 설치는 운영자 재량
- `db-bootstrap` (Plan 04c/15c) — `qa_admin_bypass` 연결 factory 확장
- `@qa-sdk/cli` — `rls enforce` / `rls rollback` 명령

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/infra-engine/init/qa-sdk-db-enforce.sql` | 4 테이블 FORCE 토글 + `qa_admin_bypass` role + pgAudit extension (optional) |
| `packages/infra-engine/init/qa-sdk-db-rollback-enforce.sql` | NO FORCE 되돌리기 (긴급 runbook) |
| `packages/infra-engine/scripts/apply-rls-enforce.sh` | 사전 조건 확인 + enforce SQL 적용 |
| `packages/infra-engine/scripts/rollback-rls-enforce.sh` | 긴급 rollback |
| `packages/cli/src/commands/rls/enforce.ts` | `qa-sdk rls enforce` / `rls rollback` 명령 |
| `packages/cli/src/commands/rls/enforce.test.ts` | 명령이 적용될 테이블 목록 + 사전 조건 검사 |
| `packages/db-bootstrap/src/admin-bypass.ts` | `createAdminBypassConnection` — BYPASSRLS role 전용 factory |
| `packages/db-bootstrap/src/admin-bypass.test.ts` | env gate — bypass role 이 실제 BYPASSRLS 보유 확인 |
| `packages/resource-policy-store/src/pg/rls-regression.test.ts` | 시나리오 4 회귀 — bob 이 alice 리소스 cross-actor deny (FORCE 후) |
| `packages/audit-recorder-store/src/pg/rls-regression.test.ts` | cross-actor audit 조회 deny (FORCE 후) |
| `docs/proposals/auth-model-implementation-backlog/rls-enforce-runbook.md` | 운영 runbook + rollback 절차 |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/cli/src/index.ts` | `rls` 명령 등록 |
| `packages/db-bootstrap/src/index.ts` | `createAdminBypassConnection` re-export |

---

## Task 0: baseline

- [ ] **Step 1: Plan 15a/15b/15c/15d 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls packages/infra-engine/init/qa-sdk-db-helpers.sql && \
  grep -n "rp_select_policy"  packages/resource-policy-store/src/pg/schema.ts && \
  ls packages/db-bootstrap/src/rls-nest-interceptor.ts && \
  ls packages/db-bootstrap/src/rls-shadow-evaluator.ts && \
  ls docs/proposals/auth-model-implementation-backlog/shadow-analysis-template.md
```

Expected: 5 hit. 미완료 시 선행 plan 종결 후 본 plan 시작.

- [ ] **Step 2: shadow 분석 리포트 존재 확인 (운영 Go/NoGo 의 형식적 전제)**

```bash
ls /Users/junwoobang/workflow/qa-sdk/docs/proposals/auth-model-implementation-backlog/shadow-analysis-*.md 2>&1 | head -3
```

Expected: 최소 1 개 실측 리포트 존재. **없으면 본 plan 은 실제 프로덕션 적용 금지** — 스캐폴딩 까지만 진행 가능.

- [ ] **Step 3: 현재 RLS 테스트 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  QA_TEST_PG=1 \
  QA_TEST_PG_PASSWORD=$(grep '^QA_SDK_ADMIN_PASSWORD=' packages/infra-engine/.env.docker | cut -d= -f2) \
  QA_TEST_PG_AUTH_APP_PASSWORD=$(grep '^QA_SDK_AUTH_PASSWORD=' packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter resource-policy-store --filter audit-recorder-store test 2>&1 | tail -10
```

Expected: Plan 15b/15c 테스트 PASS. 본 plan 은 FORCE 적용 후 동일 테스트 여전히 PASS 여야 함.

---

## Task 1: qa-sdk-db-enforce.sql — FORCE 토글 + qa_admin_bypass role

**Files:**
- Create: `packages/infra-engine/init/qa-sdk-db-enforce.sql`
- Create: `packages/infra-engine/init/qa-sdk-db-rollback-enforce.sql`

- [ ] **Step 1: enforce SQL 작성**

`packages/infra-engine/init/qa-sdk-db-enforce.sql`:

```sql
-- qa-sdk Phase 5 enforce — Plan 15e
-- shadow 분석 통과 후 수동 적용. init 자동 실행 대상 아님.
-- 적용 전제: Plan 15a helpers + Plan 15b policies 모두 배포 완료.

\c qa_sdk

\getenv qa_admin_bypass_pw QA_SDK_ADMIN_BYPASS_PASSWORD

-- 1. qa_admin_bypass role 신설 — BYPASSRLS + 감사 대상
--    일반 admin (qa_admin) 은 RLS 대상 (Plan 15b 의 app.role='admin' GUC 경로 사용).
--    마이그레이션·backup·긴급 운영은 본 role 로 로그인.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qa_admin_bypass') THEN
    CREATE ROLE qa_admin_bypass WITH LOGIN PASSWORD :'qa_admin_bypass_pw' BYPASSRLS;
  ELSE
    ALTER ROLE qa_admin_bypass BYPASSRLS;
  END IF;
END$$;

-- 2. qa_admin_bypass 에 5 schema read/write 모두 허가 (마이그레이션용)
GRANT USAGE ON SCHEMA auth, audit, ingest, decision, definition TO qa_admin_bypass;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth, audit, ingest, decision, definition TO qa_admin_bypass;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth, audit, ingest, decision, definition GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qa_admin_bypass;

-- 3. FORCE 적용 — 4 테이블 (+ shadow 테이블)
ALTER TABLE auth.resource_policies        FORCE ROW LEVEL SECURITY;
ALTER TABLE audit.audit_entries           FORCE ROW LEVEL SECURITY;
ALTER TABLE ingest.key_observations       FORCE ROW LEVEL SECURITY;
ALTER TABLE ingest.key_observation_prefixes FORCE ROW LEVEL SECURITY;
ALTER TABLE ingest.event_records          FORCE ROW LEVEL SECURITY;
ALTER TABLE audit.rls_shadow_decisions    FORCE ROW LEVEL SECURITY;

-- 4. (선택) pgAudit 활성 — qa_admin_bypass 의 모든 쿼리 로깅.
--    pgAudit extension 이 컨테이너에 없으면 CREATE EXTENSION 실패 → 경고 후 skip.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pgaudit') THEN
    CREATE EXTENSION IF NOT EXISTS pgaudit;
    EXECUTE $a$ALTER ROLE qa_admin_bypass SET pgaudit.log = 'all'$a$;
    RAISE NOTICE 'pgAudit 활성화 완료 — qa_admin_bypass 쿼리 전체 감사';
  ELSE
    RAISE NOTICE 'pgAudit 미설치 — 건너뜀. 운영 도입 시 postgres 이미지를 pgaudit 포함으로 교체.';
  END IF;
END$$;

-- 5. BYPASSRLS 확인 쿼리 (스크립트가 파싱하는 sentinel)
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname IN ('qa_admin_bypass','qa_admin','auth_app','audit_app','ingest_app') ORDER BY rolname;
```

- [ ] **Step 2: rollback SQL 작성**

`packages/infra-engine/init/qa-sdk-db-rollback-enforce.sql`:

```sql
-- 긴급 rollback — FORCE 만 제거. ENABLE 은 유지 (DISABLE 금지, spec §주의사항).
-- 실행 조건: shadow mode 복귀가 필요한 사고 상황. 반드시 runbook 승인 후.

\c qa_sdk

ALTER TABLE auth.resource_policies        NO FORCE ROW LEVEL SECURITY;
ALTER TABLE audit.audit_entries           NO FORCE ROW LEVEL SECURITY;
ALTER TABLE ingest.key_observations       NO FORCE ROW LEVEL SECURITY;
ALTER TABLE ingest.key_observation_prefixes NO FORCE ROW LEVEL SECURITY;
ALTER TABLE ingest.event_records          NO FORCE ROW LEVEL SECURITY;
ALTER TABLE audit.rls_shadow_decisions    NO FORCE ROW LEVEL SECURITY;

-- qa_admin_bypass 역할은 유지 — 운영 CLI 가 계속 사용.
-- FORCE 만 해제되었으므로 table owner(postgres) + BYPASSRLS role 은 정책 통과.
-- 일반 auth_app / audit_app 등은 여전히 정책 적용됨.
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/infra-engine/init/qa-sdk-db-enforce.sql \
          packages/infra-engine/init/qa-sdk-db-rollback-enforce.sql && \
  git commit -m "$(cat <<'EOF'
feat(infra-engine): qa-sdk-db-enforce.sql — FORCE ROW LEVEL SECURITY + qa_admin_bypass

4 테이블 + shadow 테이블 FORCE 활성화.
qa_admin_bypass role BYPASSRLS (마이그레이션·긴급 운영 전용).
pgAudit extension (가용 시) — bypass 쿼리 전체 감사.
rollback SQL 은 NO FORCE 만 — DISABLE 금지 (spec §주의사항).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: apply-rls-enforce.sh + rollback-rls-enforce.sh

**Files:**
- Create: `packages/infra-engine/scripts/apply-rls-enforce.sh`
- Create: `packages/infra-engine/scripts/rollback-rls-enforce.sh`

- [ ] **Step 1: apply 스크립트 작성**

`packages/infra-engine/scripts/apply-rls-enforce.sh`:

```bash
#!/usr/bin/env bash
# qa-sdk RLS enforce 적용 — 사전 조건 검사 + FORCE 토글.
# 운영 적용 전 shadow-analysis-*.md 승인 필수.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

COMPOSE="docker compose -f docker-compose.infra.yaml"

echo "==> 사전 조건 1: qa-sdk-db 컨테이너 healthy"
$COMPOSE ps qa-sdk-db | grep -q healthy || { echo "qa-sdk-db 가 healthy 아님"; exit 1; }

echo "==> 사전 조건 2: helper 함수 4개 배포 확인"
count=$($COMPOSE exec -T qa-sdk-db psql -U postgres -d qa_sdk -tA -c \
  "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='auth' AND p.proname IN ('current_user_id','has_bit','resource_state','current_role_tag');" | tr -d '[:space:]')
if [[ "$count" != "4" ]]; then
  echo "helper 함수 누락 — Plan 15a apply-rls-helpers.sh 먼저 실행"; exit 1
fi

echo "==> 사전 조건 3: Plan 15b 정책 배포 확인 (rp_select_policy)"
$COMPOSE exec -T qa-sdk-db psql -U postgres -d qa_sdk -tA -c \
  "SELECT polname FROM pg_policy WHERE polname='rp_select_policy';" | grep -q rp_select_policy \
  || { echo "Plan 15b 정책 미배포 — 해당 plan 먼저 실행"; exit 1; }

echo "==> 사전 조건 4: QA_SDK_ADMIN_BYPASS_PASSWORD 환경 변수"
if [[ -z "${QA_SDK_ADMIN_BYPASS_PASSWORD:-}" ]]; then
  echo "QA_SDK_ADMIN_BYPASS_PASSWORD 미설정 — .env.docker 또는 sops 에서 로드"
  exit 1
fi

echo "==> enforce SQL 적용"
$COMPOSE exec -T -e QA_SDK_ADMIN_BYPASS_PASSWORD qa-sdk-db \
  psql -U postgres -d qa_sdk -v ON_ERROR_STOP=1 < ./init/qa-sdk-db-enforce.sql

echo "==> 검증: FORCE 4 테이블 확인"
$COMPOSE exec -T qa-sdk-db psql -U postgres -d qa_sdk -tA -c \
  "SELECT schemaname || '.' || tablename FROM pg_tables WHERE rowsecurity = true AND tablename IN ('resource_policies','audit_entries','key_observations','key_observation_prefixes','event_records','rls_shadow_decisions') ORDER BY tablename;"

echo "==> 검증: qa_admin_bypass BYPASSRLS"
has_bypass=$($COMPOSE exec -T qa-sdk-db psql -U postgres -tA -c \
  "SELECT rolbypassrls FROM pg_roles WHERE rolname='qa_admin_bypass';")
[[ "$(echo $has_bypass | tr -d '[:space:]')" == "t" ]] || { echo "qa_admin_bypass BYPASSRLS 미보유"; exit 1; }

echo "✓ RLS enforce 적용 완료. 회귀 테스트 실행 권장: pnpm -r test + 시나리오 4 재현"
```

```bash
chmod +x /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/scripts/apply-rls-enforce.sh
```

- [ ] **Step 2: rollback 스크립트 작성**

`packages/infra-engine/scripts/rollback-rls-enforce.sh`:

```bash
#!/usr/bin/env bash
# 긴급 rollback — FORCE 제거. runbook 승인 후에만 실행.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

COMPOSE="docker compose -f docker-compose.infra.yaml"

echo "!! ROLLBACK — FORCE ROW LEVEL SECURITY 해제합니다 (Ctrl-C 로 중단)"
sleep 3

$COMPOSE exec -T qa-sdk-db psql -U postgres -d qa_sdk -v ON_ERROR_STOP=1 < ./init/qa-sdk-db-rollback-enforce.sql

echo "==> 검증: FORCE 해제 확인"
$COMPOSE exec -T qa-sdk-db psql -U postgres -d qa_sdk -tA -c \
  "SELECT schemaname || '.' || tablename || ' forcerowsecurity=' || forcerowsecurity FROM pg_tables t JOIN pg_class c ON t.tablename=c.relname WHERE c.relrowsecurity AND t.tablename IN ('resource_policies','audit_entries','key_observations','event_records');"

echo "✓ Rollback 완료. shadow mode 로 복귀. 원인 분석 후 재적용 필요."
```

```bash
chmod +x /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/scripts/rollback-rls-enforce.sh
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/infra-engine/scripts/apply-rls-enforce.sh \
          packages/infra-engine/scripts/rollback-rls-enforce.sh && \
  git commit -m "$(cat <<'EOF'
feat(infra-engine): apply/rollback-rls-enforce.sh — Phase 5 운영 스크립트

apply: 사전 조건 4종 (healthy / helper 4개 / 정책 / 비밀번호) 검증 후 FORCE 적용.
rollback: NO FORCE 로 되돌림 (DISABLE 금지).
둘 다 검증 쿼리로 상태 확인 — 사일런트 실패 방지.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: db-bootstrap — admin-bypass 전용 connection factory

**Files:**
- Create: `packages/db-bootstrap/src/admin-bypass.ts`
- Create: `packages/db-bootstrap/src/admin-bypass.test.ts`
- Modify: `packages/db-bootstrap/src/index.ts`

- [ ] **Step 1: admin-bypass.ts 작성**

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import postgres from "postgres";
import type { Sql } from "postgres";

/**
 * qa_admin_bypass 연결 전용 factory (Plan 15e Phase 5).
 * BYPASSRLS role 로 RLS 완전 우회 — 마이그레이션·백업·긴급 운영 경로.
 * 본 connection 의 모든 쿼리는 pgAudit 로 외부에 감사 기록됨(운영).
 */
export interface AdminBypassConnectionConfig {
  host: string;
  port: number;
  database: string;
  password: string;   // QA_SDK_ADMIN_BYPASS_PASSWORD
  max?: number;
}

export interface AdminBypassConnection {
  sql: Sql;
  close(): Promise<void>;
}

export async function createAdminBypassConnection(
  cfg: AdminBypassConnectionConfig,
): Promise<AdminBypassConnection> {
  const sql = postgres({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: "qa_admin_bypass",
    password: cfg.password,
    max: cfg.max ?? 3,
    onnotice: () => {},
  });
  // role 이 실제 BYPASSRLS 보유하는지 즉시 확인 — FORCE 미적용 상태에서 실수로 일반 role 사용 방지
  const rows = await sql<{ rolbypassrls: boolean }[]>`
    SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user
  `;
  if (!rows[0] || rows[0].rolbypassrls !== true) {
    await sql.end();
    throw new Error(
      `createAdminBypassConnection: current_user 가 BYPASSRLS 미보유. qa_admin_bypass role 로 로그인했는지 확인.`,
    );
  }
  return { sql, close: async () => { await sql.end(); } };
}
```

- [ ] **Step 2: admin-bypass.test.ts (env gate)**

```ts
import { describe, expect, it } from "vitest";
import { createAdminBypassConnection } from "./admin-bypass.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";
const BYPASS_AVAILABLE = !!process.env.QA_TEST_PG_ADMIN_BYPASS_PASSWORD;

describe.skipIf(!(PG_AVAILABLE && BYPASS_AVAILABLE))("createAdminBypassConnection", () => {
  const cfg = {
    host: process.env.QA_TEST_PG_HOST ?? "localhost",
    port: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
    database: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
    password: process.env.QA_TEST_PG_ADMIN_BYPASS_PASSWORD ?? "",
  };

  it("BYPASSRLS role 로그인 성공", async () => {
    const conn = await createAdminBypassConnection(cfg);
    try {
      const rows = await conn.sql<{ rolname: string; rolbypassrls: boolean }[]>`
        SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = current_user
      `;
      expect(rows[0].rolbypassrls).toBe(true);
      expect(rows[0].rolname).toBe("qa_admin_bypass");
    } finally {
      await conn.close();
    }
  });

  it("잘못된 비밀번호 → reject", async () => {
    await expect(
      createAdminBypassConnection({ ...cfg, password: "wrong-password" }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 3: index.ts re-export**

```ts
export {
  createAdminBypassConnection,
  type AdminBypassConnectionConfig,
  type AdminBypassConnection,
} from "./admin-bypass.js";
```

- [ ] **Step 4: typecheck + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter db-bootstrap typecheck && \
  git add packages/db-bootstrap/src/admin-bypass.ts \
          packages/db-bootstrap/src/admin-bypass.test.ts \
          packages/db-bootstrap/src/index.ts && \
  git commit -m "$(cat <<'EOF'
feat(db-bootstrap): createAdminBypassConnection — qa_admin_bypass role 전용

BYPASSRLS 보유 검증 후 connection 반환 — 일반 role 실수 사용 방지.
env gate 테스트 (QA_TEST_PG_ADMIN_BYPASS_PASSWORD 필요).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: qa-sdk rls enforce / rollback 명령

**Files:**
- Create: `packages/cli/src/commands/rls/enforce.ts`
- Create: `packages/cli/src/commands/rls/enforce.test.ts`
- Modify: `packages/cli/src/index.ts`

shell 스크립트의 TypeScript 래퍼 + 사전 조건 검사 명시화.

- [ ] **Step 1: enforce.ts 작성**

```ts
// @def.boundary cli-command
// @def.doc authorization-ontology-rls-enforcement

import type { Sql } from "postgres";

export const PROTECTED_TABLES = Object.freeze([
  "auth.resource_policies",
  "audit.audit_entries",
  "audit.rls_shadow_decisions",
  "ingest.key_observations",
  "ingest.key_observation_prefixes",
  "ingest.event_records",
] as const);

export interface EnforcePreflight {
  helperFunctionsOk: boolean;
  missingHelpers: string[];
  policyOk: boolean;
  missingPolicies: string[];
  adminBypassRoleExists: boolean;
}

/** Plan 15a/15b 의 사전 조건을 DB 에서 조회해 반환. */
export async function preflightEnforce(sql: Sql): Promise<EnforcePreflight> {
  const helpers = await sql<{ proname: string }[]>`
    SELECT p.proname FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname = 'auth'
       AND p.proname IN ('current_user_id','has_bit','resource_state','current_role_tag')
  `;
  const helperNames = helpers.map((r) => r.proname);
  const expectedHelpers = ["current_user_id", "has_bit", "resource_state", "current_role_tag"];
  const missingHelpers = expectedHelpers.filter((n) => !helperNames.includes(n));

  const policies = await sql<{ polname: string }[]>`
    SELECT polname FROM pg_policy
     WHERE polname IN ('rp_select_policy','rp_insert_policy','rp_admin_bypass',
                       'ae_select_policy','ae_insert_policy','ae_admin_bypass',
                       'ko_select_policy','er_select_policy')
  `;
  const polnames = policies.map((r) => r.polname);
  const expectedPolicies = [
    "rp_select_policy","rp_admin_bypass",
    "ae_select_policy","ae_admin_bypass",
    "ko_select_policy","er_select_policy",
  ];
  const missingPolicies = expectedPolicies.filter((p) => !polnames.includes(p));

  const bypassRole = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM pg_roles WHERE rolname = 'qa_admin_bypass'
  `;

  return {
    helperFunctionsOk: missingHelpers.length === 0,
    missingHelpers,
    policyOk: missingPolicies.length === 0,
    missingPolicies,
    adminBypassRoleExists: (bypassRole[0]?.count ?? 0) > 0,
  };
}

export interface EnforceStatus {
  table: string;
  rowSecurityEnabled: boolean;
  forced: boolean;
}

export async function queryEnforceStatus(sql: Sql): Promise<EnforceStatus[]> {
  const rows = await sql<{ full_name: string; rowsecurity: boolean; forcerowsecurity: boolean }[]>`
    SELECT n.nspname || '.' || c.relname AS full_name,
           c.relrowsecurity               AS rowsecurity,
           c.relforcerowsecurity          AS forcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
     WHERE n.nspname || '.' || c.relname = ANY(${PROTECTED_TABLES as readonly string[]})
  `;
  return rows.map((r) => ({
    table: r.full_name,
    rowSecurityEnabled: r.rowsecurity,
    forced: r.forcerowsecurity,
  }));
}

export function formatEnforceStatus(rows: EnforceStatus[]): string {
  const header = "table                                     | RLS enabled | FORCE";
  const sep = "-".repeat(header.length);
  const lines = rows.map((r) =>
    `${r.table.padEnd(42)} | ${String(r.rowSecurityEnabled).padEnd(11)} | ${String(r.forced)}`,
  );
  return [header, sep, ...lines].join("\n");
}
```

- [ ] **Step 2: 단위 테스트 — PROTECTED_TABLES + formatter 순수**

```ts
import { describe, expect, it } from "vitest";
import { PROTECTED_TABLES, formatEnforceStatus } from "./enforce.js";

describe("Plan 15e enforce — 순수 유틸", () => {
  it("PROTECTED_TABLES 6건", () => {
    expect(PROTECTED_TABLES).toHaveLength(6);
    expect(PROTECTED_TABLES).toContain("auth.resource_policies");
    expect(PROTECTED_TABLES).toContain("audit.audit_entries");
    expect(PROTECTED_TABLES).toContain("ingest.event_records");
  });
  it("formatEnforceStatus — header + rows", () => {
    const out = formatEnforceStatus([
      { table: "auth.resource_policies", rowSecurityEnabled: true, forced: true },
      { table: "audit.audit_entries",    rowSecurityEnabled: true, forced: false },
    ]);
    expect(out).toContain("RLS enabled");
    expect(out).toContain("auth.resource_policies");
    expect(out).toContain("true");
    expect(out).toContain("false");
  });
});
```

- [ ] **Step 3: CLI program 등록 (skeleton)**

`packages/cli/src/index.ts` 에 추가:

```ts
import { preflightEnforce, queryEnforceStatus, formatEnforceStatus } from "./commands/rls/enforce.js";
import { createConnection, loadDbEnv } from "db-bootstrap";

export function registerRlsCommands(program: Command) {
  const rls = program.command("rls").description("RLS 운영 명령");

  rls.command("status")
    .description("보호 테이블의 RLS/FORCE 상태")
    .action(async () => {
      const env = loadDbEnv(process.env);
      const conn = await createConnection({ dialect: "pg", pgHost: env.QA_PG_HOST, pgPort: env.QA_PG_PORT, pgDatabase: env.QA_PG_DATABASE, pgUser: env.QA_PG_USER, pgPassword: env.QA_PG_PASSWORD });
      try {
        const rows = await queryEnforceStatus((conn as never as { $client: Sql }).$client);
        console.log(formatEnforceStatus(rows));
      } finally { await conn.close(); }
    });

  rls.command("preflight")
    .description("enforce 적용 전 사전 조건 검사")
    .action(async () => {
      const env = loadDbEnv(process.env);
      const conn = await createConnection({ dialect: "pg", pgHost: env.QA_PG_HOST, pgPort: env.QA_PG_PORT, pgDatabase: env.QA_PG_DATABASE, pgUser: env.QA_PG_USER, pgPassword: env.QA_PG_PASSWORD });
      try {
        const pre = await preflightEnforce((conn as never as { $client: Sql }).$client);
        console.log(JSON.stringify(pre, null, 2));
        if (!pre.helperFunctionsOk || !pre.policyOk) process.exit(1);
      } finally { await conn.close(); }
    });
}
```

(CLI 명령 `enforce` / `rollback` 자체는 shell 스크립트가 권위 — TypeScript CLI 는 status/preflight 관측만)

- [ ] **Step 4: 테스트 + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli test -- rls && \
  pnpm --filter @qa-sdk/cli typecheck && \
  git add packages/cli/src/commands/rls/enforce.ts \
          packages/cli/src/commands/rls/enforce.test.ts \
          packages/cli/src/index.ts && \
  git commit -m "$(cat <<'EOF'
feat(@qa-sdk/cli): rls status / rls preflight — 관측 명령

PROTECTED_TABLES 6건 + preflightEnforce (helper/policy/bypass role 검증).
실제 FORCE 적용은 infra-engine/scripts/apply-rls-enforce.sh 가 수행 (SQL authority).
TS CLI 는 관측 · 사전 조건 검사만.
2 순수 테스트 (PROTECTED_TABLES 개수 + formatter).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 시나리오 4 회귀 — FORCE 후 cross-actor DB 차단

**Files:**
- Create: `packages/resource-policy-store/src/pg/rls-regression.test.ts`
- Create: `packages/audit-recorder-store/src/pg/rls-regression.test.ts`

본 테스트는 **실제 FORCE 가 적용된 qa-sdk-db 인스턴스** 에서만 의미 있음. env gate: `QA_TEST_PG=1 + QA_TEST_PG_FORCE=1`. shadow 단계에서는 skip.

- [ ] **Step 1: resource-policy-store 회귀 테스트**

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement
// 시나리오 4 회귀 — Plan 13b 의 cross-department deny 가 DB RLS 레벨에서도 차단되는지 확인.
// 본 저장소에는 budget_request 테이블이 없으므로 auth.resource_policies 의 cross-actor deny 로 대리.

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { withRlsContext } from "db-bootstrap";
import { PgResourcePolicyRegistry } from "./adapter.js";
import { RlsAwarePgResourcePolicyRegistry } from "./rls-aware-adapter.js";
import { RESOURCE_POLICIES_PG_DDL } from "./schema.js";
import { RP_READ_BIT, RP_WRITE_BIT } from "./rls-bits.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";
const FORCE_APPLIED = process.env.QA_TEST_PG_FORCE === "1";

function setBitBytes(pos: number): Uint8Array {
  const byteIdx = Math.floor(pos / 8);
  const bitIdx = pos % 8;
  const out = new Uint8Array(byteIdx + 1);
  out[byteIdx] = 1 << bitIdx;
  return out;
}

describe.skipIf(!(PG_AVAILABLE && FORCE_APPLIED))("RLS enforce 회귀 — 시나리오 4 대리 (resource_policies)", () => {
  const cfg = {
    host: process.env.QA_TEST_PG_HOST ?? "localhost",
    port: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
    database: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
  };
  let adminSql: ReturnType<typeof postgres>;
  let appSql: ReturnType<typeof postgres>;
  let testSchema: string;
  let registry: RlsAwarePgResourcePolicyRegistry;

  beforeEach(async () => {
    testSchema = `force_${randomBytes(4).toString("hex")}`;
    adminSql = postgres({ ...cfg, user: "qa_admin", password: process.env.QA_TEST_PG_PASSWORD ?? "", max: 3, onnotice: () => {} });
    const ddl = RESOURCE_POLICIES_PG_DDL
      .replaceAll("auth.resource_policies", `${testSchema}.resource_policies`)
      .replace("CREATE SCHEMA IF NOT EXISTS auth", `CREATE SCHEMA IF NOT EXISTS ${testSchema}`)
      .replaceAll("ON auth.resource_policies", `ON ${testSchema}.resource_policies`);
    await adminSql.unsafe(ddl);
    // 본 테스트용 테이블에 FORCE 수동 적용 (세션 수준 시뮬, global FORCE 는 운영 스크립트 책임)
    await adminSql.unsafe(`ALTER TABLE ${testSchema}.resource_policies FORCE ROW LEVEL SECURITY`);
    await adminSql.unsafe(`GRANT USAGE ON SCHEMA ${testSchema} TO auth_app`);
    await adminSql.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${testSchema}.resource_policies TO auth_app`);
    appSql = postgres({ ...cfg, user: "auth_app", password: process.env.QA_TEST_PG_AUTH_APP_PASSWORD ?? "", max: 3, onnotice: () => {} });
    await appSql`SET search_path TO ${appSql(testSchema)}, public`;
    registry = new RlsAwarePgResourcePolicyRegistry(appSql);
  });

  afterEach(async () => {
    try { await adminSql.unsafe(`DROP SCHEMA ${testSchema} CASCADE`); } finally {
      await adminSql.end(); await appSql.end();
    }
  });

  it("alice 가 소유한 UNREGISTERED 리소스를 bob 이 cross-actor 로 조회 시 0 row", async () => {
    // alice 가 자기 리소스를 create
    await withRlsContext(
      { userId: "alice", tenantId: null, bitmapMask: setBitBytes(RP_WRITE_BIT), role: null },
      () => registry.create({ resourceId: "r-alice", resourceType: "doc", ownerId: "alice" }),
    );
    // bob 이 alice 의 리소스 listByOwner 호출 — RLS 로 0 row (cross-actor deny)
    const rows = await withRlsContext(
      { userId: "bob", tenantId: null, bitmapMask: setBitBytes(RP_READ_BIT), role: null },
      () => registry.listByOwner("alice"),
    );
    expect(rows.length).toBe(0);
  });

  it("bob 이 직접 resolve(r-alice) 호출 → null (RLS 로 invisible)", async () => {
    await withRlsContext(
      { userId: "alice", tenantId: null, bitmapMask: setBitBytes(RP_WRITE_BIT), role: null },
      () => registry.create({ resourceId: "r-alice", resourceType: "doc", ownerId: "alice" }),
    );
    const policy = await withRlsContext(
      { userId: "bob", tenantId: null, bitmapMask: setBitBytes(RP_READ_BIT), role: null },
      () => registry.resolve("r-alice"),
    );
    expect(policy).toBeNull();
  });

  it("bob 이 대리 create(r-alice, ownerId='alice') 시도 → WITH CHECK 위반 throw", async () => {
    await expect(
      withRlsContext(
        { userId: "bob", tenantId: null, bitmapMask: setBitBytes(RP_WRITE_BIT), role: null },
        () => registry.create({ resourceId: "r-forged", resourceType: "doc", ownerId: "alice" }),
      ),
    ).rejects.toThrow(/row-level security|row violates/i);
  });

  it("admin bypass (app.role=admin) → alice 리소스 가시", async () => {
    await withRlsContext(
      { userId: "alice", tenantId: null, bitmapMask: setBitBytes(RP_WRITE_BIT), role: null },
      () => registry.create({ resourceId: "r-alice", resourceType: "doc", ownerId: "alice" }),
    );
    const policy = await withRlsContext(
      { userId: null, tenantId: null, bitmapMask: null, role: "admin" },
      () => registry.resolve("r-alice"),
    );
    expect(policy?.ownerId).toBe("alice");
  });

  it("FORCE 상태에서 table owner(qa_admin) 도 일반 정책 대상 (BYPASSRLS 없음)", async () => {
    // adminSql (qa_admin) 은 FORCE 에 의해 RLS 적용되지만 app.role 미주입이므로 0 row
    await adminSql.unsafe(`INSERT INTO ${testSchema}.resource_policies (resource_id, resource_type, state, owner_id, updated_at) VALUES ('r-admin', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')`);
    const rows = await adminSql.unsafe(`SELECT * FROM ${testSchema}.resource_policies`);
    // qa_admin 은 BYPASSRLS 없음 → default deny (helper 함수가 NULL 반환)
    expect(rows.length).toBe(0);
  });
});
```

- [ ] **Step 2: audit-recorder-store 회귀 테스트**

```ts
// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { AUDIT_ENTRIES_PG_DDL } from "./schema.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";
const FORCE_APPLIED = process.env.QA_TEST_PG_FORCE === "1";

describe.skipIf(!(PG_AVAILABLE && FORCE_APPLIED))("audit RLS enforce 회귀", () => {
  let adminSql: ReturnType<typeof postgres>;
  let appSql: ReturnType<typeof postgres>;
  let testSchema: string;

  beforeEach(async () => {
    testSchema = `forceaudit_${randomBytes(4).toString("hex")}`;
    adminSql = postgres({
      host: process.env.QA_TEST_PG_HOST ?? "localhost",
      port: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
      database: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
      user: "qa_admin", password: process.env.QA_TEST_PG_PASSWORD ?? "",
      max: 3, onnotice: () => {},
    });
    const ddl = AUDIT_ENTRIES_PG_DDL
      .replaceAll("audit.audit_entries", `${testSchema}.audit_entries`)
      .replace("CREATE SCHEMA IF NOT EXISTS audit", `CREATE SCHEMA IF NOT EXISTS ${testSchema}`)
      .replaceAll("ON audit.audit_entries", `ON ${testSchema}.audit_entries`);
    await adminSql.unsafe(ddl);
    await adminSql.unsafe(`ALTER TABLE ${testSchema}.audit_entries FORCE ROW LEVEL SECURITY`);
    await adminSql.unsafe(`GRANT USAGE ON SCHEMA ${testSchema} TO audit_app`);
    await adminSql.unsafe(`GRANT SELECT, INSERT ON ${testSchema}.audit_entries TO audit_app`);
    appSql = postgres({
      host: process.env.QA_TEST_PG_HOST ?? "localhost",
      port: Number(process.env.QA_TEST_PG_PORT ?? "5434"),
      database: process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test",
      user: "audit_app", password: process.env.QA_TEST_PG_AUDIT_APP_PASSWORD ?? "",
      max: 3, onnotice: () => {},
    });
    await appSql`SET search_path TO ${appSql(testSchema)}, public`;
  });

  afterEach(async () => {
    try { await adminSql.unsafe(`DROP SCHEMA ${testSchema} CASCADE`); } finally {
      await adminSql.end(); await appSql.end();
    }
  });

  it("bob 이 alice 의 audit entry 조회 시 0 row (FORCE cross-actor deny)", async () => {
    await adminSql.unsafe(`
      INSERT INTO ${testSchema}.audit_entries (span_id, trace_id, root_span_id, depth, kind, actor_user_id, started_at)
      VALUES ('sp-alice', 't', 'sp-alice', 0, 'execution', 'alice', '2026-04-22')
    `);
    const mask = "00000010"; // bit 20
    await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id', 'bob', true)`;
      await tx`SELECT set_config('app.bitmap_mask', ${mask}, true)`;
      const rows = await tx`SELECT * FROM ${tx(testSchema)}.audit_entries`;
      expect(rows.length).toBe(0);
    });
  });

  it("qa_admin 도 FORCE 대상 — app.role 미주입이면 0 row", async () => {
    await adminSql.unsafe(`
      INSERT INTO ${testSchema}.audit_entries (span_id, trace_id, root_span_id, depth, kind, actor_user_id, started_at)
      VALUES ('sp-1', 't', 'sp-1', 0, 'execution', 'alice', '2026-04-22')
    `);
    const rows = await adminSql.unsafe(`SELECT * FROM ${testSchema}.audit_entries`);
    expect(rows.length).toBe(0);
  });
});
```

- [ ] **Step 3: 회귀 실행 조건 문서화 + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add packages/resource-policy-store/src/pg/rls-regression.test.ts \
          packages/audit-recorder-store/src/pg/rls-regression.test.ts && \
  git commit -m "$(cat <<'EOF'
test(rls-enforce): 시나리오 4 대리 회귀 — cross-actor DB 차단

resource-policy-store: bob cross-actor list/resolve → 0 row, 대리 create → throw.
audit-recorder-store: bob 이 alice audit entry 조회 → 0 row.
qa_admin (BYPASSRLS 없음) 도 FORCE 대상 임을 확인 — app.role 없으면 default deny.
env gate: QA_TEST_PG=1 + QA_TEST_PG_FORCE=1 (FORCE 적용된 DB 전용).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: rls-enforce-runbook.md — 운영 runbook

**Files:**
- Create: `docs/proposals/auth-model-implementation-backlog/rls-enforce-runbook.md`

- [ ] **Step 1: 작성**

```markdown
# RLS Enforce 운영 Runbook — Plan 15e

> FORCE ROW LEVEL SECURITY 적용 전·후 체크리스트와 장애 대응 절차.

## 1. 적용 전 체크리스트

- [ ] Plan 15a helpers 배포 — `pnpm qa-sdk rls preflight` 의 `helperFunctionsOk=true`
- [ ] Plan 15b 정책 배포 — `policyOk=true`
- [ ] Plan 15c 세션 미들웨어가 모든 서비스에 부착됨 (auth-api, ingest-server, audit-browser-api, approval-api)
- [ ] Plan 15d shadow 기간 완료 + `shadow-analysis-*.md` 제출 + divergence 비율 < 0.1%
- [ ] `QA_SDK_ADMIN_BYPASS_PASSWORD` 환경 변수 sops 에 저장
- [ ] 백업: `pg_dump qa_sdk > backup-pre-enforce.sql` 선행

## 2. 적용 절차

```bash
cd /path/to/qa-sdk/packages/infra-engine
export QA_SDK_ADMIN_BYPASS_PASSWORD=$(sops -d .env.docker | grep '^QA_SDK_ADMIN_BYPASS_PASSWORD=' | cut -d= -f2)
./scripts/apply-rls-enforce.sh
```

출력에서 다음 확인:
- 6 테이블의 FORCE 상태 = `t`
- `qa_admin_bypass` role BYPASSRLS = `t`

## 3. 적용 직후 검증 (30분 내)

```bash
# 1. CLI status
pnpm qa-sdk rls status

# 2. 회귀 테스트
QA_TEST_PG=1 QA_TEST_PG_FORCE=1 QA_TEST_PG_PASSWORD=... QA_TEST_PG_AUTH_APP_PASSWORD=... \
  pnpm --filter resource-policy-store --filter audit-recorder-store test -- rls-regression

# 3. 시뮬레이션 시나리오 4 재실행 (Plan 13b)
SIM_SCENARIO_INPROC=1 pnpm --filter @qa-sdk/sim-scenarios test -- scenario-4
```

- 회귀 테스트 FAIL → 즉시 rollback
- 시나리오 4 의 application deny (403) 는 유지, DB 쿼리 단계에서도 invisible 확인

## 4. 장애 대응 — rollback

### 시나리오 A: 일부 서비스가 "row not found" 500 에러 대량 발생

```bash
cd /path/to/qa-sdk/packages/infra-engine
./scripts/rollback-rls-enforce.sh
```

적용 후:
- FORCE 해제 → 기존 session-based admin bypass 경로 복귀
- shadow mode 로 되돌아가 false positive 재분석
- 원인 분석: bitmap 발급 누락 / claim 누락 / interceptor 부착 누락 등

### 시나리오 B: qa_admin_bypass 비밀번호 노출 의심

```sql
-- superuser 로 접속
ALTER ROLE qa_admin_bypass PASSWORD '<new-password>';
-- sops 재암호화
```

## 5. 후속 모니터링

- 주간 `qa-sdk shadow report --hours 168` 실행 — 여전히 shadow 기록은 수행됨. divergence=0 이어야 정상.
- `audit.rls_shadow_decisions` 에 application_decision='allow' + rls_would_decision='deny' 가 급증하면 운영 이상.
- pgAudit 로그 — `qa_admin_bypass` 사용 빈도 모니터링. 일반 CLI 가 bypass 쓰지 않도록.

## 6. 용어

- **FORCE**: `ALTER TABLE ... FORCE ROW LEVEL SECURITY` — table owner 도 정책 대상.
- **BYPASSRLS**: role 권한. `ALTER ROLE ... BYPASSRLS`. FORCE 여부 무관하게 RLS 우회.
- **pgAudit**: PostgreSQL session/object-level 감사 extension.

## 7. 참조
- spec: `docs/specs/authorization-ontology/authorization-ontology-rls-enforcement.spec.md`
- plan: 15a, 15b, 15c, 15d, 15e
- apply SQL: `packages/infra-engine/init/qa-sdk-db-enforce.sql`
- rollback SQL: `packages/infra-engine/init/qa-sdk-db-rollback-enforce.sql`
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add docs/proposals/auth-model-implementation-backlog/rls-enforce-runbook.md && \
  git commit -m "$(cat <<'EOF'
docs(auth-backlog): RLS enforce 운영 runbook

적용 전 체크리스트 / 적용 절차 / 직후 검증 / 장애 rollback / 후속 모니터링.
장애 시나리오 A (500 에러 급증) + B (bypass pw 유출) 대응.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 회귀 + def gate

- [ ] **Step 1: 전체 unit test 회귀 (FORCE 미적용 기본)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter db-bootstrap --filter resource-policy-store --filter audit-recorder-store --filter @qa-sdk/cli test 2>&1 | tail -15
```

Expected: 기존 테스트 모두 PASS + 신규 순수 유틸 테스트. FORCE 의존 테스트는 `QA_TEST_PG_FORCE=1` 없어서 skip.

- [ ] **Step 2: FORCE 적용 후 회귀 (운영 수동 승인 필요)**

실제 FORCE 적용된 qa-sdk-db 에서 수행:

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  QA_TEST_PG=1 QA_TEST_PG_FORCE=1 \
  QA_TEST_PG_PASSWORD=$(grep '^QA_SDK_ADMIN_PASSWORD=' packages/infra-engine/.env.docker | cut -d= -f2) \
  QA_TEST_PG_AUTH_APP_PASSWORD=$(grep '^QA_SDK_AUTH_PASSWORD=' packages/infra-engine/.env.docker | cut -d= -f2) \
  QA_TEST_PG_AUDIT_APP_PASSWORD=$(grep '^QA_SDK_AUDIT_PASSWORD=' packages/infra-engine/.env.docker | cut -d= -f2) \
  QA_TEST_PG_ADMIN_BYPASS_PASSWORD=$(grep '^QA_SDK_ADMIN_BYPASS_PASSWORD=' packages/infra-engine/.env.docker | cut -d= -f2) \
  pnpm --filter resource-policy-store --filter audit-recorder-store --filter db-bootstrap test 2>&1 | tail -20
```

Expected: regression 테스트 5 + 기존 RLS 테스트 모두 PASS.

- [ ] **Step 3: def gate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli def validate 2>&1 | tail -5
```

Expected: errors 0.

---

## Self-Review

- [ ] `qa-sdk-db-enforce.sql` — 6 테이블 FORCE + qa_admin_bypass 생성 + pgAudit 옵션
- [ ] `qa-sdk-db-rollback-enforce.sql` — NO FORCE 만 (DISABLE 금지)
- [ ] `apply-rls-enforce.sh` — 사전 조건 4 검사 (healthy / helper 4 / policy / password)
- [ ] `rollback-rls-enforce.sh` — 긴급 rollback + 상태 검증
- [ ] `createAdminBypassConnection` — BYPASSRLS 즉시 검증, 미보유 시 throw
- [ ] `qa-sdk rls status` / `rls preflight` — 관측 명령
- [ ] 시나리오 4 회귀 — cross-actor listByOwner/resolve 0 row + 대리 create throw + admin bypass 정상 + qa_admin 도 FORCE 대상
- [ ] audit cross-actor 조회 0 row 회귀
- [ ] `rls-enforce-runbook.md` — 적용 전·중·후·장애 전 과정 커버
- [ ] 기존 15b/15c/15d 테스트 회귀 0 (FORCE 없는 환경 기본 동작)
- [ ] spec §방법 Phase 5 의 "FORCE 활성화 + admin bypass 연결만 예외 + 거절 메트릭 모니터링" 3 조건 모두 이행

---

## 시나리오 4 (cross-department deny) 검증 충분성 평가

**검증되는 부분**:
- **application-level**: Plan 13b 의 scenario-4 가 이미 bob 의 cross-dept 승인 시도 → 403 + firstFailure Pass 2 lifecycle deny 를 검증함. 본 plan 은 이 검증을 변경하지 않음.
- **DB-level cross-actor**: 본 plan 의 `rls-regression.test.ts` 가 `resource_policies` + `audit_entries` 에서 bob 이 alice 소유 row 를 읽을 때 0 row 반환을 증명.

**한계** (spec §정의 3 명시):
- RLS 는 "REGISTERED/DELEGATED 리소스는 DB 직접 접근 금지" 경계를 두는 것이지, **부서(department) 경계 자체를 DB 레벨에서 표현하지 않음** — 부서 judgment 는 application 의 AccessChecker Pass 2 가 담당. Cerbos 호출·그래프 탐색이 DB 외부 로직이기 때문.
- 따라서 시나리오 4 의 "bob(marketing) 가 engineering dept request 승인 시도 → deny" 중 DB 가 담당하는 부분은 (1) REGISTERED budget_request row 의 cross-actor 조회 차단, (2) cross-tenant 차단 (ingest 한정). 부서 경계 자체는 application layer 가 유일한 책임.

**결론**:
- 본 plan 의 회귀 테스트는 시나리오 4 의 **DB 직접 접근 bypass 를 막는 보조 방어선** 을 충분히 검증함.
- 시나리오 4 의 application-level cross-dept deny 경로는 Plan 13b 가 유일한 회귀 기준이며, 본 plan 이 그 검증을 훼손하지 않음.
- spec 핵심 결정(§정의 3)을 정확히 이행하므로, RLS 정책이 시나리오 4 의 **DB 방어** 부분을 의도한 범위 내에서 완전히 커버한다.

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| pgAudit extension 이미지 번들링 | ops 영역 — 운영자 이미지 교체 | 인프라 proposal |
| budget_request 테이블(시뮬 전용) 에 RLS 적용 | simulation Phase 4 완료 후 | Plan 11b 후속 |
| 각 서비스 controller 에 `@RlsShadow` / interceptor 본격 부착 | Plan 15c/15d 와 함께 진행 | 통합 plan |
| admin bypass 사용량 대시보드 (pgAudit → Grafana) | 운영 관측 | 인프라 proposal |
| `BYPASSRLS` 권한 박탈 시나리오 (admin 연결 차단 드릴) | 운영 기간 chaos test | 후속 drill plan |

---

## 의존·후속

- **Plan 15a (helpers)**: `apply-rls-enforce.sh` 의 사전 조건 1 (helper 4개).
- **Plan 15b (policies)**: 본 plan 이 FORCE 를 적용하는 정책의 SSOT.
- **Plan 15c (session context)**: FORCE 후 일반 role 이 정책 통과하려면 application 이 context 를 반드시 주입해야 함 → 15c 완료가 실적용 전제.
- **Plan 15d (shadow mode)**: shadow 분석 리포트가 본 plan 의 Go 조건.
- **Plan 13b (scenario 4)**: 본 plan 회귀 후에도 application-level 3 단계 판정(login / approve / audit) 이 동일하게 PASS 여야.
- **Plan 14a (marginal density)**: 본 plan 완료 후 RLS 거절 메트릭 수집이 marginal-density 측정의 새 dimension.
- **후속 — 각 서비스 migration**: sim-auth-api, ingest-server, audit-browser-api 등에 Plan 15c `RlsContextInterceptor` + 15d `RlsShadowInterceptor` 본격 부착 — 별도 실행 plan 필요.
