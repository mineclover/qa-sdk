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
 * RLS 정책: Plan 15b (Phase 3) 로 rp_select/insert/update/delete/admin_bypass 5 정책 배포 완료.
 * FORCE 활성화는 Plan 15e 에서 토글.
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
`;
