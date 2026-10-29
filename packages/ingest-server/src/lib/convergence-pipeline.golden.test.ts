// @def.boundary ingest-system
// @def.doc ingest-system

import { describe, expect, it, vi } from 'vitest';
import { detectAnomalies, type PatternClassification } from '@qa-sdk/convergence';
import {
  ConvergencePipelineRunner,
  type ConvergencePipelineDeps,
  type PatternFunctions,
} from './convergence-pipeline.js';

function unclassified(): PatternClassification {
  return {
    pattern: 'unclassified',
    identificationMode: 'anonymous',
    confidence: 'unknown',
    matchedRuleId: 'none',
    eventCount: 4,
    durationMs: 1000,
    classifiedAt: '2026-10-29T00:00:00.000Z',
  };
}

function createDeps(): {
  deps: ConvergencePipelineDeps;
  savedObservations: ReturnType<typeof vi.fn>;
} {
  const savedObservations = vi.fn();
  const patternFns: PatternFunctions = {
    classifyPattern: vi.fn(() => unclassified()),
    aggregatePatternStats: vi.fn(() => [
      {
        pattern: 'unclassified',
        identificationMode: 'anonymous',
        count: 1,
        percentage: 1,
        avgEventCount: 4,
        avgDurationMs: 1000,
        lastSeen: '2026-10-29T00:00:00.000Z',
      },
    ]),
    detectAnomalies,
    buildPatternHealthReport: vi.fn(() => ({
      totalSessions: 1,
      stats: [],
      classificationRate: 0,
      identifiedRate: 0,
      anomalyCount: 1,
      generatedAt: '2026-10-29T00:00:00.000Z',
    })),
    patternRules: [],
  };

  return {
    deps: {
      recordStore: {
        findByTraceId: vi.fn().mockResolvedValue([
          {
            id: 'golden-record',
            addressContext: {},
            eventKey: 'unknown.event',
            createdAt: '2026-10-29T00:00:00.000Z',
            sessionId: 'golden-session',
          },
        ]),
      } as any,
      convergenceFns: {
        aggregateUsageData: vi.fn(() => ({
          collectionPeriod: { from: '2026-10-29', to: '2026-10-29' },
          entryUsages: [],
          addressUsages: [],
          coOccurrences: [],
          versionUsages: [],
        })),
        collectMetrics: vi.fn(() => []),
        metricsToObservations: vi.fn(() => []),
      },
      patternFns,
      graphProvider: () => ({ getNodesByKind: () => [] }) as any,
      catalogProvider: () => ({ id: 'golden', name: 'golden', axes: {}, prefixes: {} }),
      dkgStore: {
        saveUsageSnapshotWithObservations: vi.fn((_, observations) => {
          savedObservations(observations);
          return { snapshotId: 1, observationsWritten: observations.length };
        }),
      },
    },
    savedObservations,
  };
}

describe('수렴 파이프라인 목적 정렬 골든', () => {
  it('첫 윈도우 1세션 미분류는 info로만 남고 Observation을 만들지 않는다', async () => {
    const { deps, savedObservations } = createDeps();
    const runner = new ConvergencePipelineRunner(deps, { recordThreshold: 999 });

    runner.notifyCompletion(['trace-golden']);
    const result = await runner.flush();

    expect(result?.pattern?.anomaliesDetected).toBe(1);
    expect(savedObservations).toHaveBeenCalledTimes(1);
    expect(savedObservations.mock.calls[0][0]).toEqual([]);
  });
});
