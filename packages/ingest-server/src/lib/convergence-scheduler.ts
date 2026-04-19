// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * convergence-scheduler — 주기적 convergence flush.
 *
 * 트래픽이 낮아 threshold에 못 미치는 시간대에도
 * convergence 분석이 실행되도록 보장.
 * cleanup-scheduler와 동일한 패턴.
 */

import type { Logger } from "pino";
import type { ConvergencePipelineRunner } from "./convergence-pipeline.js";

export const DEFAULT_CONVERGENCE_SCHEDULE_INTERVAL_MS = 5 * 60 * 1_000; // 5분

export interface ConvergenceSchedulerDeps {
  enabled: boolean;
  convergencePipeline: ConvergencePipelineRunner;
  logger?: Logger;
  intervalMs?: number;
}

export interface ConvergenceSchedulerHandle {
  stop: () => void;
}

export function installConvergenceScheduler(
  deps: ConvergenceSchedulerDeps,
): ConvergenceSchedulerHandle | null {
  if (!deps.enabled) {
    return null;
  }

  const intervalMs = deps.intervalMs ?? DEFAULT_CONVERGENCE_SCHEDULE_INTERVAL_MS;
  let running = false;

  const timer = setInterval(() => {
    if (running) {
      deps.logger?.debug("convergence scheduler: previous flush still running, skipping");
      return;
    }
    running = true;
    void deps.convergencePipeline.flush()
      .then((result) => {
        if (result) {
          deps.logger?.info(
            {
              recordsProcessed: result.recordsProcessed,
              metricsCollected: result.metricsCollected,
              observationsGenerated: result.observationsGenerated,
            },
            "convergence scheduled flush completed",
          );
        }
        return undefined;
      })
      .catch((error) => {
        deps.logger?.error({ err: error }, "convergence scheduled flush failed");
      })
      .finally(() => {
        running = false;
      });
  }, intervalMs);

  if ("unref" in timer && typeof timer.unref === "function") {
    timer.unref();
  }

  deps.logger?.info({ intervalMs }, "convergence scheduler installed");

  return {
    stop() {
      clearInterval(timer);
    },
  };
}
