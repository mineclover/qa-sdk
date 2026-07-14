// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01-decision-model §5 t=0s — 3 source 병렬 fetch + fail-open.
// signal id는 grammar #15 buildDecisionSignal로 합성하여 매트릭스 위반을 build 시점 차단.

import { Injectable } from '@nestjs/common';
import { buildDecisionSignal, ALL_SIGNAL_PAIRS } from 'sim-identifier-grammar';
import { createLogger } from '../lib/logger.js';

export interface ScrapeConfig {
  metricsUrl: string;
  ingestUrl: string;
  auditUrl: string;
}

export interface SignalSample {
  value: number;
  sourceName: string;
}

export interface SourceStatus {
  name: 'metrics' | 'ingest' | 'audit';
  ok: boolean;
  weight: number;
}

export interface ScrapeResult {
  scrapedAt: string;
  signals: Record<string, SignalSample>;
  sources: SourceStatus[];
}

// 카테고리×signal → source name. spec 01 §7 측정원 표 그대로.
const SIGNAL_SOURCE: ReadonlyArray<readonly [string, string, 'metrics' | 'ingest' | 'audit']> = [
  ['perf', 'errorRate', 'metrics'],
  ['perf', 'p95LatencyDelta', 'metrics'],
  ['compatibility', 'schemaCompatRate', 'ingest'],
  ['decisionQuality', 'denyRateDelta', 'audit'],
  ['decisionQuality', 'avgConfidenceDelta', 'audit'],
  ['auditSafety', 'criticalAnomalyRate', 'audit'],
  ['replicationHealth', 'replicationLagMs', 'audit'],
  ['loadPressure', 'RPS', 'metrics'],
  ['loadPressure', 'p95LatencyDelta', 'metrics'],
  ['resourceHeadroom', 'CPU', 'metrics'],
  ['resourceHeadroom', 'dbPoolUtilization', 'metrics'],
  ['stability', 'timeSinceLastReplicaChange', 'audit'],
];

@Injectable()
export class MetricsScrapeService {
  private readonly logger = createLogger('sim-canary-controller:scrape');

  constructor(private readonly cfg: ScrapeConfig) {}

  async scrape(): Promise<ScrapeResult> {
    const sig = AbortSignal.timeout(5_000);
    const [m, i, a] = await Promise.allSettled([
      this.fetchJson(`${this.cfg.metricsUrl}/metrics`, sig),
      this.fetchJson(`${this.cfg.ingestUrl}/v1/insights/schema-compat`, sig),
      this.fetchJson(`${this.cfg.auditUrl}/v1/insights/anomaly`, sig),
    ]);
    const w = (s: PromiseSettledResult<unknown>) => (s.status === 'fulfilled' ? 1 : 0.3);
    const sources: SourceStatus[] = [
      { name: 'metrics', ok: m.status === 'fulfilled', weight: w(m) },
      { name: 'ingest', ok: i.status === 'fulfilled', weight: w(i) },
      { name: 'audit', ok: a.status === 'fulfilled', weight: w(a) },
    ];
    const payloads = {
      metrics: m.status === 'fulfilled' ? m.value : {},
      ingest: i.status === 'fulfilled' ? i.value : {},
      audit: a.status === 'fulfilled' ? a.value : {},
    } as const;
    const signals: Record<string, SignalSample> = {};
    for (const [c, s, src] of SIGNAL_SOURCE) {
      try {
        const id = buildDecisionSignal({ category: c as never, signal: s as never });
        const v = (payloads[src] as Record<string, unknown>)[s];
        if (typeof v === 'number') signals[id] = { value: v, sourceName: src };
      } catch (err) {
        this.logger.warn({ err, c, s }, 'decision signal grammar reject');
      }
    }
    for (const [c, s] of ALL_SIGNAL_PAIRS) {
      if (!SIGNAL_SOURCE.some(([cc, ss]) => cc === c && ss === s)) {
        this.logger.warn({ c, s }, 'signal missing in scrape map (spec drift)');
      }
    }
    return { scrapedAt: new Date().toISOString(), signals, sources };
  }

  private async fetchJson(url: string, signal: AbortSignal): Promise<Record<string, unknown>> {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`scrape ${url} → HTTP ${res.status}`);
    try {
      return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      throw new Error(`scrape ${url} → invalid JSON: ${(err as Error).message}`);
    }
  }
}
