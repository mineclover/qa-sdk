// @def.boundary db-traffic-control-spec
// @def.doc db-traffic-control-spec
import type { QueryOperation } from './types.js';

/**
 * SQL 쿼리에서 파라미터를 제거하고 정규화된 fingerprint를 생성한다.
 * PlanetScale Insights의 query fingerprint와 동일한 개념.
 *
 * 정규화 규칙:
 * - postgres 바인드 파라미터 ($1, $2, ...) → ?
 * - 문자열 리터럴 ('...') → ?
 * - 숫자 리터럴 → ?
 * - 연속 공백 → 단일 공백
 * - IN (...) 내 다중 ? → IN (?)
 *
 * @example
 * extractFingerprint("SELECT * FROM users WHERE id = $1 AND name = 'alice'")
 * // → "SELECT * FROM users WHERE id = ? AND name = ?"
 */
export function extractFingerprint(sql: string): string {
  return (
    sql
      // 문자열 리터럴 → ? (escaped quote 처리)
      .replace(/'(?:[^'\\]|\\.)*'/g, '?')
      // postgres 파라미터 ($1, $2, ...) → ?
      .replace(/\$\d+/g, '?')
      // 숫자 리터럴 (단어 경계) → ?
      .replace(/\b\d+(?:\.\d+)?\b/g, '?')
      // IN (?, ?, ?, ...) → IN (?)
      .replace(/IN\s*\(\s*\?(?:\s*,\s*\?)*\s*\)/gi, 'IN (?)')
      // 연속 공백 → 단일 공백
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * SQL 문자열에서 operation 종류를 추출한다.
 */
export function extractOperation(sql: string): QueryOperation {
  const first = sql.trimStart().slice(0, 10).toUpperCase();
  if (first.startsWith('SELECT')) return 'select';
  if (first.startsWith('INSERT')) return 'insert';
  if (first.startsWith('UPDATE')) return 'update';
  if (first.startsWith('DELETE')) return 'delete';
  return 'select'; // CTE 등 fallback
}

/**
 * SQL 문자열에서 주 테이블 이름을 추출한다 (best-effort).
 *
 * 지원 패턴:
 * - SELECT ... FROM "table"
 * - INSERT INTO "table"
 * - UPDATE "table"
 * - DELETE FROM "table"
 */
export function extractTable(sql: string): string | undefined {
  const normalized = sql.replace(/\s+/g, ' ').trim();

  // INSERT INTO "table" / INSERT INTO table
  const insertMatch = normalized.match(/INSERT\s+INTO\s+"?(\w+)"?/i);
  if (insertMatch) return insertMatch[1];

  // UPDATE "table" / UPDATE table
  const updateMatch = normalized.match(/UPDATE\s+"?(\w+)"?/i);
  if (updateMatch) return updateMatch[1];

  // DELETE FROM "table" / DELETE FROM table
  const deleteMatch = normalized.match(/DELETE\s+FROM\s+"?(\w+)"?/i);
  if (deleteMatch) return deleteMatch[1];

  // SELECT ... FROM "table" / SELECT ... FROM table
  const selectMatch = normalized.match(/FROM\s+"?(\w+)"?/i);
  if (selectMatch) return selectMatch[1];

  return undefined;
}

/**
 * Drizzle 쿼리 빌더에서 테이블명을 추출한다.
 * otel/drizzle-instrument.ts extractTableName과 동일 패턴.
 */
export function extractTableFromBuilder(builder: Record<string, unknown>): string | undefined {
  // Drizzle 내부: config.table + Symbol("drizzle:Name")
  const table = (builder as Record<string, Record<string, unknown>>).config?.table;
  if (table && typeof table === 'object') {
    const sym = Object.getOwnPropertySymbols(table).find((s) => s.description === 'drizzle:Name');
    if (sym) return String((table as Record<symbol, unknown>)[sym]);
  }

  // fallback: _.tableName
  const tableName = (builder as Record<string, Record<string, unknown>>)._?.tableName;
  if (typeof tableName === 'string') return tableName;

  return undefined;
}
