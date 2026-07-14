import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createMetricsRegistry } from './lib/registry.js';

describe('sim-metrics-collector app', () => {
  const { registry } = createMetricsRegistry();
  const app = createApp({ registry });

  it('GET /health → 200', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: string };
    expect(body.service).toBe('sim-metrics-collector');
  });

  it('GET /metrics → 200 + Prometheus text format', async () => {
    const res = await app.request('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    const body = await res.text();
    expect(body).toContain('sim_collector_uptime_seconds');
  });
});
