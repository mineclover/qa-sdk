// @def.boundary decision-service-spec
// @def.doc decision-service-spec

/**
 * decision-service Drizzle 스키마 정의
 *
 * 3개 테이블: flow_schemas, flow_instances, flow_links
 * drizzle-kit generate로 마이그레이션 SQL 생성 시 사용
 */
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── flow_schemas ───────────────────────────────────────

export interface FlowSchemaGate {
  id: string;
  label: string;
  weight: string;
  phase: string;
  branches: { id: string; label: string }[];
}

export interface FlowSchemaOutcome {
  id: string;
  label: string;
}

export interface FlowInstanceSelection {
  gateId: string;
  branchId: string;
  evidence: unknown[];
  selectedAt: string;
}

export const flowSchemas = sqliteTable('flow_schemas', {
  schemaId: text('schema_id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  version: text('version').notNull().default('v1'),
  gates: text('gates', { mode: 'json' }).$type<FlowSchemaGate[]>().notNull().default([]),
  outcomes: text('outcomes', { mode: 'json' }).$type<FlowSchemaOutcome[]>().notNull().default([]),
  meta: text('meta', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  registeredAt: text('registered_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type FlowSchemaRow = typeof flowSchemas.$inferSelect;

// ─── flow_instances ─────────────────────────────────────

export const flowInstances = sqliteTable(
  'flow_instances',
  {
    id: text('id').primaryKey(),
    schemaId: text('schema_id').notNull(),
    schemaVersion: text('schema_version').notNull(),
    status: text('status').notNull(),
    context: text('context', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    selections: text('selections', { mode: 'json' })
      .$type<FlowInstanceSelection[]>()
      .notNull()
      .default([]),
    outcome: text('outcome', { mode: 'json' }).$type<Record<string, unknown>>(),
    address: integer('address'),
    addressContext: text('address_context'),
    verdict: text('verdict'),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index('idx_fi_schema').on(t.schemaId),
    index('idx_fi_status').on(t.status),
    index('idx_fi_started').on(t.startedAt),
  ],
);

export type FlowInstanceRow = typeof flowInstances.$inferSelect;

// ─── flow_links ─────────────────────────────────────────

export const flowLinks = sqliteTable(
  'flow_links',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    instanceId: text('instance_id').notNull(),
    docId: text('doc_id').notNull(),
    linkType: text('link_type').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex('idx_fl_unique').on(t.instanceId, t.docId, t.linkType),
    index('idx_fl_instance').on(t.instanceId),
    index('idx_fl_doc').on(t.docId),
  ],
);

export type FlowLinkRow = typeof flowLinks.$inferSelect;
