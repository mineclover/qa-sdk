import { readFileSync } from "node:fs";
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

const packageVersion = readPackageVersion();

export function createHealthRoutes(options: HealthRoutesOptions) {
  const routes = new Hono();
  const version = options.version ?? packageVersion;
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

function readPackageVersion() {
  const packageJson = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { version?: string };

  return packageJson.version ?? "0.0.0";
}
