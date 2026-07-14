// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

/**
 * SQLite schema (user slice).
 *
 * 컨벤션:
 *   - 테이블 `users` — 기존 auth/sqlite/schema.ts 의 컬럼셋과 동일.
 *   - DDL 은 auth-db.module 에서 SIM_AUTH_SQLITE_DDL 로 이미 적용되므로
 *     본 슬라이스는 별도 DDL 을 노출하지 않는다 (idempotent CREATE).
 */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    displayName: text('display_name').notNull(),
    departmentId: text('department_id'),
    primaryRoleId: text('primary_role_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_users_dept').on(t.departmentId)],
);

/**
 * 슬라이스 내부 테스트용 DDL (in-memory sqlite). 운영 부팅은 auth-db.module 의
 * SIM_AUTH_SQLITE_DDL 가 동등 정의를 적용한다.
 */
export const SIM_AUTH_USER_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  department_id TEXT,
  primary_role_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_dept ON users(department_id);
`;
