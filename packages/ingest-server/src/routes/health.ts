// @def.boundary ingest-system
// @def.doc ingest-system

import type { Db } from '@qa-sdk/store';
import { readFileSync } from 'node:fs';
import { Hono, type Context } from 'hono';

export interface DbHealthStatus {
  connected: boolean;
  latencyMs: number;
}

export type DbHealthChecker = () => Promise<DbHealthStatus>;

/** snapshot registry 도달 여부. 미설정이면 readiness에 disabled로 표시 */
export type SnapshotRegistryChecker = () => Promise<{ ok: boolean }>;

export interface HealthRoutesOptions {
  checkDbHealth: DbHealthChecker;
  checkSnapshotRegistry?: SnapshotRegistryChecker;
  getUptimeSeconds?: () => number;
  version?: string;
}

let _packageVersion: string | undefined;
function getPackageVersion(): string {
  if (_packageVersion) return _packageVersion;
  let version: string;
  try {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    version = pkg.version ?? '0.0.0';
  } catch {
    version = '0.0.0';
  }
  _packageVersion = version;
  return version;
}

export function createHealthRoutes(options: HealthRoutesOptions) {
  const routes = new Hono();
  const version = options.version ?? getPackageVersion();
  const getUptimeSeconds = options.getUptimeSeconds ?? (() => process.uptime());

  routes.get('/health', (c) =>
    respondWithHealth(c, {
      checkDbHealth: options.checkDbHealth,
      getUptimeSeconds,
      version,
    }),
  );

  routes.get('/health/live', (c) => c.json({ ok: true }));

  routes.get('/health/ready', (c) =>
    respondWithHealth(c, {
      checkDbHealth: options.checkDbHealth,
      checkSnapshotRegistry: options.checkSnapshotRegistry,
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
      await db.execute('SELECT 1');
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
    checkSnapshotRegistry?: SnapshotRegistryChecker;
    getUptimeSeconds: () => number;
    version: string;
  },
) {
  const db = await options.checkDbHealth();
  const ok = db.connected;
  // snapshot registry 장애는 gate가 fail-open(degraded)으로 처리하므로 readiness를 내리지 않는다
  const snapshotRegistry = options.checkSnapshotRegistry
    ? await options
        .checkSnapshotRegistry()
        .then((r) => (r.ok ? 'ok' : 'degraded'))
        .catch(() => 'degraded')
    : undefined;

  return c.json(
    {
      ok,
      version: options.version,
      uptime_seconds: options.getUptimeSeconds(),
      db: {
        connected: db.connected,
        latency_ms: db.latencyMs,
      },
      ...(snapshotRegistry ? { snapshot_registry: snapshotRegistry } : {}),
    },
    ok ? 200 : 503,
  );
}
