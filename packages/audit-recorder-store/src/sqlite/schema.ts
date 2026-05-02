// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * audit_entries — nested audit tracing.
 *
 * 단일 테이블에 execution + check entry를 모두 저장.
 * `kind` 컬럼으로 분기, kind별 nullable 컬럼은 InMemory 구현과 1:1.
 */
export const auditEntries = sqliteTable(
  "audit_entries",
  {
    spanId: text("span_id").primaryKey(),
    traceId: text("trace_id").notNull(),
    parentSpanId: text("parent_span_id"),
    rootSpanId: text("root_span_id").notNull(),
    depth: integer("depth").notNull(),
    kind: text("kind", { enum: ["execution", "check"] }).notNull(),

    // execution kind
    apiId: text("api_id"),
    actorUserId: text("actor_user_id"),
    actorTenantId: text("actor_tenant_id"),
    targetKind: text("target_kind"),
    targetId: text("target_id"),
    outcome: text("outcome", { enum: ["allow", "deny", "error"] }),

    // check kind
    pass: text("pass", { enum: ["bitmap", "lifecycle", "cerbos", "acl"] }),
    address: integer("address"),
    unionKind: text("union_kind"),
    denyReason: text("deny_reason"),

    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
    metadata: text("metadata"), // JSON-serialized
  },
  (t) => [
    index("idx_audit_trace").on(t.traceId),
    index("idx_audit_root").on(t.rootSpanId),
    index("idx_audit_parent").on(t.parentSpanId),
    index("idx_audit_actor").on(t.actorUserId, t.startedAt),
    index("idx_audit_target").on(t.targetKind, t.targetId),
  ],
);

export const AUDIT_ENTRIES_DDL = `
CREATE TABLE IF NOT EXISTS audit_entries (
  span_id           TEXT PRIMARY KEY,
  trace_id          TEXT NOT NULL,
  parent_span_id    TEXT,
  root_span_id      TEXT NOT NULL,
  depth             INTEGER NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('execution','check')),
  api_id            TEXT,
  actor_user_id     TEXT,
  actor_tenant_id   TEXT,
  target_kind       TEXT,
  target_id         TEXT,
  outcome           TEXT CHECK (outcome IN ('allow','deny','error')),
  pass              TEXT CHECK (pass IN ('bitmap','lifecycle','cerbos','acl')),
  address           INTEGER,
  union_kind        TEXT,
  deny_reason       TEXT,
  started_at        TEXT NOT NULL,
  ended_at          TEXT,
  metadata          TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_trace ON audit_entries(trace_id);
CREATE INDEX IF NOT EXISTS idx_audit_root ON audit_entries(root_span_id);
CREATE INDEX IF NOT EXISTS idx_audit_parent ON audit_entries(parent_span_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_entries(actor_user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_entries(target_kind, target_id);
`;
