/**
 * Drizzle ORM schema definitions for D1 (SQLite).
 * migrations/0001_create_grants.sql, 0002_create_logs.sql 과 1:1 대응.
 *
 * 런타임 변경 없음 — drizzle-kit generate용 스키마 정의만 포함.
 */
import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core";

// ─── grants ────────────────────────────────────────────────────
export const grants = sqliteTable(
  "grants",
  {
    featureId: text("feature_id").notNull(),
    role: text("role").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.featureId, t.role] }),
  ],
);

// ─── logs ──────────────────────────────────────────────────────
export const logs = sqliteTable(
  "logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ts: text("ts").notNull(),
    level: text("level").notNull(),
    svcAddr: integer("svc_addr").notNull(),
    permAddr: integer("perm_addr"),
    evtAddr: integer("evt_addr"),
    action: text("action").notNull(),
    message: text("message").notNull(),
    latencyMs: integer("latency_ms").notNull().default(0),
    userId: text("user_id").notNull(),
  },
  (t) => [
    index("idx_logs_ts").on(t.ts),
    index("idx_logs_level").on(t.level),
    index("idx_logs_svc_addr").on(t.svcAddr),
  ],
);
