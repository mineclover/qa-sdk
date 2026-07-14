// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * CLI decision-flow Drizzle 스키마 정의
 *
 * 1개 테이블: flow_instances
 * drizzle-kit generate로 마이그레이션 SQL 생성 시 사용
 */
import type { FlowInstance } from 'decision-flow';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const flowInstances = sqliteTable(
  'flow_instances',
  {
    id: text('id').notNull().primaryKey(),
    schemaId: text('schema_id').notNull(),
    schemaVersion: text('schema_version').notNull(),
    status: text('status').$type<FlowInstance['status']>().notNull(),
    context: text('context').notNull().default('{}'),
    selections: text('selections').notNull().default('[]'),
    outcome: text('outcome'),
    address: integer('address'),
    addressContext: text('address_context'),
    verdict: text('verdict'),
    testPlan: text('test_plan'),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    index('idx_fi_schema').on(t.schemaId),
    index('idx_fi_status').on(t.status),
    index('idx_fi_started').on(t.startedAt),
  ],
);
