/**
 * producer provenance — 자동 observation이 producer·버전을 기록한다.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GraphPort } from 'spec-schema';
import { describe, expect, it } from 'vitest';
import type { MetricValue } from './metric.types.js';
import type { Clock } from './clock.js';
import { metricsToObservations } from './metric-registry.js';
import { discoverCausalityWithObservations } from './causal-discovery.js';
import {
  CONVERGENCE_ALGORITHM_VERSIONS,
  CONVERGENCE_PACKAGE_NAME,
  CONVERGENCE_PRODUCER_VERSION,
  CONVERGENCE_PRODUCERS,
} from './producer-info.js';

const clock: Clock = () => new Date('2026-10-28T12:00:00.000Z');

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8')) as {
  name: string;
  version: string;
};

describe('convergence producer provenance', () => {
  it('producer 이름·버전이 package.json과 일치한다', () => {
    expect(CONVERGENCE_PACKAGE_NAME).toBe(pkg.name);
    expect(CONVERGENCE_PRODUCER_VERSION).toBe(pkg.version);
  });

  it('metricsToObservations의 모든 observation에 provenance가 있다', () => {
    const metrics: MetricValue[] = [
      { id: 'metric:headroom:a', name: 'h', value: 0, status: 'critical', measuredAt: '' },
      { id: 'metric:skew', name: 's', value: 3, status: 'warning', measuredAt: '' },
      { id: 'metric:ok', name: 'o', value: 0, status: 'ok', measuredAt: '' },
    ];
    const observations = metricsToObservations(metrics, { clock });
    expect(observations).toHaveLength(2);
    for (const o of observations) {
      expect(o.id.startsWith('OBS-METRIC-')).toBe(true);
      expect(o.provenance).toEqual({
        producer: CONVERGENCE_PRODUCERS.metricRegistry,
        producerVersion: CONVERGENCE_PRODUCER_VERSION,
        algorithmVersion: CONVERGENCE_ALGORITHM_VERSIONS.metricRegistry,
      });
    }
    expect(observations[0].provenance?.producer).toBe('convergence/metric-registry');
  });

  it('discoverCausalityWithObservations의 observation에 provenance가 있다', () => {
    const graph = { intentLinksFor: () => [] } as unknown as GraphPort;
    const { observations } = discoverCausalityWithObservations(
      graph,
      [
        {
          sourcePrefix: 'p1',
          sourceEntry: 'a',
          targetPrefix: 'p2',
          targetEntry: 'b',
          count: 1000,
          totalSourceCount: 1000,
        },
      ],
      { clock },
    );
    expect(observations.length).toBeGreaterThan(0);
    for (const o of observations) {
      expect(o.provenance?.producer).toBe(CONVERGENCE_PRODUCERS.causalDiscovery);
      expect(o.provenance?.producerVersion).toBe(CONVERGENCE_PRODUCER_VERSION);
    }
  });
});
