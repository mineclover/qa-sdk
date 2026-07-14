// @def.boundary query-api-spec
// @def.doc query-api-spec

import { Hono } from 'hono';

export interface HealthDeps {
  storeKind: string;
  getUptimeSeconds?: () => number;
  version?: string;
}

export function createHealthRoutes(deps: HealthDeps) {
  const app = new Hono();

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      policy_rule_store: deps.storeKind,
      uptime_seconds: deps.getUptimeSeconds?.() ?? undefined,
      version: deps.version ?? undefined,
    });
  });

  return app;
}
