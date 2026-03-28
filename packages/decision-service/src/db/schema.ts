/**
 * decision-service Drizzle 스키마 정의
 *
 * 3개 테이블: flow_schemas, flow_instances, flow_links
 * drizzle-kit generate로 마이그레이션 SQL 생성 시 사용
 */
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── flow_schemas ───────────────────────────────────────

export const flowSchemas = sqliteTable("flow_schemas", {
  schemaId: text("schema_id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  version: text("version").notNull().default("v1"),
  gatesJson: text("gates_json").notNull().default("[]"),
  outcomesJson: text("outcomes_json").notNull().default("[]"),
  metaJson: text("meta_json").notNull().default("{}"),
  registeredAt: text("registered_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── flow_instances ─────────────────────────────────────

export const flowInstances = sqliteTable(
  "flow_instances",
  {
    id: text("id").primaryKey(),
    schemaId: text("schema_id").notNull(),
    schemaVersion: text("schema_version").notNull(),
    status: text("status").notNull(),
    contextJson: text("context_json").notNull().default("{}"),
    selectionsJson: text("selections_json").notNull().default("[]"),
    outcomeJson: text("outcome_json"),
    address: integer("address"),
    addressContext: text("address_context"),
    verdict: text("verdict"),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [
    index("idx_fi_schema").on(t.schemaId),
    index("idx_fi_status").on(t.status),
    index("idx_fi_started").on(t.startedAt),
  ],
);

// ─── flow_links ─────────────────────────────────────────

export const flowLinks = sqliteTable(
  "flow_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    instanceId: text("instance_id").notNull(),
    docId: text("doc_id").notNull(),
    linkType: text("link_type").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex("idx_fl_unique").on(t.instanceId, t.docId, t.linkType),
    index("idx_fl_instance").on(t.instanceId),
    index("idx_fl_doc").on(t.docId),
  ],
);
