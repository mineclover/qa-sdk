import { describe, expect, it, vi } from 'vitest';
import type { StoredRecord } from '@qa-sdk/core';
import { createMetricsCollector } from './metrics-collector.js';
import {
  DECODE_SKIPPED_METRIC,
  PHASE_TWO_FAILURES_METRIC,
  runPostVerdictStages,
  type PostVerdictStageDeps,
} from './post-verdict-stages.js';

vi.mock('./decode-client.js', () => ({
  decodeAddressContext: vi.fn(async () => null),
}));

function record(traceId: string, addressContext?: Record<string, string>): StoredRecord {
  return {
    logId: `log_${traceId}`,
    traceId,
    timestamp: new Date('2026-03-18T00:00:00.000Z'),
    addressContext,
  } as unknown as StoredRecord;
}

function createDeps(overrides: Partial<PostVerdictStageDeps> = {}) {
  const metricsCollector = createMetricsCollector();
  const deps = {
    transitionEngine: {
      processSession: vi.fn(() => ({ instances: [], violations: [], unmatchedCount: 0 })),
      decodeCtx: vi.fn((_catalog: unknown, encoded: Record<string, string>) => ({ ...encoded })),
    },
    transitionCatalog: { id: 'catalog' },
    convergencePipeline: { notifyCompletion: vi.fn() },
    recordStore: {
      findByTraceId: vi.fn(async (traceId: string) => [record(traceId, { page: 'page:v1:1' })]),
    },
    logger: { warn: vi.fn(), error: vi.fn() },
    metricsCollector,
    ...overrides,
  };
  return deps;
}

function failures(deps: { metricsCollector: ReturnType<typeof createMetricsCollector> }) {
  return deps.metricsCollector.snapshot().filter((s) => s.name === PHASE_TWO_FAILURES_METRIC);
}

describe('runPostVerdictStages', () => {
  it('transition을 평가하고 convergence에 trace를 알린다', async () => {
    const d = createDeps();
    const result = await runPostVerdictStages(d, ['t1', 't2']);

    expect(result).toEqual({ transitions: 2, convergenceNotified: 2 });
    expect(d.transitionEngine.processSession).toHaveBeenCalledTimes(2);
    expect(d.transitionEngine.processSession).toHaveBeenCalledWith({
      sessionId: 't1',
      events: [
        expect.objectContaining({
          log_id: 'log_t1',
          address_context: { page: 'page:v1:1' },
        }),
      ],
    });
    expect(d.convergencePipeline.notifyCompletion).toHaveBeenCalledWith(['t1', 't2']);
  });

  it('convergence 실패는 던지지 않고 기록한다 (verdict 비차단)', async () => {
    const d = createDeps({
      convergencePipeline: {
        notifyCompletion: vi.fn(() => {
          throw new Error('boom');
        }),
      },
    });
    await expect(runPostVerdictStages(d, ['t1'])).resolves.toEqual({
      transitions: 1,
      convergenceNotified: 0,
    });
    expect(d.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      expect.any(String),
    );
    expect(failures(d)).toEqual([
      expect.objectContaining({ labels: { stage: 'convergence' }, value: 1 }),
    ]);
  });

  it('transition이 비활성이면 convergence만 실행한다', async () => {
    const d = createDeps({ transitionEngine: undefined });
    const result = await runPostVerdictStages(d, ['t1']);
    expect(result).toEqual({ transitions: 0, convergenceNotified: 1 });
    expect(d.recordStore.findByTraceId).not.toHaveBeenCalled();
    expect(d.convergencePipeline.notifyCompletion).toHaveBeenCalledWith(['t1']);
  });

  it('한 trace의 transition 실패는 나머지 trace와 convergence를 막지 않는다', async () => {
    const d = createDeps();
    d.recordStore.findByTraceId.mockImplementation(async (traceId: string) => {
      if (traceId === 't1') throw new Error('store down');
      return [record(traceId, { page: 'page:v1:1' })];
    });

    const result = await runPostVerdictStages(d, ['t1', 't2']);

    expect(result).toEqual({ transitions: 1, convergenceNotified: 2 });
    expect(d.logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error), traceId: 't1' },
      expect.stringContaining('Phase 2.5'),
    );
    expect(failures(d)).toEqual([
      expect.objectContaining({ labels: { stage: 'transition' }, value: 1 }),
    ]);
  });

  it('address_context가 없는 trace는 transition 평가에서 제외한다', async () => {
    const d = createDeps();
    d.recordStore.findByTraceId.mockResolvedValue([record('t1')]);
    const result = await runPostVerdictStages(d, ['t1']);
    expect(result.transitions).toBe(0);
    expect(d.transitionEngine.processSession).not.toHaveBeenCalled();
  });

  it('decode-service가 응답하지 않으면 로컬 decode로 대체하고 skip을 센다', async () => {
    const d = createDeps({ decodeServiceUrl: 'http://decode.invalid' });
    await runPostVerdictStages(d, ['t1']);
    expect(d.transitionEngine.decodeCtx).toHaveBeenCalledWith(d.transitionCatalog, {
      page: 'page:v1:1',
    });
    expect(d.metricsCollector.snapshot()).toContainEqual({
      name: DECODE_SKIPPED_METRIC,
      type: 'counter',
      labels: {},
      value: 1,
    });
  });

  it('trace가 없으면 아무 단계도 실행하지 않는다', async () => {
    const d = createDeps();
    await expect(runPostVerdictStages(d, [])).resolves.toEqual({
      transitions: 0,
      convergenceNotified: 0,
    });
    expect(d.convergencePipeline.notifyCompletion).not.toHaveBeenCalled();
  });
});
