import { describe, expect, it } from 'vitest';
import { createMetricsRegistry } from './registry.js';

describe('sim-metrics-collector registry', () => {
  it('default metrics + uptime gauge 등록', async () => {
    const { registry } = createMetricsRegistry();
    const text = await registry.metrics();
    expect(text).toContain('sim_collector_uptime_seconds');
    expect(text).toContain('process_cpu_user_seconds_total'); // collectDefaultMetrics
  });

  it('default label service=sim-metrics-collector 부착', async () => {
    const { registry } = createMetricsRegistry();
    const text = await registry.metrics();
    expect(text).toContain('service="sim-metrics-collector"');
  });
});
