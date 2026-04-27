// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * SQLite schema (role slice). 기존 auth/sqlite/schema.ts 의 roles 테이블과
 * 컬럼셋이 일치한다.
 */
export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  scopeType: text("scope_type", { enum: ["global", "department", "project"] }).notNull(),
  defaultMaskHex: text("default_mask_hex").notNull(),
  createdAt: text("created_at").notNull(),
});

export const SIM_AUTH_ROLE_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','department','project')),
  default_mask_hex TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;
