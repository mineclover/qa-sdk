// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

/**
 * ingest.key_observations 테이블을 Drizzle로 직접 조회하는 KeyObservationStore 구현.
 *
 * Plan 07b PG schema column: prefix_id, version, address, packed_key, count, ...
 * 본 plan 14a는 address/packed_key 중 address를 packed_key로 노출 — decode 대상은
 * MarginalDensityService가 DisjointUnionIndex에 넘기는 정수 주소이므로 address 컬럼을 사용.
 * (packed_key는 TEXT prefix#version#address 형태 — 본 density 계산에는 불필요)
 *
 * Plan 14b의 통합 smoke에서 실 PG 통합 검증.
 */

import { and, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type {
  KeyObservationRow,
  KeyObservationStore,
} from "./density.service.js";

export interface PgIngestStoreOpts {
  dialect: "pg";
  db: PostgresJsDatabase;
}

export interface SqliteIngestStoreOpts {
  dialect: "sqlite";
  db: BetterSQLite3Database;
}

export type IngestStoreOpts = PgIngestStoreOpts | SqliteIngestStoreOpts;

/** ingest.key_observations (PG) 조회 어댑터. */
function createPgStore(db: PostgresJsDatabase): KeyObservationStore {
  return {
    async listObservations(args) {
      // drizzle-orm의 raw sql로 address(정수) 조회. prefix_id/version 필터링.
      const rows = (await db.execute(sql`
        SELECT prefix_id, version, address, count
        FROM ingest.key_observations
        WHERE prefix_id = ${args.prefix_id}
          AND version = ${args.version}
      `)) as unknown as Array<{
        prefix_id: string;
        version: string;
        address: number | string;
        count: number | string;
      }>;
      return rows.map<KeyObservationRow>((r) => ({
        prefix_id: r.prefix_id,
        version: r.version,
        packed_key: Number(r.address),
        count: Number(r.count),
      }));
    },
  };
}

/** key_observations (SQLite — ingest-server 기본) 조회 어댑터. */
function createSqliteStore(db: BetterSQLite3Database): KeyObservationStore {
  return {
    async listObservations(args) {
      const rows = (await db.all(sql`
        SELECT prefix_id, version, address, count
        FROM key_observations
        WHERE prefix_id = ${args.prefix_id}
          AND version = ${args.version}
      `)) as unknown as Array<{
        prefix_id: string;
        version: string;
        address: number;
        count: number;
      }>;
      return rows.map<KeyObservationRow>((r) => ({
        prefix_id: r.prefix_id,
        version: r.version,
        packed_key: Number(r.address),
        count: Number(r.count),
      }));
    },
  };
}

export function createKeyObservationStore(
  opts: IngestStoreOpts,
): KeyObservationStore {
  if (opts.dialect === "pg") return createPgStore(opts.db);
  if (opts.dialect === "sqlite") return createSqliteStore(opts.db);
  throw new Error(
    `createKeyObservationStore: unsupported dialect=${(opts as { dialect: string }).dialect}`,
  );
}

/**
 * 테스트 / 시뮬 in-process 실행용 — 메모리 fixture.
 * ingest-server PG 연결이 불가능한 환경에서 density endpoint의 부팅만 보장.
 */
export function createInMemoryKeyObservationStore(
  seed: readonly KeyObservationRow[] = [],
): KeyObservationStore {
  const rows = [...seed];
  return {
    async listObservations(args) {
      return rows.filter(
        (r) => r.prefix_id === args.prefix_id && r.version === args.version,
      );
    },
  };
}

// and/eq는 현재 drizzle 직접 쿼리 대신 raw sql을 쓰고 있어 미사용 —
// 향후 타입 세이프 쿼리로 전환할 때 사용.
void and;
void eq;
