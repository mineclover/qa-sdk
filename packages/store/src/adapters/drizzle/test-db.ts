// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { closeClient, createDb, getClient, type Db } from '../../db/client.js';

/** 테스트 DB 스키마의 유일한 출처: 운영과 같은 drizzle 마이그레이션 (수동 DDL 사본 금지) */
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../../drizzle', import.meta.url));

/** 병렬 vitest worker가 같은 DB를 동시에 마이그레이션하지 않도록 잡는 advisory lock 키 */
const MIGRATION_LOCK_KEY = 7_204_301;

let testDb: Db | null = null;
let testDatabaseUrl: string | null = null;
let schemaSetupPromise: Promise<void> | null = null;

export const hasTestDatabaseUrl = Boolean(process.env.DATABASE_URL);

function getTestDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for store integration tests.');
  }

  return databaseUrl;
}

async function ensureSchema(databaseUrl: string) {
  const client = getClient(databaseUrl);
  const lock = await client.reserve();
  try {
    await lock`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`;
    await migrate(createDb(databaseUrl), { migrationsFolder: MIGRATIONS_FOLDER });
  } catch (error) {
    throw new Error(
      '테스트 DB 마이그레이션 실패 — 이전 수동 DDL로 만든 테스트 DB라면 DB를 비우고 다시 실행하세요',
      { cause: error },
    );
  } finally {
    await lock`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
    lock.release();
  }
}

export async function createTestDb() {
  const databaseUrl = getTestDatabaseUrl();

  if (!testDb || testDatabaseUrl !== databaseUrl) {
    testDb = createDb(databaseUrl);
    testDatabaseUrl = databaseUrl;
    schemaSetupPromise = null;
  }

  if (!schemaSetupPromise) {
    schemaSetupPromise = ensureSchema(databaseUrl);
  }

  await schemaSetupPromise;
  return testDb;
}

export async function cleanupDb() {
  const databaseUrl = getTestDatabaseUrl();
  await createTestDb();

  const client = getClient(databaseUrl);
  await client.unsafe(
    'truncate table "insight_labels", "key_observation_prefixes", "key_observations", "dead_letter_queue", "event_records", "runtime_graphs", "verdict_reports", "transmissions", "traces", "qa_sessions" restart identity cascade',
  );
}

export async function closeTestDb() {
  if (!testDatabaseUrl) {
    return;
  }

  const databaseUrl = testDatabaseUrl;
  testDb = null;
  testDatabaseUrl = null;
  schemaSetupPromise = null;
  await closeClient(databaseUrl);
}
