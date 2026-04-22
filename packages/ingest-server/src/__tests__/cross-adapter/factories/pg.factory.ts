// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * PG (PostgreSQL) 팩토리 — DATABASE_URL 환경변수 필요.
 * PG 미설정 시 테스트 자동 skip.
 *
 * Plan 07d 변경:
 *   - RecordStore / KeyObservationStore는 ingest-server pg 어댑터(07b/c)로 swap.
 *   - 기타 store(Trace/Session/Verdict/Graph/ScenarioSpec/Transmission/Dlq)는
 *     @qa-sdk/store 그대로 — plan 08에서 점진적 이전.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  DrizzleRecordStore,
  DrizzleTraceStore,
  DrizzleKeyObservationStore,
  DrizzleSessionStore,
  DrizzleVerdictStore,
  DrizzleGraphStore,
  DrizzleScenarioSpecStore,
  DrizzleTransmissionStore,
  DrizzleDlqStore,
  createDb,
  closeClient,
} from "@qa-sdk/store";
import type { Db } from "@qa-sdk/store";

import { PgRecordStore } from "../../../stores/pg/event-record.adapter.js";
import { PgKeyObservationStore } from "../../../stores/pg/key-observation.adapter.js";

const DATABASE_URL = process.env.DATABASE_URL;

let db: Db | undefined;
let ingestSql: ReturnType<typeof postgres> | undefined;

export function hasPgUrl(): boolean {
  return Boolean(DATABASE_URL);
}

function getDb(): Db {
  if (!db && DATABASE_URL) {
    db = createDb(DATABASE_URL);
  }
  return db!;
}

/** ingest schema용 postgres client — lazy 초기화. ingest.* 테이블 대상. */
function getIngestSql(): ReturnType<typeof postgres> {
  if (!ingestSql && DATABASE_URL) {
    ingestSql = postgres(DATABASE_URL, { max: 5, onnotice: () => {} });
  }
  return ingestSql!;
}

async function truncate(d: Db, ...tables: string[]) {
  for (const t of tables) {
    await d.execute(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE` as any);
  }
}

/**
 * ingest schema 테이블 보장 — 첫 호출 시 DDL 적용.
 * 이미 존재하면 skip (IF NOT EXISTS). init.sql로 schema는 사전 생성됨.
 */
let ingestDdlApplied = false;
async function ensureIngestTables() {
  if (ingestDdlApplied) return;
  const { KEY_OBSERVATIONS_PG_DDL, EVENT_RECORDS_PG_DDL } = await import(
    "../../../stores/pg/schema.js"
  );
  const sql = getIngestSql();
  await sql.unsafe(KEY_OBSERVATIONS_PG_DDL);
  await sql.unsafe(EVENT_RECORDS_PG_DDL);
  ingestDdlApplied = true;
}

async function truncateIngest(...tables: string[]) {
  const sql = getIngestSql();
  for (const t of tables) {
    await sql.unsafe(`TRUNCATE TABLE ingest.${t} RESTART IDENTITY CASCADE`);
  }
}

export async function createPgRecordStore() {
  await ensureIngestTables();
  const sql = getIngestSql();
  return {
    store: new PgRecordStore(drizzle({ client: sql })),
    cleanup: async () => truncateIngest("event_records"),
  };
}

export async function createPgTraceStore() {
  const d = getDb();
  return {
    store: new DrizzleTraceStore(d),
    cleanup: async () => truncate(d, "traces"),
  };
}

export async function createPgKeyObservationStore() {
  await ensureIngestTables();
  const sql = getIngestSql();
  return {
    store: new PgKeyObservationStore(drizzle({ client: sql })),
    cleanup: async () =>
      truncateIngest("key_observations", "key_observation_prefixes"),
  };
}

export async function createPgSessionStore() {
  const d = getDb();
  return {
    store: new DrizzleSessionStore(d),
    cleanup: async () => truncate(d, "qa_sessions"),
  };
}

/** FK 제약 테이블용 traces 시딩. 매 factory 호출 시 실행 — beforeEach cleanup 이후에도 안전. */
async function seedTraces(d: Db, ids = ["t1", "t2"]) {
  const traceStore = new DrizzleTraceStore(d);
  for (const traceId of ids) {
    await traceStore.upsert({
      traceId,
      recordCount: 0,
      firstTimestamp: new Date("2026-01-01"),
      lastTimestamp: new Date("2026-01-01"),
    });
  }
}

export async function createPgVerdictStore() {
  const d = getDb();
  await seedTraces(d);
  return {
    store: new DrizzleVerdictStore(d),
    cleanup: async () => truncate(d, "verdict_reports", "traces"),
  };
}

export async function createPgGraphStore() {
  const d = getDb();
  await seedTraces(d);
  return {
    store: new DrizzleGraphStore(d),
    cleanup: async () => truncate(d, "runtime_graphs", "traces"),
  };
}

export async function createPgScenarioSpecStore() {
  const d = getDb();
  return {
    store: new DrizzleScenarioSpecStore(d),
    cleanup: async () => truncate(d, "scenario_specs"),
  };
}

export async function createPgTransmissionStore() {
  const d = getDb();
  return {
    store: new DrizzleTransmissionStore(d),
    cleanup: async () => truncate(d, "transmissions"),
  };
}

export async function createPgDlqStore() {
  const d = getDb();
  await seedTraces(d);
  return {
    store: new DrizzleDlqStore(d),
    cleanup: async () => truncate(d, "dead_letter_queue", "traces"),
  };
}

export async function closePgConnection() {
  if (db && DATABASE_URL) {
    await closeClient(DATABASE_URL);
    db = undefined;
  }
  if (ingestSql) {
    try {
      await ingestSql.end();
    } finally {
      ingestSql = undefined;
      ingestDdlApplied = false;
    }
  }
}
