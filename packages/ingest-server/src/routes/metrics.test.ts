import { describe, expect, it } from 'vitest';
import { InMemoryDlqStore } from '@qa-sdk/store';
import { createMetricsCollector } from '../lib/metrics-collector.js';
import { createMetricsRoutes } from './metrics.js';

describe('GET /v1/metrics', () => {
  it('기존 process·dlq 줄과 함께 labeled counter·gauge series를 출력한다', async () => {
    const metricsCollector = createMetricsCollector();
    metricsCollector.inc('ingest_requests_total', { status: '202' });
    metricsCollector.increment('phase_two_failures_total', { stage: 'convergence' });
    metricsCollector.setGauge('convergence_buffer_depth', 3);

    const routes = createMetricsRoutes({
      metricsCollector,
      dlqStore: new InMemoryDlqStore(),
      getUptimeSeconds: () => 10,
    });
    const res = await routes.request('/v1/metrics');
    const body = await res.text();

    expect(res.status).toBe(200);
    const lines = body.split('\n');
    expect(lines).toContain('process_uptime_seconds 10');
    expect(lines).toContain('dlq_depth 0');
    expect(lines).toContain('# TYPE ingest_requests_total counter');
    expect(lines).toContain('ingest_requests_total{status="202"} 1');
    expect(lines).toContain('# TYPE phase_two_failures_total counter');
    expect(lines).toContain('phase_two_failures_total{stage="convergence"} 1');
    expect(lines).toContain('# TYPE convergence_buffer_depth gauge');
    expect(lines).toContain('convergence_buffer_depth 3');
  });
});
