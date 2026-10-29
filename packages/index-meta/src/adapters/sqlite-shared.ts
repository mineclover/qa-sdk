// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * SQLite 드라이버 공용 상수 및 헬퍼.
 *
 * NodeSqliteDriver와 BetterSqliteDriver가 공유한다.
 */
import type { SqlDriver, SqlDialect } from './sql-store.js';

/** SQLite 공통 dialect 정의 */
export const SQLITE_DIALECT: SqlDialect = {
  name: 'sqlite',
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
  exec('BEGIN');
  try {
    const result = await fn(self);
    exec('COMMIT');
    return result;
  } catch (err) {
    exec('ROLLBACK');
    throw err;
  }
}

/**
 * capacity 계열 컬럼 읽기 — 값은 JS number(double)로 써서 저장했으므로 REAL로 읽어 같은 double을 되돌린다.
 *
 * INTEGER로 읽으면 node:sqlite가 2^53을 넘는 값에서 RangeError를 던진다. 그러면 overflow draft
 * (release에서 OVERFLOW로 막아야 하는 정상 상태)를 읽는 모든 경로가 500이 된다.
 * 안전한 정수 범위에서는 INTEGER로 읽은 값과 같다.
 */
export function realColumn(column: string): string {
  return `CAST(${column} AS REAL) AS ${column}`;
}
