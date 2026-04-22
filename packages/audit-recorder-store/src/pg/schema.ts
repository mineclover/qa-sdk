// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

import { index, integer, jsonb, pgSchema, text, varchar } from "drizzle-orm/pg-core";

/**
 * audit schema 안의 audit_entries 테이블.
 *
 * SQLite 버전(sqlite/schema.ts)과 동일 컬럼·인덱스·invariant. PG-specific 변경:
 *   - kind/outcome/pass는 PG enum 대신 CHECK constraint 유지 (varchar + check)
 *     (SQLite와 동일 패턴. drizzle pg enum은 별도 마이그레이션 라운드 필요해 회피)
 *   - metadata는 jsonb로 저장 (SQLite는 text JSON-string). adapter 토글 분기.
 *   - text 컬럼은 PG에서도 text (둘 다 unbounded)
 *
 * RLS는 본 schema에 ENABLE만, 정책 정의는 Phase 3 RLS plan.
 *
 * audit 도메인 grant 모델 (pg-migration-design.md §3):
 *   - audit_app: SELECT, INSERT만 (write-mostly, UPDATE·DELETE 금지)
 *   - qa_admin:  SELECT만 (cross-domain 분석)
 * UPDATE는 finishExecution에서 사용 — adapter는 별도 superuser/owner role 사용 가정.
 * 본 placeholder 단계에서는 임시 fallback 정책으로 모든 access 허용.
 */
const auditPgSchema = pgSchema("audit");

export const auditEntries = auditPgSchema.table(
  "audit_entries",
  {
    spanId: text("span_id").primaryKey(),
    traceId: text("trace_id").notNull(),
    parentSpanId: text("parent_span_id"),
    rootSpanId: text("root_span_id").notNull(),
    depth: integer("depth").notNull(),
    kind: varchar("kind", { length: 16 }).notNull(), // CHECK는 raw DDL에서

    // execution kind
    apiId: text("api_id"),
    actorUserId: text("actor_user_id"),
    actorTenantId: text("actor_tenant_id"),
    targetKind: text("target_kind"),
    targetId: text("target_id"),
    outcome: varchar("outcome", { length: 16 }),

    // check kind
    pass: varchar("pass", { length: 16 }),
    address: integer("address"),
    unionKind: text("union_kind"),
    denyReason: text("deny_reason"),

    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
    metadata: jsonb("metadata"),
  },
  (t) => [
    index("idx_audit_trace_pg").on(t.traceId),
    index("idx_audit_root_pg").on(t.rootSpanId),
    index("idx_audit_parent_pg").on(t.parentSpanId),
    index("idx_audit_actor_pg").on(t.actorUserId, t.startedAt),
    index("idx_audit_target_pg").on(t.targetKind, t.targetId),
  ],
);

/**
 * PG raw DDL — Drizzle Kit 마이그레이션 정착 전까지 fixture/migration용.
 * RLS는 placeholder (`ENABLE`만 + 임시 allow-all 정책 — Phase 3에서 정교화).
 *
 * grant는 fixture 환경에서는 superuser/qa_admin이 모두 수행 가능하므로 주석으로만 명시.
 * 실 운영 환경의 audit_app role grant는 init.sql(Plan 04a)에서 단일 책임으로 부여한다.
 */
export const AUDIT_ENTRIES_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.audit_entries (
  span_id           TEXT PRIMARY KEY,
  trace_id          TEXT NOT NULL,
  parent_span_id    TEXT,
  root_span_id      TEXT NOT NULL,
  depth             INTEGER NOT NULL,
  kind              VARCHAR(16) NOT NULL CHECK (kind IN ('execution','check')),
  api_id            TEXT,
  actor_user_id     TEXT,
  actor_tenant_id   TEXT,
  target_kind       TEXT,
  target_id         TEXT,
  outcome           VARCHAR(16) CHECK (outcome IS NULL OR outcome IN ('allow','deny','error')),
  pass              VARCHAR(16) CHECK (pass IS NULL OR pass IN ('bitmap','lifecycle','cerbos','acl')),
  address           INTEGER,
  union_kind        TEXT,
  deny_reason       TEXT,
  started_at        TEXT NOT NULL,
  ended_at          TEXT,
  metadata          JSONB
);
CREATE INDEX IF NOT EXISTS idx_audit_trace_pg  ON audit.audit_entries(trace_id);
CREATE INDEX IF NOT EXISTS idx_audit_root_pg   ON audit.audit_entries(root_span_id);
CREATE INDEX IF NOT EXISTS idx_audit_parent_pg ON audit.audit_entries(parent_span_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor_pg  ON audit.audit_entries(actor_user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_audit_target_pg ON audit.audit_entries(target_kind, target_id);

-- RLS placeholder — Phase 3 RLS plan에서 정책 추가
ALTER TABLE audit.audit_entries ENABLE ROW LEVEL SECURITY;
-- 임시 fallback 정책 (Phase 3에서 더 정교한 정책으로 교체):
CREATE POLICY ae_temp_allow_all ON audit.audit_entries
  USING (true)
  WITH CHECK (true);

-- grant 모델 (init.sql에서 부여, 본 DDL은 도메인 의도 기록용 주석):
--   GRANT USAGE          ON SCHEMA audit                      TO audit_app;
--   GRANT SELECT, INSERT ON audit.audit_entries               TO audit_app;
--   GRANT USAGE          ON SCHEMA audit                      TO qa_admin;
--   GRANT SELECT         ON audit.audit_entries               TO qa_admin;
-- UPDATE(finishExecution)은 별도 audit_writer role에서 수행 — Phase 3에서 분리.
`;
