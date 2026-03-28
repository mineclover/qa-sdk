/**
 * registry-service Drizzle ORM 스키마 정의
 *
 * 7개 테이블: prefix, draft_lock, axis_profile, catalogs,
 *            service_endpoint, config, event_schema
 *
 * NOTE: schema_version 테이블은 앱 레벨 마이그레이션 트래커로
 * Drizzle 관리 대상에서 제외한다 (__drizzle_migrations와 별개).
 */
import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── prefix ─────────────────────────────────────────────
export const prefix = sqliteTable(
  "prefix",
  {
    prefix: text("prefix").primaryKey(),
    owner: text("owner").notNull(),
    kind: text("kind").notNull(),
    numberType: text("number_type").notNull().default("number"),
    createdAt: text("created_at").notNull(),
    metaJson: text("meta_json"),
    labelsJson: text("labels_json"),
  },
  (t) => [
    index("idx_prefix_owner").on(t.owner),
    check("chk_prefix_kind", sql`kind IN ('leaf', 'composite')`),
    check(
      "chk_prefix_number_type",
      sql`number_type IN ('number', 'bigint')`,
    ),
  ],
);

// ─── draft_lock ─────────────────────────────────────────
export const draftLock = sqliteTable(
  "draft_lock",
  {
    prefix: text("prefix").notNull(),
    versionId: text("version_id").notNull(),
    lockedAt: text("locked_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.prefix, t.versionId] })],
);

// ─── axis_profile ───────────────────────────────────────
export const axisProfile = sqliteTable(
  "axis_profile",
  {
    id: text("id").notNull(),
    catalogId: text("catalog_id").notNull().default("demo"),
    name: text("name").notNull(),
    currentVersion: text("current_version").notNull().default("v1"),
    capacity: integer("capacity").notNull().default(32),
    entryCount: integer("entry_count").notNull().default(0),
    metaJson: text("meta_json"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.id, t.catalogId] })],
);

// ─── catalogs ───────────────────────────────────────────
// hash 컬럼은 migration v2에서 추가됨 — 현재 스키마 상태 반영
export const catalogs = sqliteTable("catalogs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  data: text("data").notNull(),
  hash: text("hash"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── service_endpoint ───────────────────────────────────
export const serviceEndpoint = sqliteTable(
  "service_endpoint",
  {
    catalogId: text("catalog_id").notNull().default("demo"),
    namespace: text("namespace").notNull(),
    svcName: text("svc_name").notNull(),
    env: text("env").notNull(),
    region: text("region").notNull(),
    url: text("url").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.catalogId, t.namespace, t.svcName, t.env, t.region],
    }),
  ],
);

// ─── config ─────────────────────────────────────────────
export const config = sqliteTable(
  "config",
  {
    catalogId: text("catalog_id").notNull(),
    configType: text("config_type").notNull(),
    data: text("data").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.catalogId, t.configType] })],
);

// ─── event_schema ───────────────────────────────────────
export const eventSchema = sqliteTable(
  "event_schema",
  {
    catalogId: text("catalog_id").notNull().default("demo"),
    serviceId: text("service_id").notNull(),
    eventKey: text("event_key").notNull(),
    eventVersion: text("event_version").notNull().default("1.0.0"),
    displayName: text("display_name").notNull(),
    description: text("description"),
    recordKind: text("record_kind").notNull().default("log"),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.catalogId, t.serviceId, t.eventKey, t.eventVersion],
    }),
    index("idx_event_schema_service").on(t.catalogId, t.serviceId),
    check(
      "chk_event_schema_record_kind",
      sql`record_kind IN ('log', 'span', 'both')`,
    ),
    check(
      "chk_event_schema_status",
      sql`status IN ('active', 'deprecated', 'retired')`,
    ),
  ],
);
