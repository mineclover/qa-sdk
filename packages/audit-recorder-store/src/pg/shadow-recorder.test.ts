import { describe, expect, it, vi } from 'vitest';
import { PgRlsShadowRecorder } from './shadow-recorder.js';

function fakeSql(successful = true) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const fn = vi.fn(async (sqlStr: string, params: unknown[]) => {
    calls.push({ sql: sqlStr, params });
    if (!successful) throw new Error('simulated PG error');
    return [];
  });
  return Object.assign(fn, { unsafe: fn, calls });
}

describe('PgRlsShadowRecorder', () => {
  it('fire-and-forget INSERT — record 호출은 sync 리턴', async () => {
    const sql = fakeSql(true);
    const logger = { error: vi.fn() };
    const recorder = new PgRlsShadowRecorder(sql as never, logger, 't.shadow');
    recorder.record({
      userId: 'alice',
      tenantId: null,
      resourceTable: 'auth.resource_policies',
      operation: 'select',
      applicationDecision: 'allow',
      rlsPrediction: { decision: 'deny', denyReason: 'bitmap_bit_missing' },
    });
    // allow microtask drain
    await new Promise((r) => setImmediate(r));
    expect(sql.calls.length).toBe(1);
    expect(sql.calls[0].params).toContain('alice');
    expect(sql.calls[0].params).toContain(true); // divergence
  });

  it('INSERT 실패 → logger.error 호출', async () => {
    const sql = fakeSql(false);
    const logger = { error: vi.fn() };
    const recorder = new PgRlsShadowRecorder(sql as never, logger, 't.shadow');
    recorder.record({
      userId: null,
      tenantId: null,
      resourceTable: 'x',
      operation: 'select',
      applicationDecision: 'allow',
      rlsPrediction: { decision: 'deny', denyReason: 'user_id_missing' },
    });
    await new Promise((r) => setImmediate(r));
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'rls-shadow 기록 실패',
    );
  });

  it('divergence=false 는 application==prediction 일 때', async () => {
    const sql = fakeSql(true);
    const logger = { error: vi.fn() };
    const recorder = new PgRlsShadowRecorder(sql as never, logger, 't.shadow');
    recorder.record({
      userId: 'alice',
      tenantId: null,
      resourceTable: 'x',
      operation: 'select',
      applicationDecision: 'allow',
      rlsPrediction: { decision: 'allow', denyReason: null },
    });
    await new Promise((r) => setImmediate(r));
    expect(sql.calls[0].params).toContain(false);
  });
});
