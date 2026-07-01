// @def.boundary decode-service-system
// @def.doc decode-service-system

import { Hono } from "hono";
import type { KeyCache } from "@qa-sdk/core";
import type { DecoderPool } from "../lib/decoder-pool.js";

export interface DecodeCacheHealth {
  driver: "memory" | "redis";
  status: "disabled" | "connected" | "disconnected";
}

export interface HealthDeps {
  pool: DecoderPool;
  getUptimeSeconds?: () => number;
  version?: string;
  decodeCache?: KeyCache;
  cacheHealth?: DecodeCacheHealth;
}

export function createHealthRoutes(deps: HealthDeps) {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      decoders_loaded: deps.pool.size,
      uptime_seconds: deps.getUptimeSeconds?.() ?? undefined,
      version: deps.version ?? undefined,
      cache: deps.cacheHealth ?? (
        deps.decodeCache
          ? { driver: "redis", status: "connected" }
          : { driver: "memory", status: "disabled" }
      ),
    });
  });

  return app;
}
