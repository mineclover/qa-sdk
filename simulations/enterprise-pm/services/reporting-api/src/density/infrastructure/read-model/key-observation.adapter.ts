// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

/**
 * KeyObservationQueryPort 어댑터 — ingest 도메인의 key_observations 를 조회.
 *
 * Plan 07b PG schema column: prefix_id, version, address, packed_key, count, ...
 * 본 어댑터는 address 컬럼을 packed_key 로 노출 — decode 대상은 정수 주소이므로.
 *
 * Plan 14b 의 통합 smoke 에서 실 PG 통합 검증.
 */

import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import {
  KeyObservationQueryPort,
  type KeyObservationRow,
} from "../../application/ports/key-observation.query.port.js";

export interface PgIngestStoreOpts {
  readonly dialect: "pg";
  readonly db: PostgresJsDatabase;
}

export interface SqliteIngestStoreOpts {
  readonly dialect: "sqlite";
  readonly db: BetterSQLite3Database;
}

export type KeyObservationStoreOpts = PgIngestStoreOpts | SqliteIngestStoreOpts;

class PgKeyObservationAdapter extends KeyObservationQueryPort {
  constructor(private readonly db: PostgresJsDatabase) {
    super();
  }
  async listObservations(args: {
    prefix_id: string;
    version: string;
  }): Promise<KeyObservationRow[]> {
    const rows = (await this.db.execute(sql`
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
  }
}

class SqliteKeyObservationAdapter extends KeyObservationQueryPort {
  constructor(private readonly db: BetterSQLite3Database) {
    super();
  }
  async listObservations(args: {
    prefix_id: string;
    version: string;
  }): Promise<KeyObservationRow[]> {
    const rows = (await this.db.all(sql`
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
  }
}

class InMemoryKeyObservationAdapter extends KeyObservationQueryPort {
  constructor(private readonly seed: readonly KeyObservationRow[]) {
    super();
  }
  async listObservations(args: {
    prefix_id: string;
    version: string;
  }): Promise<KeyObservationRow[]> {
    return this.seed.filter(
      (r) => r.prefix_id === args.prefix_id && r.version === args.version,
    );
  }
}

export function createKeyObservationQueryAdapter(
  opts: KeyObservationStoreOpts,
): KeyObservationQueryPort {
  if (opts.dialect === "pg") return new PgKeyObservationAdapter(opts.db);
  if (opts.dialect === "sqlite") return new SqliteKeyObservationAdapter(opts.db);
  throw new Error(
    `createKeyObservationQueryAdapter: unsupported dialect=${(opts as { dialect: string }).dialect}`,
  );
}

/**
 * 테스트 / in-process 실행용 — 메모리 fixture.
 * ingest-server PG 연결이 불가능한 환경에서 density endpoint 의 부팅만 보장.
 */
export function createInMemoryKeyObservationAdapter(
  seed: readonly KeyObservationRow[] = [],
): KeyObservationQueryPort {
  return new InMemoryKeyObservationAdapter(seed);
}
