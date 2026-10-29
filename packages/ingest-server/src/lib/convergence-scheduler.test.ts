// @def.boundary ingest-system
// @def.doc ingest-system

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  installConvergenceScheduler,
  type ConvergenceSchedulerDeps,
} from './convergence-scheduler.js';
import { ConvergencePipelineRunner } from './convergence-pipeline.js';

function createMockPipeline() {
  return {
    flush: vi.fn().mockResolvedValue({
      recordsProcessed: 10,
      metricsCollected: 3,
      observationsGenerated: 1,
    }),
    notifyCompletion: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    pendingCount: 5,
  } as unknown as ConvergencePipelineRunner;
}

describe('installConvergenceScheduler', () => {
  let handle: ReturnType<typeof installConvergenceScheduler>;

  afterEach(() => {
    handle?.stop();
  });

  it('enabled=false → null 반환, 타이머 미설치', () => {
    handle = installConvergenceScheduler({
      enabled: false,
      convergencePipeline: createMockPipeline(),
    });

    expect(handle).toBeNull();
  });

  it('enabled=true → handle 반환, 주기적 flush 실행', async () => {
    const pipeline = createMockPipeline();

    handle = installConvergenceScheduler({
      enabled: true,
      convergencePipeline: pipeline,
      intervalMs: 50, // 50ms로 짧게
    });

    expect(handle).not.toBeNull();

    // 50ms 이상 대기 → flush 호출 확인
    await new Promise((r) => setTimeout(r, 120));

    expect(pipeline.flush).toHaveBeenCalled();
  });

  it('이전 flush 실행 중이면 건너뜀', async () => {
    let resolveFlush: () => void;
    const pipeline = createMockPipeline();
    (pipeline.flush as any).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFlush = () =>
            resolve({ recordsProcessed: 0, metricsCollected: 0, observationsGenerated: 0 });
        }),
    );

    handle = installConvergenceScheduler({
      enabled: true,
      convergencePipeline: pipeline,
      intervalMs: 30,
    });

    // 첫 번째 flush 시작 대기
    await new Promise((r) => setTimeout(r, 50));
    expect(pipeline.flush).toHaveBeenCalledTimes(1);

    // 두 번째 타이머 실행 — 첫 번째가 아직 진행 중이므로 skip
    await new Promise((r) => setTimeout(r, 40));
    expect(pipeline.flush).toHaveBeenCalledTimes(1); // 여전히 1

    // 첫 번째 flush 완료
    resolveFlush!();
    await new Promise((r) => setTimeout(r, 40));

    // 이제 새 flush 가능
    expect(pipeline.flush).toHaveBeenCalledTimes(2);
  });

  it('stop() 후 더 이상 flush 안 함', async () => {
    const pipeline = createMockPipeline();

    handle = installConvergenceScheduler({
      enabled: true,
      convergencePipeline: pipeline,
      intervalMs: 30,
    });

    handle!.stop();

    await new Promise((r) => setTimeout(r, 80));

    expect(pipeline.flush).not.toHaveBeenCalled();
  });

  it('flush 에러 시에도 다음 주기 계속 실행', async () => {
    const pipeline = createMockPipeline();
    (pipeline.flush as any)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ recordsProcessed: 0, metricsCollected: 0, observationsGenerated: 0 });

    handle = installConvergenceScheduler({
      enabled: true,
      convergencePipeline: pipeline,
      intervalMs: 40,
    });

    // 에러 후 다음 주기까지 대기
    await new Promise((r) => setTimeout(r, 120));

    // 에러가 발생한 첫 번째 + 복구된 후속 호출이 최소 2회 이상
    expect((pipeline.flush as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(
      2,
    );
  });
});

describe('convergence 주기 flush 단일화 (D-4)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('server 구성(runner + scheduler)에서 한 주기에 flush는 정확히 1회', async () => {
    vi.useFakeTimers();
    const intervalMs = 60_000;
    const runner = new ConvergencePipelineRunner(
      {
        recordStore: { findByTraceId: vi.fn(async () => []) } as never,
        convergenceFns: {
          aggregateUsageData: vi.fn(),
          collectMetrics: vi.fn(() => []),
          metricsToObservations: vi.fn(() => []),
        } as never,
        graphProvider: () => ({ getNodesByKind: () => [] }),
        catalogProvider: () => ({ id: 'test', name: 'test', axes: {}, prefixes: {} }) as never,
      },
      { recordThreshold: 999 },
    );
    const flushSpy = vi.spyOn(runner, 'flush');
    const scheduler = installConvergenceScheduler({
      enabled: true,
      convergencePipeline: runner,
      intervalMs,
    });

    await vi.advanceTimersByTimeAsync(intervalMs);
    expect(flushSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(intervalMs);
    expect(flushSpy).toHaveBeenCalledTimes(2);

    scheduler?.stop();
    await runner.close();
  });

  it('runner 단독으로는 timer를 설치하지 않는다 (주기 flush는 scheduler 책임)', async () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const runner = new ConvergencePipelineRunner({
      recordStore: { findByTraceId: vi.fn(async () => []) } as never,
      convergenceFns: {} as never,
      graphProvider: () => ({ getNodesByKind: () => [] }),
      catalogProvider: () => ({ id: 'test', name: 'test', axes: {}, prefixes: {} }) as never,
    });
    expect(setIntervalSpy).not.toHaveBeenCalled();
    await runner.close();
  });
});
