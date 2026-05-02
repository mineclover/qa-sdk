// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * SQLite 드라이버 공용 상수 및 헬퍼.
 *
 * NodeSqliteDriver와 BetterSqliteDriver가 공유한다.
 */
import type { SqlDriver, SqlDialect } from "./sql-store.js";

/** SQLite 공통 dialect 정의 */
export const SQLITE_DIALECT: SqlDialect = {
  name: "sqlite",
  supportsTransaction: true,
  supportsReturning: true,
  supportsJsonType: false,
  supportsUpsert: true,
} as const;

/**
 * BEGIN/COMMIT/ROLLBACK 패턴을 공유하는 트랜잭션 헬퍼.
 *
 * @param exec  raw db.exec() — BEGIN/COMMIT/ROLLBACK 실행용
 * @param self  SqlDriver 인스턴스 — fn(tx)에 전달
 * @param fn    트랜잭션 내부 로직
 */
export async function runTransaction<T>(
  exec: (sql: string) => void,
  self: SqlDriver,
  fn: (tx: SqlDriver) => Promise<T>,
): Promise<T> {
  exec("BEGIN");
  try {
    const result = await fn(self);
    exec("COMMIT");
    return result;
  } catch (err) {
    exec("ROLLBACK");
    throw err;
  }
}
