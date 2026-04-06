/**
 * PG (PostgreSQL) 팩토리 — DATABASE_URL 환경변수 필요.
 * PG 미설정 시 테스트 자동 skip.
 */
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

const DATABASE_URL = process.env.DATABASE_URL;

let db: Db | undefined;

export function hasPgUrl(): boolean {
  return Boolean(DATABASE_URL);
}

function getDb(): Db {
  if (!db && DATABASE_URL) {
    db = createDb(DATABASE_URL);
  }
  return db!;
}

async function truncate(d: Db, ...tables: string[]) {
  for (const t of tables) {
    await d.execute(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE` as any);
  }
}

export async function createPgRecordStore() {
  const d = getDb();
  // PG event_records에 traces FK 제약 — 테스트용 trace 시딩 포함
  const traceStore = new DrizzleTraceStore(d);
  const recordStore = new DrizzleRecordStore(d);

  // shared test에서 사용하는 traceId 목록을 미리 시드
  const traceIds = ["t1", "t2", "t3"];
  for (const traceId of traceIds) {
    await traceStore.upsert({
      traceId,
      recordCount: 0,
      firstTimestamp: new Date("2026-01-01"),
      lastTimestamp: new Date("2026-01-01"),
    });
  }

  return {
    store: recordStore,
    cleanup: async () => truncate(d, "event_records", "traces"),
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
  const d = getDb();
  return {
    store: new DrizzleKeyObservationStore(d),
    cleanup: async () => truncate(d, "key_observations", "key_observation_prefixes"),
  };
}

export async function createPgSessionStore() {
  const d = getDb();
  return {
    store: new DrizzleSessionStore(d),
    cleanup: async () => truncate(d, "qa_sessions"),
  };
}

export async function createPgVerdictStore() {
  const d = getDb();
  // verdict_reports에 traces FK 제약 — 테스트용 trace 시딩
  const traceStore = new DrizzleTraceStore(d);
  const traceIds = ["t1", "t2"];
  for (const traceId of traceIds) {
    await traceStore.upsert({
      traceId,
      recordCount: 0,
      firstTimestamp: new Date("2026-01-01"),
      lastTimestamp: new Date("2026-01-01"),
    });
  }
  return {
    store: new DrizzleVerdictStore(d),
    cleanup: async () => truncate(d, "verdict_reports", "traces"),
  };
}

export async function createPgGraphStore() {
  const d = getDb();
  // runtime_graphs에 traces FK 제약 — 테스트용 trace 시딩
  const traceStore = new DrizzleTraceStore(d);
  const traceIds = ["t1", "t2"];
  for (const traceId of traceIds) {
    await traceStore.upsert({
      traceId,
      recordCount: 0,
      firstTimestamp: new Date("2026-01-01"),
      lastTimestamp: new Date("2026-01-01"),
    });
  }
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
  // dead_letter_queue에 traces FK 제약 — 테스트용 trace 시딩
  const traceStore = new DrizzleTraceStore(d);
  const traceIds = ["t1", "t2"];
  for (const traceId of traceIds) {
    await traceStore.upsert({
      traceId,
      recordCount: 0,
      firstTimestamp: new Date("2026-01-01"),
      lastTimestamp: new Date("2026-01-01"),
    });
  }
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
}
