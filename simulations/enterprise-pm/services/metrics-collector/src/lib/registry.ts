// @def.boundary sim-metrics-collector
// @def.doc sim-erp-pm-design

import { Registry, collectDefaultMetrics, Gauge } from 'prom-client';

/**
 * Prometheus Registry 생성.
 *
 * 본 plan: process default metrics + sim_collector_uptime_seconds gauge.
 * Plan 14a: cross-service scrape registry 부착 (7 비즈니스 서비스의 /metrics 합산).
 */
export function createMetricsRegistry(
  opts: { serviceName: string } = { serviceName: 'sim-metrics-collector' },
) {
  const registry = new Registry();
  registry.setDefaultLabels({ service: opts.serviceName });

  collectDefaultMetrics({ register: registry });

  const startedAt = Date.now();
  const uptimeGauge = new Gauge({
    name: 'sim_collector_uptime_seconds',
    help: 'Seconds since sim-metrics-collector started',
    registers: [registry],
    collect() {
      this.set((Date.now() - startedAt) / 1000);
    },
  });

  return { registry, uptimeGauge };
}
