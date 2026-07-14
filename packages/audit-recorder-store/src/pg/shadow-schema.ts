// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import { boolean, index, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

const auditSchema = pgSchema('audit');

/**
 * RLS shadow-mode 기록 테이블 (Plan 15d).
 * application-layer 판정 과 TS-level RLS 예측 판정을 쌍으로 기록해 divergence 를 분석.
 */
export const rlsShadowDecisions = auditSchema.table(
  'rls_shadow_decisions',
  {
    id: text('id').primaryKey(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    userId: text('user_id'),
    tenantId: text('tenant_id'),
    resourceTable: text('resource_table').notNull(),
    operation: text('operation').notNull(), // 'select' | 'insert' | 'update' | 'delete'
    applicationDecision: text('application_decision').notNull(),
    rlsWouldDecision: text('rls_would_decision').notNull(),
    divergence: boolean('divergence').notNull(), // GENERATED column 대신 app 에서 기록
    denyReason: text('deny_reason'),
    requestId: text('request_id'),
  },
  (t) => [
    index('idx_shadow_divergence').on(t.divergence, t.occurredAt),
    index('idx_shadow_time').on(t.occurredAt),
    index('idx_shadow_user').on(t.userId, t.occurredAt),
    index('idx_shadow_table_op').on(t.resourceTable, t.operation),
  ],
);

export const RLS_SHADOW_DECISIONS_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.rls_shadow_decisions (
  id                   TEXT PRIMARY KEY,
  occurred_at          TIMESTAMPTZ NOT NULL,
  user_id              TEXT,
  tenant_id            TEXT,
  resource_table       TEXT NOT NULL,
  operation            TEXT NOT NULL CHECK (operation IN ('select','insert','update','delete')),
  application_decision TEXT NOT NULL CHECK (application_decision IN ('allow','deny')),
  rls_would_decision   TEXT NOT NULL CHECK (rls_would_decision IN ('allow','deny','unknown')),
  divergence           BOOLEAN NOT NULL,
  deny_reason          TEXT,
  request_id           TEXT
);
CREATE INDEX IF NOT EXISTS idx_shadow_divergence ON audit.rls_shadow_decisions(divergence, occurred_at);
CREATE INDEX IF NOT EXISTS idx_shadow_time      ON audit.rls_shadow_decisions(occurred_at);
CREATE INDEX IF NOT EXISTS idx_shadow_user      ON audit.rls_shadow_decisions(user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_shadow_table_op  ON audit.rls_shadow_decisions(resource_table, operation);

-- shadow 테이블은 admin 만 read — RLS 정책.
ALTER TABLE audit.rls_shadow_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY shadow_admin_bypass ON audit.rls_shadow_decisions
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

CREATE POLICY shadow_insert_self ON audit.rls_shadow_decisions
  FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.current_user_id());
`;
