/**
 * Store Factory — STORE_DRIVER 환경변수로 백엔드 선택.
 *
 * - "memory" (기본): InMemory stores (개발/데모)
 * - "pg": Drizzle + PostgreSQL (운영)
 * - "d1": D1/SQLite via SqlDriver (CF Workers / 경량 배포)
 * - "clickhouse": 미구현 (향후)
 */

import type {
  RecordStore, TraceStore, SessionStore, VerdictStore,
  TransmissionStore, GraphStore, ScenarioSpecStore, DlqStore,
  KeyObservationStore,
} from "@qa-sdk/core";

export type StoreDriver = "memory" | "pg" | "d1" | "clickhouse";

export interface StoreSet {
  recordStore: RecordStore;
  traceStore: TraceStore;
  sessionStore: SessionStore;
  verdictStore: VerdictStore;
  transmissionStore: TransmissionStore;
  graphStore: GraphStore;
  scenarioSpecStore: ScenarioSpecStore;
  dlqStore: DlqStore;
  keyObservationStore?: KeyObservationStore;
  /** PG의 경우 Drizzle DB 인스턴스 (트랜잭션용) */
  db?: unknown;
}

/** InMemory stores 생성 (항상 사용 가능, dynamic import 불필요) */
export async function createMemoryStores(): Promise<StoreSet> {
  const {
    InMemoryRecordStore,
    InMemoryTraceStore,
    InMemorySessionStore,
    InMemoryVerdictStore,
    InMemoryTransmissionStore,
    InMemoryGraphStore,
    InMemoryScenarioSpecStore,
    InMemoryDlqStore,
  } = await import("@qa-sdk/store");

  return {
    recordStore: new InMemoryRecordStore(),
    traceStore: new InMemoryTraceStore(),
    sessionStore: new InMemorySessionStore(),
    verdictStore: new InMemoryVerdictStore(),
    transmissionStore: new InMemoryTransmissionStore(),
    graphStore: new InMemoryGraphStore(),
    scenarioSpecStore: new InMemoryScenarioSpecStore(),
    dlqStore: new InMemoryDlqStore(),
  };
}

/** D1/SQLite stores 생성 — SqlDriver.$client에서 drizzle 인스턴스를 만들어 주입 */
export async function createD1Stores(driver: import("index-meta").SqlDriver): Promise<StoreSet> {
  const { createD1Drizzle } = await import("./d1-db-type.js");
  const db = createD1Drizzle((driver as unknown as { $client: unknown }).$client);
  const { D1RecordStore } = await import("./d1-record-store.js");
  const { D1TraceStore } = await import("./d1-trace-store.js");
  const { D1SessionStore } = await import("./d1-session-store.js");
  const { D1VerdictStore } = await import("./d1-verdict-store.js");
  const { D1KeyObservationStore } = await import("./d1-key-observation-store.js");
  const { D1GraphStore } = await import("./d1-graph-store.js");
  const { D1ScenarioSpecStore } = await import("./d1-scenario-spec-store.js");
  // 부가 stores는 InMemory 사용 (D1 구현 후순위)
  const {
    InMemoryTransmissionStore,
    InMemoryDlqStore,
  } = await import("@qa-sdk/store");

  return {
    recordStore: new D1RecordStore(db),
    traceStore: new D1TraceStore(db),
    sessionStore: new D1SessionStore(db),
    verdictStore: new D1VerdictStore(db),
    keyObservationStore: new D1KeyObservationStore(db),
    transmissionStore: new InMemoryTransmissionStore(),
    graphStore: new D1GraphStore(db),
    scenarioSpecStore: new D1ScenarioSpecStore(db),
    dlqStore: new InMemoryDlqStore(),
  };
}

/** PostgreSQL stores 생성 */
export async function createPgStores(databaseUrl: string): Promise<StoreSet> {
  const store = await import("@qa-sdk/store");
  const db = store.createDb(databaseUrl);

  return {
    recordStore: new store.DrizzleRecordStore(db),
    traceStore: new store.DrizzleTraceStore(db),
    sessionStore: new store.DrizzleSessionStore(db),
    verdictStore: new store.DrizzleVerdictStore(db),
    transmissionStore: new store.DrizzleTransmissionStore(db),
    graphStore: new store.DrizzleGraphStore(db),
    scenarioSpecStore: new store.DrizzleScenarioSpecStore(db),
    dlqStore: new store.DrizzleDlqStore(db),
    db,
  };
}

/** ClickHouse stores 생성 */
export async function createClickHouseStores(client: import("./clickhouse-record-store.js").ClickHouseClient): Promise<StoreSet> {
  const { ClickhouseRecordStore } = await import("./clickhouse-record-store.js");
  // 부가 stores는 InMemory 사용 (ClickHouse 구현 후순위)
  const {
    InMemoryTraceStore,
    InMemorySessionStore,
    InMemoryVerdictStore,
    InMemoryTransmissionStore,
    InMemoryGraphStore,
    InMemoryScenarioSpecStore,
    InMemoryDlqStore,
  } = await import("@qa-sdk/store");

  return {
    recordStore: new ClickhouseRecordStore(client),
    traceStore: new InMemoryTraceStore(),
    sessionStore: new InMemorySessionStore(),
    verdictStore: new InMemoryVerdictStore(),
    transmissionStore: new InMemoryTransmissionStore(),
    graphStore: new InMemoryGraphStore(),
    scenarioSpecStore: new InMemoryScenarioSpecStore(),
    dlqStore: new InMemoryDlqStore(),
  };
}

/** STORE_DRIVER + 환경 기반 자동 생성 */
export async function createStores(opts: {
  driver: StoreDriver;
  databaseUrl?: string;
  sqliteDriver?: import("index-meta").SqlDriver;
  clickhouseClient?: import("./clickhouse-record-store.js").ClickHouseClient;
}): Promise<StoreSet> {
  switch (opts.driver) {
    case "pg": {
      if (!opts.databaseUrl) throw new Error("STORE_DRIVER=pg requires TRACE_DATABASE_URL");
      return createPgStores(opts.databaseUrl);
    }
    case "d1": {
      if (!opts.sqliteDriver) throw new Error("STORE_DRIVER=d1 requires SqlDriver instance");
      return createD1Stores(opts.sqliteDriver);
    }
    case "clickhouse": {
      if (!opts.clickhouseClient) throw new Error("STORE_DRIVER=clickhouse requires ClickHouseClient instance");
      return createClickHouseStores(opts.clickhouseClient);
    }
    case "memory":
    default:
      return createMemoryStores();
  }
}
