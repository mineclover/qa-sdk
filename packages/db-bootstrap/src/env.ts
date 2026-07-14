// @def.boundary db-bootstrap
// @def.doc db-bootstrap

/**
 * DB 환경 변수 스키마 — 서비스가 자기 config/env.ts에서 import해 사용.
 *
 * pg-migration-design.md §6 (env 변수)와 동기.
 */

import { z } from 'zod';
import type { PgConfig } from './connection.js';

export const dbEnvSchema = z.object({
  QA_DB_DIALECT: z.enum(['sqlite', 'pg']).default('sqlite'),
  // SQLite (선택)
  QA_SQLITE_PATH: z.string().optional(),
  // PG (QA_DB_DIALECT=pg 시 필수 — parseDbEnv에서 검증)
  QA_PG_HOST: z.string().optional(),
  QA_PG_PORT: z.coerce.number().int().positive().optional(),
  QA_PG_DATABASE: z.string().optional(),
  QA_PG_USER: z.string().optional(),
  QA_PG_PASSWORD: z.string().optional(),
  QA_PG_SCHEMA: z.string().optional(),
  QA_PG_POOL_MAX: z.coerce.number().int().positive().optional(),
  // SIM canary: write/read 분리 URL — createDualConnection 호출 site에서 parsePgUrl로 분해
  SIM_DB_WRITE_URL: z.string().url().optional(),
  SIM_DB_READ_URL: z.string().url().optional(),
});

export type DbEnv = z.infer<typeof dbEnvSchema>;

export type ParsedDbEnv =
  | { dialect: 'sqlite'; sqlitePath?: string }
  | {
      dialect: 'pg';
      pgHost: string;
      pgPort: number;
      pgDatabase: string;
      pgUser: string;
      pgPassword: string;
      pgSchema?: string;
      pgPoolMax?: number;
    };

/**
 * env 객체를 의미적으로 검증해 dialect-discriminated union 반환.
 *
 * dialect=pg일 때 host/port/database/user/password 미완 → 즉시 throw.
 */
export function parseDbEnv(input: Record<string, string | undefined>): ParsedDbEnv {
  const env = dbEnvSchema.parse(input);

  if (env.QA_DB_DIALECT === 'sqlite') {
    return { dialect: 'sqlite', sqlitePath: env.QA_SQLITE_PATH };
  }

  // pg branch — 필수 필드 검증
  const missing: string[] = [];
  if (!env.QA_PG_HOST) missing.push('QA_PG_HOST');
  if (!env.QA_PG_PORT) missing.push('QA_PG_PORT');
  if (!env.QA_PG_DATABASE) missing.push('QA_PG_DATABASE');
  if (!env.QA_PG_USER) missing.push('QA_PG_USER');
  if (!env.QA_PG_PASSWORD) missing.push('QA_PG_PASSWORD');

  if (missing.length > 0) {
    throw new Error(`PG dialect 활성화됐지만 필수 변수 누락: ${missing.join(', ')}`);
  }

  return {
    dialect: 'pg',
    pgHost: env.QA_PG_HOST!,
    pgPort: env.QA_PG_PORT!,
    pgDatabase: env.QA_PG_DATABASE!,
    pgUser: env.QA_PG_USER!,
    pgPassword: env.QA_PG_PASSWORD!,
    pgSchema: env.QA_PG_SCHEMA,
    pgPoolMax: env.QA_PG_POOL_MAX,
  };
}

/**
 * postgres URL → PgConfig 필드 분해.
 *
 * 지원 형식: `postgres://user:password@host[:port]/database`
 * - port 미지정 시 기본 5432
 * - user/password는 percent-decoded
 *
 * createDualConnection 호출 site에서 SIM_DB_WRITE_URL / SIM_DB_READ_URL을
 * PgConfig로 변환할 때 사용한다. dialect 필드는 호출자가 부여.
 */
export function parsePgUrl(url: string): Omit<PgConfig, 'dialect'> {
  const u = new URL(url);
  return {
    pgHost: u.hostname,
    pgPort: Number(u.port || 5432),
    pgDatabase: u.pathname.slice(1),
    pgUser: decodeURIComponent(u.username),
    pgPassword: decodeURIComponent(u.password),
  };
}
