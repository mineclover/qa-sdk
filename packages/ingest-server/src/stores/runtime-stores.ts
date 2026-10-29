// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * server/worker 모드 런타임 store 생성 — STORE_DRIVER 해석의 단일 진입점.
 *
 * - pg: Drizzle + PostgreSQL (TRACE_DATABASE_URL 필수)
 * - 그 외(memory·sqlite·d1·clickhouse): node-sqlite 위의 D1 store.
 *   insights가 같은 SQLite DB를 공유하므로 memory 모드도 `:memory:` SQLite를 우선 쓴다.
 *   - d1: sqlite의 deprecation alias (Plan 07a 옵션 A) → 경고 1회
 *   - clickhouse: server 모드 미지원 → 경고 1회 후 SQLite
 * - SQLite 초기화 실패 시 순수 InMemory로 fallback (insights 비활성)
 *
 * CF Worker 경로(`src/worker.ts`)는 D1 바인딩으로 store를 직접 만들며 이 함수를 쓰지 않는다.
 */

import { withQueryTracing } from '@qa-sdk/otel';
import type {
  DlqStore,
  GraphStore,
  KeyObservationStore,
  RecordStore,
  ScenarioSpecStore,
  SessionStore,
  TraceStore,
  TransmissionStore,
  VerdictStore,
} from '@qa-sdk/core';
import {
  createDb,
  DrizzleDlqStore,
  DrizzleGraphStore,
  DrizzleKeyObservationStore,
  DrizzleRecordStore,
  DrizzleScenarioSpecStore,
  DrizzleSessionStore,
  DrizzleTraceStore,
  DrizzleTransmissionStore,
  DrizzleVerdictStore,
  InMemoryDlqStore,
  InMemoryGraphStore,
  InMemoryRecordStore,
  InMemoryScenarioSpecStore,
  InMemorySessionStore,
  InMemoryTraceStore,
  InMemoryTransmissionStore,
  InMemoryVerdictStore,
} from '@qa-sdk/store';
import type { Logger } from 'pino';
import { resolveStoreDriver, type Env } from '../config/env.js';

export interface RuntimeStores {
  db: ReturnType<typeof createDb> | null;
  /** SQLite 모드 시 drizzle 인스턴스 (InsightsStore 공유용) */
  d1Db?: unknown;
  /** SQLite 모드 시 raw SQL 드라이버 (`/v1/labels` 등 SQL 직접 사용 라우트 공유용) */
  sqlDriver?: import('index-meta-store').SqlDriver;
  dlqStore: DlqStore;
  graphStore: GraphStore;
  /** packed_key 관측 추적 (U-4). InMemory fallback에는 구현이 없어 undefined */
  keyObservationStore?: KeyObservationStore;
  recordStore: RecordStore;
  scenarioSpecStore: ScenarioSpecStore;
  sessionStore: SessionStore;
  traceStore: TraceStore;
  transmissionStore: TransmissionStore;
  verdictStore: VerdictStore;
}

export interface CreateRuntimeStoresOptions {
  env: Pick<Env, 'STORE_DRIVER' | 'SQLITE_PATH' | 'TRACE_DATABASE_URL'>;
  logger: Pick<Logger, 'warn'>;
  /** drizzle SQLite migration 폴더 (번들 위치 기준이므로 호출부가 결정) */
  migrationsFolder: string;
}

export async function createRuntimeStores(
  options: CreateRuntimeStoresOptions,
): Promise<RuntimeStores> {
  const { env, logger, migrationsFolder } = options;
  const driver = resolveStoreDriver(env);

  if (env.STORE_DRIVER === 'd1') {
    logger.warn(
      { driver: env.STORE_DRIVER, resolved: driver },
      'STORE_DRIVER=d1은 deprecated — sqlite로 처리합니다',
    );
  } else if (driver === 'clickhouse') {
    logger.warn({ driver }, 'server 모드는 이 STORE_DRIVER를 지원하지 않아 SQLite를 사용합니다');
  }

  if (driver === 'pg') {
    return createPgStores(env.TRACE_DATABASE_URL);
  }

  try {
    return await createSqliteStores(env.SQLITE_PATH ?? ':memory:', migrationsFolder);
  } catch (err) {
    // SQLite 초기화 실패 → 순수 InMemory fallback (insights 비활성)
    logger.warn({ err }, 'SQLite store 초기화 실패 — InMemory fallback');
    return createMemoryStores();
  }
}

async function createSqliteStores(
  sqlitePath: string,
  migrationsFolder: string,
): Promise<RuntimeStores> {
  const { NodeSqliteDriver } = await import('index-meta-store');
  const { drizzle } = await import('drizzle-orm/node-sqlite');
  const { migrate } = await import('drizzle-orm/node-sqlite/migrator');
  const { createD1Drizzle } = await import('./d1-db-type.js');
  const { D1RecordStore } = await import('./d1-record-store.js');
  const { D1TraceStore } = await import('./d1-trace-store.js');
  const { D1SessionStore } = await import('./d1-session-store.js');
  const { D1VerdictStore } = await import('./d1-verdict-store.js');
  const { D1KeyObservationStore } = await import('./d1-key-observation-store.js');
  const { D1DlqStore } = await import('./d1-dlq-store.js');
  const { D1GraphStore } = await import('./d1-graph-store.js');
  const { D1ScenarioSpecStore } = await import('./d1-scenario-spec-store.js');
  const { D1TransmissionStore } = await import('./d1-transmission-store.js');

  const driver = new NodeSqliteDriver(sqlitePath, null);
  const plainDb = drizzle({ client: driver.$client as import('node:sqlite').DatabaseSync });
  migrate(plainDb, { migrationsFolder });
  const d1Db = createD1Drizzle(driver.$client);
  return {
    db: null,
    d1Db,
    sqlDriver: driver,
    dlqStore: new D1DlqStore(d1Db),
    graphStore: new D1GraphStore(d1Db),
    keyObservationStore: new D1KeyObservationStore(d1Db),
    recordStore: new D1RecordStore(d1Db),
    scenarioSpecStore: new D1ScenarioSpecStore(d1Db),
    sessionStore: new D1SessionStore(d1Db),
    traceStore: new D1TraceStore(d1Db),
    transmissionStore: new D1TransmissionStore(d1Db),
    verdictStore: new D1VerdictStore(d1Db),
  };
}

function createMemoryStores(): RuntimeStores {
  return {
    db: null,
    dlqStore: new InMemoryDlqStore(),
    graphStore: new InMemoryGraphStore(),
    recordStore: new InMemoryRecordStore(),
    scenarioSpecStore: new InMemoryScenarioSpecStore(),
    sessionStore: new InMemorySessionStore(),
    traceStore: new InMemoryTraceStore(),
    transmissionStore: new InMemoryTransmissionStore(),
    verdictStore: new InMemoryVerdictStore(),
  };
}

function createPgStores(databaseUrl: string | undefined): RuntimeStores {
  if (!databaseUrl) {
    throw new Error('STORE_DRIVER=pg requires TRACE_DATABASE_URL');
  }
  const db = withQueryTracing(createDb(databaseUrl));
  return {
    db,
    dlqStore: new DrizzleDlqStore(db),
    graphStore: new DrizzleGraphStore(db),
    keyObservationStore: new DrizzleKeyObservationStore(db),
    recordStore: new DrizzleRecordStore(db),
    scenarioSpecStore: new DrizzleScenarioSpecStore(db),
    sessionStore: new DrizzleSessionStore(db),
    traceStore: new DrizzleTraceStore(db),
    transmissionStore: new DrizzleTransmissionStore(db),
    verdictStore: new DrizzleVerdictStore(db),
  };
}
