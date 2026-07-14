// @def.boundary sim-metrics-collector
// @def.doc sim-erp-pm-design

import { Hono } from 'hono';
import type { Registry } from 'prom-client';

export interface MetricsRouteDeps {
  registry: Registry;
}

export function createMetricsRoutes(deps: MetricsRouteDeps) {
  const r = new Hono();
  r.get('/metrics', async (c) => {
    const text = await deps.registry.metrics();
    return c.text(text, 200, {
      'Content-Type': deps.registry.contentType,
    });
  });
  return r;
}
