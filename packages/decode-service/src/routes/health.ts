// @def.boundary decode-service-system
// @def.doc decode-service-spec

import { Hono } from "hono";
import type { DecoderPool } from "../lib/decoder-pool.js";

export interface HealthDeps {
  pool: DecoderPool;
  getUptimeSeconds?: () => number;
  version?: string;
}

export function createHealthRoutes(deps: HealthDeps) {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      decoders_loaded: deps.pool.size,
      uptime_seconds: deps.getUptimeSeconds?.() ?? undefined,
      version: deps.version ?? undefined,
    });
  });

  return app;
}
