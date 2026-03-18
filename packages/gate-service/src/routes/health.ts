import { Hono } from "hono";

export interface HealthDeps {
  engineConfigured: boolean;
  getUptimeSeconds?: () => number;
  version?: string;
}

export function createHealthRoutes(deps: HealthDeps) {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      gate_engine_configured: deps.engineConfigured,
      uptime_seconds: deps.getUptimeSeconds?.() ?? undefined,
      version: deps.version ?? undefined,
    });
  });

  return app;
}
