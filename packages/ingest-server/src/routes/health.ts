import type { Db } from "@qa-sdk/store";
import { Hono, type Context } from "hono";

export interface DbHealthStatus {
  connected: boolean;
  latencyMs: number;
}

export type DbHealthChecker = () => Promise<DbHealthStatus>;

export interface HealthRoutesOptions {
  checkDbHealth: DbHealthChecker;
  getUptimeSeconds?: () => number;
  version?: string;
}

let _packageVersion: string | undefined;
function getPackageVersion(): string {
  if (_packageVersion) return _packageVersion;
  try {
    const { readFileSync } = require("node:fs");
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    _packageVersion = pkg.version ?? "0.0.0";
  } catch {
    _packageVersion = "0.0.0";
  }
  return _packageVersion!;
}

export function createHealthRoutes(options: HealthRoutesOptions) {
  const routes = new Hono();
  const version = options.version ?? getPackageVersion();
  const getUptimeSeconds = options.getUptimeSeconds ?? (() => process.uptime());

  routes.get("/health", (c) =>
    respondWithHealth(c, {
      checkDbHealth: options.checkDbHealth,
      getUptimeSeconds,
      version,
    }),
  );

  routes.get("/health/live", (c) => c.json({ ok: true }));

  routes.get("/health/ready", (c) =>
    respondWithHealth(c, {
      checkDbHealth: options.checkDbHealth,
      getUptimeSeconds,
      version,
    }),
  );

  return routes;
}

export function createDbHealthChecker(db: Db): DbHealthChecker {
  return async () => {
    const startedAt = performance.now();

    try {
      await db.execute("SELECT 1");
      return {
        connected: true,
        latencyMs: Math.round(performance.now() - startedAt),
      };
    } catch {
      return {
        connected: false,
        latencyMs: Math.round(performance.now() - startedAt),
      };
    }
  };
}

async function respondWithHealth(
  c: Context,
  options: {
    checkDbHealth: DbHealthChecker;
    getUptimeSeconds: () => number;
    version: string;
  },
) {
  const db = await options.checkDbHealth();
  const ok = db.connected;

  return c.json(
    {
      ok,
      version: options.version,
      uptime_seconds: options.getUptimeSeconds(),
      db: {
        connected: db.connected,
        latency_ms: db.latencyMs,
      },
    },
    ok ? 200 : 503,
  );
}

