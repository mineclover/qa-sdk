/**
 * SQLite 마이그레이션 실행기.
 *
 * schema_version 테이블에서 현재 버전 조회 → 미적용 마이그레이션 순차 실행.
 * ALTER TABLE 실패는 무시 (이미 적용된 경우).
 */

import type { REGISTRY_MIGRATIONS } from "./schema.sql.js";

export interface MigrationDriver {
  execute(sql: string): void;
  get<T = unknown>(sql: string): T | undefined;
}

export function runMigrations(
  driver: MigrationDriver,
  migrations: typeof REGISTRY_MIGRATIONS,
  logger?: { info(msg: string, data?: unknown): void },
): void {
  // 현재 버전 조회
  let currentVersion = 0;
  try {
    const row = driver.get<{ version: number }>(
      "SELECT MAX(version) as version FROM schema_version",
    );
    if (row?.version) currentVersion = row.version;
  } catch {
    // schema_version 테이블 없으면 0
  }

  const pending = migrations.filter(m => m.version > currentVersion && m.sql);
  if (pending.length === 0) return;

  for (const m of pending) {
    try {
      // 각 SQL 문을 개별 실행 (ALTER TABLE은 세미콜론 분리 불가할 수 있음)
      for (const stmt of m.sql.split(";").map(s => s.trim()).filter(Boolean)) {
        driver.execute(stmt);
      }
      driver.execute(
        `INSERT INTO schema_version (version, applied_at, description) VALUES (${m.version}, '${new Date().toISOString()}', '${m.description}')`,
      );
      logger?.info(`migration v${m.version}: ${m.description}`);
    } catch (err) {
      // duplicate column 등 이미 적용된 경우 무시
      logger?.info(`migration v${m.version} skipped (already applied or no-op)`);
    }
  }
}
