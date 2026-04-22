// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * createPgIngestStores — ingest-server의 PG 어댑터 부팅 헬퍼 (Plan 07d).
 *
 * postgres 연결 + search_path 설정 + Pg* 어댑터 인스턴스화.
 * close 함수 반환 — 호출자가 lifecycle 관리.
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { PgKeyObservationStore } from "./key-observation.adapter.js";
import { PgRecordStore } from "./event-record.adapter.js";

export interface CreatePgIngestStoresOpts {
  /** PG 연결 URL (예: postgres://qa_admin:pw@localhost:5434/qa_sdk) */
  url: string;
  /** schema 이름 — default "ingest" */
  schema?: string;
  /** connection pool 최대 — default 10 */
  poolMax?: number;
}

export interface PgIngestStoreSet {
  db: PostgresJsDatabase;
  recordStore: PgRecordStore;
  keyObservationStore: PgKeyObservationStore;
  /** lifecycle 종료 — 호출자 책임 */
  close(): Promise<void>;
}

export async function createPgIngestStores(
  opts: CreatePgIngestStoresOpts,
): Promise<PgIngestStoreSet> {
  const schema = opts.schema ?? "ingest";
  const sql = postgres(opts.url, {
    max: opts.poolMax ?? 10,
    onnotice: () => {},
  });
  // search_path 설정 — pgSchema("ingest")는 SQL에 schema를 박지만,
  // 다른 동작(예: 프로시저·트랜잭션 초기 쿼리)에서 일관된 search_path 보장.
  await sql`SET search_path TO ${sql(schema)}, public`;

  const db = drizzle({ client: sql });
  return {
    db,
    recordStore: new PgRecordStore(db),
    keyObservationStore: new PgKeyObservationStore(db),
    close: () => sql.end(),
  };
}
