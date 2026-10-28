import { performance } from 'node:perf_hooks';
import { summarizeNs } from './report-schema.js';
import type { MicroCaseResult } from './report-schema.js';

/** warm 측정 전에 JIT를 안정시키기 위한 사전 실행 횟수 */
export const WARMUP_ITERATIONS = 1_000;

export interface MeasureCaseOptions {
  readonly id: string;
  /** false면 warmup 없이 측정한다 (cold). warm/cold는 별도 case로 기록하고 섞지 않는다 */
  readonly warm: boolean;
  readonly iterations: number;
  readonly run: () => unknown;
}

/** 측정 결과를 소비해 dead-code elimination을 막는다 */
let sink: unknown;

/**
 * 단일 case를 측정한다.
 *
 * - 반복마다 `process.hrtime.bigint()`로 ns 표본을 남긴다
 * - `--expose-gc`로 gc가 노출된 경우에만 heap 증가량을 기록한다 (아니면 null, 추정값 금지)
 * - run이 throw하면 측정을 중단하고 `skipped`로 기록한다. 이유는 skipReason에 보존한다
 */
export function measureCase(options: MeasureCaseOptions): MicroCaseResult {
  const { id, warm, iterations, run } = options;
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error(`measureCase(${id}): iterations는 1 이상의 정수여야 한다 (받은 값: ${iterations})`);
  }
  try {
    if (warm) for (let i = 0; i < WARMUP_ITERATIONS; i++) sink = run();
    const gc = (globalThis as { gc?: () => void }).gc;
    gc?.();
    const heapBefore = process.memoryUsage().heapUsed;
    const samples = new Array<number>(iterations);
    const started = performance.now();
    for (let i = 0; i < iterations; i++) {
      const t0 = process.hrtime.bigint();
      sink = run();
      samples[i] = Number(process.hrtime.bigint() - t0);
    }
    const elapsedMs = performance.now() - started;
    const heapDelta = gc ? (process.memoryUsage().heapUsed - heapBefore) / iterations : null;
    return {
      id,
      status: 'ok',
      warm,
      iterations,
      nsPerOp: summarizeNs(samples),
      opsPerSec: elapsedMs > 0 ? (iterations / elapsedMs) * 1_000 : null,
      heapDeltaBytesPerOp: heapDelta,
    };
  } catch (error) {
    return {
      id,
      status: 'skipped',
      skipReason: error instanceof Error ? error.message : String(error),
      warm,
      iterations,
      nsPerOp: null,
      opsPerSec: null,
      heapDeltaBytesPerOp: null,
    };
  } finally {
    sink = undefined;
  }
}
