// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

/**
 * createResourcePolicyRegistry — dialect별 어댑터 인스턴스화 진입점.
 *
 * dynamic import로 드라이버 로드 — 미설치 dialect 분기에 닿지 않으면
 * 본 모듈 import 자체는 실패하지 않는다 (peerDep optional 패턴 동기).
 *
 * 호출자는 db-bootstrap의 createConnection으로 dialect별 Drizzle DB를 만들고,
 * 그 db를 본 factory에 넘겨 어댑터를 받는다.
 */

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import type { ResourcePolicyRegistry } from './port.js';

export type ResourcePolicyDialect = 'sqlite' | 'pg';

export interface CreateRegistryOptions {
  dialect: ResourcePolicyDialect;
  /**
   * Drizzle DB 인스턴스.
   * - dialect="sqlite" → BetterSQLite3Database
   * - dialect="pg"     → PostgresJsDatabase
   * 타입 검증은 어댑터 생성자가 수행 (런타임 cast).
   */
  db: BetterSQLite3Database | PostgresJsDatabase;
}

export async function createResourcePolicyRegistry(
  opts: CreateRegistryOptions,
): Promise<ResourcePolicyRegistry> {
  if (opts.dialect === 'sqlite') {
    const { SqliteResourcePolicyRegistry } = await import('./sqlite/adapter.js');
    return new SqliteResourcePolicyRegistry(opts.db as BetterSQLite3Database);
  }

  if (opts.dialect === 'pg') {
    const { PgResourcePolicyRegistry } = await import('./pg/adapter.js');
    return new PgResourcePolicyRegistry(opts.db as PostgresJsDatabase);
  }

  // 컴파일러는 unreachable로 보지만 런타임 안전망
  throw new Error(
    `createResourcePolicyRegistry: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
