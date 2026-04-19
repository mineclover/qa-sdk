// @def.boundary ingest-system
// @def.doc ingest-system

import type { Logger } from "pino";

export const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1_000;

export interface CleanupSchedulerDeps {
  enabled: boolean;
  logger?: Logger;
  runCleanup: () => Promise<unknown>;
  setInterval?: typeof globalThis.setInterval;
  clearInterval?: typeof globalThis.clearInterval;
  intervalMs?: number;
}

export interface CleanupSchedulerHandle {
  stop: () => void;
}

export function installCleanupScheduler(
  deps: CleanupSchedulerDeps,
): CleanupSchedulerHandle | null {
  if (!deps.enabled) {
    return null;
  }

  const setIntervalFn = deps.setInterval ?? globalThis.setInterval;
  const clearIntervalFn = deps.clearInterval ?? globalThis.clearInterval;
  const intervalMs = deps.intervalMs ?? CLEANUP_INTERVAL_MS;
  const timer = setIntervalFn(() => {
    void deps.runCleanup().catch((error) => {
      deps.logger?.error({ err: error }, "scheduled cleanup run failed");
    });
  }, intervalMs);

  if ("unref" in timer && typeof timer.unref === "function") {
    timer.unref();
  }

  deps.logger?.info({ intervalMs }, "scheduled expired data cleanup");

  return {
    stop() {
      clearIntervalFn(timer);
    },
  };
}
