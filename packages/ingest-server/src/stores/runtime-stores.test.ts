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
