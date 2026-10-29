// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * createSqliteDriver — 런타임 환경에 맞는 SQLite 드라이버 팩토리
 *
 * 드라이버 종류와 저장 경로를 분리하여 서비스별 독립 DB를 보장한다.
 *
 * | driver  | 백엔드          | 용도                       |
 * |---------|-----------------|----------------------------|
 * | node    | node:sqlite     | 로컬 개발, CI 테스트        |
 * | better  | better-sqlite3  | 프로덕션 Node.js 서버       |
 *
 * D1은 Cloudflare Workers 전용이므로 이 팩토리 대상이 아니다.
 */

import type { SqlDriver } from './sql-store.js';

export type SqliteDriverType = 'node' | 'better';

export interface CreateSqliteDriverOptions {
  /** 드라이버 종류. 기본 `"node"`. */
  driver?: SqliteDriverType;
  /** SQLite 파일 경로. 기본 `":memory:"`. */
  path?: string;
  /** 초기 DDL. 생략 시 index-meta 전체 스키마, `null`이면 bare driver. */
  schema?: string | null;
}

export async function createSqliteDriver(
  options: CreateSqliteDriverOptions = {},
): Promise<SqlDriver> {
  const { driver = 'node', path = ':memory:', schema } = options;

  switch (driver) {
    case 'node': {
      const { NodeSqliteDriver } = await import('./node-sqlite-driver.js');
      return new NodeSqliteDriver(path, schema);
    }
    case 'better': {
      const { BetterSqliteDriver } = await import('./better-sqlite-driver.js');
      return new BetterSqliteDriver(path, schema);
    }
    default:
      throw new Error(`Unknown SQLite driver type: "${driver}"`);
  }
}
