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
