/**
 * DKG State Store — Drizzle ORM 스키마.
 *
 * 5개 테이블: dkg_nodes, dkg_edges, usage_snapshots, version_usages, dkg_meta
 * node:sqlite 기반. ~/.qa-sdk/state.sqlite 에 저장.
 */

import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ═══════════════════════════════════════════════════════
//  DKG 노드
// ═══════════════════════════════════════════════════════

export const dkgNodes = sqliteTable(
  "dkg_nodes",
  {
    id: text("id").notNull().primaryKey(),
    kind: text("kind").notNull(),
    source: text("source").notNull().default("bootstrap"), // bootstrap | manual | auto
    catalogId: text("catalog_id").notNull().default("demo"),
    data: text("data").notNull(), // JSON
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_dkg_nodes_kind").on(table.kind),
    index("idx_dkg_nodes_source").on(table.source),
    index("idx_dkg_nodes_catalog").on(table.catalogId),
  ],
);

export type DkgNodeRow = typeof dkgNodes.$inferSelect;

// ═══════════════════════════════════════════════════════
//  DKG 엣지
// ═══════════════════════════════════════════════════════

export const dkgEdges = sqliteTable(
  "dkg_edges",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    fromId: text("from_id").notNull(),
    toId: text("to_id").notNull(),
    source: text("source").notNull().default("bootstrap"), // bootstrap | manual | auto
    catalogId: text("catalog_id").notNull().default("demo"),
    meta: text("meta"), // JSON (nullable)
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_dkg_edges_from").on(table.fromId, table.type),
    index("idx_dkg_edges_to").on(table.toId, table.type),
    uniqueIndex("idx_dkg_edges_unique").on(table.type, table.fromId, table.toId),
    index("idx_dkg_edges_catalog").on(table.catalogId),
  ],
);

export type DkgEdgeRow = typeof dkgEdges.$inferSelect;

// ═══════════════════════════════════════════════════════
//  UsageData 스냅샷 — 집계 결과 영속화
// ═══════════════════════════════════════════════════════

export const usageSnapshots = sqliteTable("usage_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  collectedAt: text("collected_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  periodFrom: text("period_from").notNull(),
  periodTo: text("period_to").notNull(),
  totalRecords: integer("total_records").notNull().default(0),
  data: text("data").notNull(), // JSON (full UsageData)
});

// ═══════════════════════════════════════════════════════
//  VersionUsage 히스토리 — 배포 스큐 추적
// ═══════════════════════════════════════════════════════

export const versionUsages = sqliteTable(
  "version_usages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    snapshotId: integer("snapshot_id")
      .notNull()
      .references(() => usageSnapshots.id),
    prefix: text("prefix").notNull(),
    version: text("version").notNull(),
    count: integer("count").notNull(),
    lastSeen: text("last_seen").notNull(),
    sessions: text("sessions").notNull(), // JSON array
  },
  (table) => [
    index("idx_version_usages_prefix").on(table.prefix, table.version),
    index("idx_version_usages_snapshot").on(table.snapshotId),
  ],
);

// ═══════════════════════════════════════════════════════
//  CLI Audit Events — EventRecord 기반 로컬 감사 로그
// ═══════════════════════════════════════════════════════

export const cliAuditEvents = sqliteTable(
  "cli_audit_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    catalogId: text("catalog_id").notNull().default("demo"),
    eventPrefix: text("event_prefix"),
    command: text("command"),
    eventKey: text("event_key").notNull(),
    eventVersion: text("event_version").notNull(),
    recordKind: text("record_kind").notNull().default("log"),
    logId: text("log_id").notNull(),
    traceId: text("trace_id").notNull(),
    spanId: text("span_id").notNull(),
    qaSessionId: text("qa_session_id"),
    targetId: text("target_id"),
    targetKind: text("target_kind"),
    lifecycleFrom: text("lifecycle_from"),
    lifecycleTo: text("lifecycle_to"),
    timestamp: text("timestamp").notNull(),
    addressContext: text("address_context"),
    payload: text("payload"),
    recordJson: text("record_json").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_cli_audit_catalog").on(table.catalogId),
    index("idx_cli_audit_prefix").on(table.eventPrefix),
    index("idx_cli_audit_command").on(table.command),
    index("idx_cli_audit_target").on(table.targetId, table.targetKind),
    index("idx_cli_audit_lifecycle").on(table.lifecycleTo),
    index("idx_cli_audit_timestamp").on(table.timestamp),
  ],
);

// ═══════════════════════════════════════════════════════
//  메타데이터
// ═══════════════════════════════════════════════════════

export const dkgMeta = sqliteTable("dkg_meta", {
  key: text("key").notNull().primaryKey(),
  value: text("value").notNull(),
});
