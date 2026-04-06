// ── DB ──────────────────────────────────────────────────

export { closeClient, createDb, getClient, withTransaction } from "./db/client.js";
export type { Db, DbExecutor, DbTransaction } from "./db/client.js";
export * as schema from "./db/schema.js";

// ── Drizzle Adapters (PostgreSQL) ───────────────────────

export {
  DrizzleRecordStore,
  DrizzleTraceStore,
  DrizzleSessionStore,
  DrizzleTransmissionStore,
  DrizzleGraphStore,
  DrizzleScenarioSpecStore,
  DrizzleVerdictStore,
  DrizzleDlqStore,
  DrizzleKeyObservationStore,
} from "./adapters/drizzle/index.js";

// ── In-Memory Adapters ─────────────────────────────────

export {
  InMemoryRecordStore,
  InMemoryTraceStore,
  InMemorySessionStore,
  InMemoryTransmissionStore,
  InMemoryGraphStore,
  InMemoryScenarioSpecStore,
  InMemoryVerdictStore,
  InMemoryDlqStore,
  InMemoryKeyCache,
  InMemoryAggregator,
} from "./adapters/memory/index.js";

// ── Redis Adapters ────────────────────────────────────

export { RedisKeyCache } from "./adapters/redis/index.js";
