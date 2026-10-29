// @def.boundary ingest-system
// @def.doc ingest-system

import { afterEach, describe, expect, it, vi } from 'vitest';
import { envSchema, resolveStoreDriver } from './env.js';

describe('parseEnv', { timeout: 15_000 }, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('treats blank optional vars as undefined', async () => {
    vi.stubEnv('TRACE_DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/qa_sdk');

    const { parseEnv } = await import('./env.js');
    const env = parseEnv({
      REGISTRY_URL: '   ',
      TRACE_DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/qa_sdk',
    });

    expect(env.CLEANUP_CRON_ENABLED).toBe(false);
    expect(env.TASK_QUEUE_ENABLED).toBe(false);
    // blank → emptyStringToUndefined → default fallback
    expect(env.REGISTRY_URL).toBe('http://localhost:3300');
    expect(env.REDIS_URL).toBeUndefined();
    expect(env.WORKER_CONCURRENCY).toBe(5);
  });

  it('parses CLEANUP_CRON_ENABLED from string booleans', async () => {
    vi.stubEnv('TRACE_DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/qa_sdk');

    const { parseEnv } = await import('./env.js');

    expect(
      parseEnv({
        CLEANUP_CRON_ENABLED: 'true',
        TRACE_DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/qa_sdk',
      }).CLEANUP_CRON_ENABLED,
    ).toBe(true);
    expect(
      parseEnv({
        CLEANUP_CRON_ENABLED: 'false',
        TRACE_DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/qa_sdk',
      }).CLEANUP_CRON_ENABLED,
    ).toBe(false);
  });

  it('requires REDIS_URL when TASK_QUEUE_ENABLED=true', async () => {
    vi.stubEnv('TRACE_DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/qa_sdk');

    const { parseEnv } = await import('./env.js');

    expect(() =>
      parseEnv({
        TASK_QUEUE_ENABLED: 'true',
        TRACE_DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/qa_sdk',
      }),
    ).toThrow();
  });

  it('accepts REDIS_URL when TASK_QUEUE_ENABLED=true', async () => {
    vi.stubEnv('TRACE_DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/qa_sdk');

    const { parseEnv } = await import('./env.js');

    expect(
      parseEnv({
        TASK_QUEUE_ENABLED: 'true',
        REDIS_URL: 'redis://localhost:6379/0',
        TRACE_DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/qa_sdk',
      }).REDIS_URL,
    ).toBe('redis://localhost:6379/0');
  });
});

describe('ServiceProfile ingestServer.dialect 매핑 (Plan 07d)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('dialect=pg + pgUrl + pgSchema 세트', () => {
    // envSchema가 QA_PG_SCHEMA 기본값 "ingest"를 주고,
    // loadProfileDefaults는 STORE_DRIVER/TRACE_DATABASE_URL 셋팅.
    // 본 테스트는 envSchema 직접 parse로 결과 확인.
    const env = envSchema.parse({
      STORE_DRIVER: 'pg',
      TRACE_DATABASE_URL: 'postgres://u:p@localhost:5434/qa_sdk',
      QA_PG_SCHEMA: 'ingest',
    });
    expect(env.STORE_DRIVER).toBe('pg');
    expect(env.TRACE_DATABASE_URL).toBe('postgres://u:p@localhost:5434/qa_sdk');
    expect(env.QA_PG_SCHEMA).toBe('ingest');
  });

  it('dialect=sqlite 매핑', () => {
    const env = envSchema.parse({
      STORE_DRIVER: 'sqlite',
      SQLITE_PATH: '/tmp/foo.db',
    });
    expect(env.STORE_DRIVER).toBe('sqlite');
  });
});

describe('STORE_DRIVER alias — d1 → sqlite (Plan 07a 옵션 A)', () => {
  it('d1은 sqlite로 매핑', () => {
    const env = envSchema.parse({ STORE_DRIVER: 'd1' });
    expect(resolveStoreDriver(env)).toBe('sqlite');
  });

  it('sqlite는 그대로', () => {
    const env = envSchema.parse({ STORE_DRIVER: 'sqlite' });
    expect(resolveStoreDriver(env)).toBe('sqlite');
  });

  it('pg는 그대로', () => {
    const env = envSchema.parse({ STORE_DRIVER: 'pg' });
    expect(resolveStoreDriver(env)).toBe('pg');
  });

  it('QA_PG_SCHEMA default', () => {
    const env = envSchema.parse({});
    expect(env.QA_PG_SCHEMA).toBe('ingest');
  });
});

describe('제거된 환경변수 (X-12, D-4)', () => {
  it('소비처 없는 키는 스키마에 없다', () => {
    const shape = envSchema._def.schema.shape as Record<string, unknown>;
    for (const key of [
      'TRANSITION_VIOLATION_MODE',
      'TRANSITION_STATE_PATH',
      'CONVERGENCE_FLUSH_INTERVAL_MS',
    ]) {
      expect(shape).not.toHaveProperty(key);
    }
  });
});
