import { describe, expect, it } from 'vitest';
import { loadConvergenceFunctions } from './convergence-functions.js';

describe('loadConvergenceFunctions', () => {
  it('pipeline이 쓰는 함수를 빠짐없이 묶는다 (optional 단계 포함)', async () => {
    const fns = await loadConvergenceFunctions();
    for (const name of [
      'aggregateUsageData',
      'collectMetrics',
      'metricsToObservations',
      'resolveRecoveredMetrics',
      'traceFlows',
      'resolveRecoveredFlowObservations',
    ] as const) {
      expect(typeof fns[name], name).toBe('function');
    }
  });
});
