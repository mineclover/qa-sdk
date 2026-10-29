import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryRecordStore } from '@qa-sdk/store';
import { createRuntimeStores } from './runtime-stores.js';
import { D1RecordStore } from './d1-record-store.js';
import { D1VerdictStore } from './d1-verdict-store.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

function createLogger() {
  return { warn: vi.fn() };
}

describe('createRuntimeStores', () => {
  it('SQLite 모드는 마이그레이션된 테이블 위의 key observation store를 제공한다 (U-4)', async () => {
    const stores = await createRuntimeStores({
      env: { STORE_DRIVER: 'sqlite', SQLITE_PATH: undefined, TRACE_DATABASE_URL: undefined },
      logger: createLogger(),
      migrationsFolder,
    });
    const store = stores.keyObservationStore!;
    await store.observeBatch([
      {
        packedKey: 'service:v1:3',
        prefixId: 'service',
        version: 'v1',
        address: 3,
        registered: false,
        timestamp: '2026-10-29T00:00:00.000Z',
      },
    ]);
    expect(await store.summary()).toMatchObject({ totalKeys: 1, unregisteredKeys: 1 });
    expect((await store.findUnregistered()).map((o) => o.packedKey)).toEqual(['service:v1:3']);
  });

  it.each(['memory', 'sqlite'] as const)(
    'STORE_DRIVER=%s → 경고 없이 SQLite(D1) store',
    async (driver) => {
      const logger = createLogger();
      const stores = await createRuntimeStores({
        env: { STORE_DRIVER: driver, SQLITE_PATH: undefined, TRACE_DATABASE_URL: undefined },
        logger,
        migrationsFolder,
      });
      expect(stores.recordStore).toBeInstanceOf(D1RecordStore);
      expect(stores.verdictStore).toBeInstanceOf(D1VerdictStore);
      expect(stores.d1Db).toBeDefined();
      expect(stores.db).toBeNull();
      expect(logger.warn).not.toHaveBeenCalled();
    },
  );

  it('SQLite 모드는 DLQ·graph·scenario spec을 파일에 저장해 재시작 후에도 유지한다 (S-6)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ingest-runtime-stores-'));
    const env = {
      STORE_DRIVER: 'sqlite' as const,
      SQLITE_PATH: join(dir, 'ingest.sqlite'),
      TRACE_DATABASE_URL: undefined,
    };
    try {
      const first = await createRuntimeStores({ env, logger: createLogger(), migrationsFolder });
      await first.dlqStore.insert({
        id: 'dlq-1',
        traceId: 'trace-1',
        phase: 'verdict',
        errorMessage: 'boom',
      });
      await first.graphStore.upsert('trace-1', { trace_id: 'trace-1', nodes: [], edges: [] });
      await first.scenarioSpecStore.upsert({
        scenario_id: 'checkout',
        version: '1',
        domain: 'shop',
        steps: [],
      });

      const restarted = await createRuntimeStores({
        env,
        logger: createLogger(),
        migrationsFolder,
      });
      expect((await restarted.dlqStore.findPending()).map((item) => item.id)).toEqual(['dlq-1']);
      expect(await restarted.graphStore.findByTraceId('trace-1')).toMatchObject({
        trace_id: 'trace-1',
      });
      expect(await restarted.scenarioSpecStore.findById('checkout')).not.toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('STORE_DRIVER=clickhouse → 경고 1회 + SQLite store', async () => {
    const logger = createLogger();
    const stores = await createRuntimeStores({
      env: { STORE_DRIVER: 'clickhouse', SQLITE_PATH: undefined, TRACE_DATABASE_URL: undefined },
      logger,
      migrationsFolder,
    });
    expect(stores.recordStore).toBeInstanceOf(D1RecordStore);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      { driver: 'clickhouse' },
      'server 모드는 이 STORE_DRIVER를 지원하지 않아 SQLite를 사용합니다',
    );
  });

  it('STORE_DRIVER=d1 → deprecation 경고 1회 + SQLite store', async () => {
    const logger = createLogger();
    const stores = await createRuntimeStores({
      env: { STORE_DRIVER: 'd1', SQLITE_PATH: undefined, TRACE_DATABASE_URL: undefined },
      logger,
      migrationsFolder,
    });
    expect(stores.recordStore).toBeInstanceOf(D1RecordStore);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      { driver: 'd1', resolved: 'sqlite' },
      expect.stringContaining('deprecated'),
    );
  });

  it('SQLite 초기화 실패 → 경고 + InMemory fallback', async () => {
    const logger = createLogger();
    const stores = await createRuntimeStores({
      env: { STORE_DRIVER: 'memory', SQLITE_PATH: undefined, TRACE_DATABASE_URL: undefined },
      logger,
      migrationsFolder: '/nonexistent/migrations',
    });
    expect(stores.recordStore).toBeInstanceOf(InMemoryRecordStore);
    expect(stores.d1Db).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      'SQLite store 초기화 실패 — InMemory fallback',
    );
  });

  it('STORE_DRIVER=pg + TRACE_DATABASE_URL 미설정 → 오류', async () => {
    await expect(
      createRuntimeStores({
        env: { STORE_DRIVER: 'pg', SQLITE_PATH: undefined, TRACE_DATABASE_URL: undefined },
        logger: createLogger(),
        migrationsFolder,
      }),
    ).rejects.toThrow('STORE_DRIVER=pg requires TRACE_DATABASE_URL');
  });
});
