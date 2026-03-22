import {
  now,
  type DlqStore,
  type GraphStore,
  type MetricRollupStore,
  type RecordStore,
  type ScenarioSpecStore,
  type SessionStore,
  type TaskPayload,
  type TaskQueue,
  type TaskQueueOptions,
  type TraceStore,
  type VerdictStore,
} from "@qa-sdk/core";
import { computePendingVerdicts, reconstructPendingTraces } from "@qa-sdk/engine";
import { aggregateMetrics } from "./metric-aggregator.js";
import { decodeAddressContext } from "./decode-client.js";
import type { Logger } from "pino";

export const PHASE_TWO_TASK_QUEUE_OPTIONS = {
  retryAttempts: 2,
  retryDelayMs: 1_000,
} as const satisfies TaskQueueOptions;

/** convergence 파이프라인 최소 인터페이스 (순환 의존 방지) */
export interface ConvergencePipelinePort {
  notifyCompletion(traceIds: readonly string[]): void;
}

/** TransitionFunctions 최소 인터페이스 (순환 의존 방지) */
export interface TransitionEnginePort {
  processSession(input: { readonly sessionId: string; readonly events: readonly unknown[] }): {
    readonly instances: readonly unknown[];
    readonly violations: readonly unknown[];
    readonly unmatchedCount: number;
  };
  decodeCtx(catalog: unknown, encoded: Record<string, string>): Record<string, string>;
}

export interface PhaseTwoWorkerDeps {
  recordStore: RecordStore;
  traceStore: TraceStore;
  graphStore: GraphStore;
  sessionStore: SessionStore;
  verdictStore: VerdictStore;
  scenarioSpecStore: ScenarioSpecStore;
  dlqStore: DlqStore;
  metricRollupStore?: MetricRollupStore;
  convergencePipeline?: ConvergencePipelinePort;
  transitionEngine?: TransitionEnginePort;
  transitionCatalog?: unknown;
  /** decode-service URL — 설정 시 address_context 디코딩에 외부 서비스 사용 */
  decodeServiceUrl?: string;
  logger?: Logger;
  taskQueue?: TaskQueue<TaskPayload>;
}

export function buildReconstructionTask(traceId: string): TaskPayload {
  return {
    traceId,
    phase: "reconstruction",
    enqueuedAt: now(),
  };
}

export function buildVerdictTask(traceId: string): TaskPayload {
  return {
    traceId,
    phase: "verdict",
    enqueuedAt: now(),
  };
}

export async function processPhaseTwoTask(
  task: TaskPayload,
  deps: PhaseTwoWorkerDeps,
): Promise<void> {
  deps.logger?.info(
    {
      phase: task.phase,
      traceId: task.traceId,
    },
    "phase-two job started",
  );

  try {
    if (task.phase === "verdict") {
      await computeTraceVerdictForTask(task.traceId, deps);
    } else {
      await reconstructTraceForTask(task.traceId, deps);
    }

    deps.logger?.info(
      {
        phase: task.phase,
        traceId: task.traceId,
      },
      "phase-two job completed",
    );
  } catch (error) {
    deps.logger?.error(
      {
        err: error,
        phase: task.phase,
        traceId: task.traceId,
      },
      "phase-two job failed",
    );
    throw error;
  }
}

export async function processPendingPhaseTwo(
  deps: PhaseTwoWorkerDeps,
): Promise<void> {
  const reconstructResult = await reconstructPendingTraces(
    {
      recordStore: deps.recordStore,
      traceStore: deps.traceStore,
      graphStore: deps.graphStore,
      dlqStore: deps.dlqStore,
    },
    {
      onError: (traceId, error) => {
        deps.logger?.error(
          {
            err: error,
            traceId,
          },
          "failed to reconstruct trace",
        );
      },
    },
  );

  // metric aggregation (reconstruction과 독립적)
  if (deps.metricRollupStore) {
    await aggregateMetricsForPendingTraces(deps);
  }

  if (reconstructResult.reconstructedTraceIds.length === 0) {
    return;
  }

  await computePendingVerdicts(
    {
      traceStore: deps.traceStore,
      sessionStore: deps.sessionStore,
      graphStore: deps.graphStore,
      scenarioSpecStore: deps.scenarioSpecStore,
      verdictStore: deps.verdictStore,
      dlqStore: deps.dlqStore,
    },
    reconstructResult.reconstructedTraceIds,
    {
      onError: (traceId, error) => {
        deps.logger?.error(
          {
            err: error,
            traceId,
          },
          "failed to compute verdict",
        );
      },
    },
  );

  // ── Phase 2.5: Transition Matching (에러 격리) ──────
  if (deps.transitionEngine && deps.transitionCatalog) {
    try {
      for (const traceId of reconstructResult.reconstructedTraceIds) {
        const records = await deps.recordStore.findByTraceId(traceId);
        // address_context가 있는 레코드만 디코딩 + 전이 매칭
        const withCtx = records.filter((r: any) => r.addressContext && typeof r.addressContext === "object");
        const decodedEvents: any[] = [];
        for (const r of withCtx) {
          const ctx = r.addressContext as Record<string, string>;
          // 1) decode-service 우선 시도 (설정된 경우)
          let decoded: Record<string, string> | undefined;
          if (deps.decodeServiceUrl) {
            const result = await decodeAddressContext(deps.decodeServiceUrl, ctx);
            if (result) {
              decoded = {};
              for (const [k, v] of Object.entries(result)) {
                for (const [ek, ev] of Object.entries(v.entities)) {
                  decoded[`${k}.${ek}`] = ev;
                }
              }
            }
          }
          // 2) 로컬 fallback
          if (!decoded) {
            decoded = deps.transitionEngine!.decodeCtx(deps.transitionCatalog!, ctx);
          }
          decodedEvents.push({
            ...r,
            log_id: (r as any).id ?? (r as any).logId ?? "",
            timestamp: (r as any).createdAt ?? (r as any).timestamp ?? "",
            address_context: decoded,
          });
        }

        if (decodedEvents.length > 0) {
          const result = deps.transitionEngine.processSession({
            sessionId: traceId,
            events: decodedEvents,
          });

          if (result.violations.length > 0) {
            deps.logger?.warn(
              { traceId, violations: result.violations.length, instances: result.instances.length },
              "transition violations detected",
            );
          }
        }
      }
    } catch (error) {
      deps.logger?.error({ err: error }, "transition matching failed (Phase 2.5) — verdict unaffected");
    }
  }

  // convergence 파이프라인에 완료 알림 (에러 격리)
  if (deps.convergencePipeline) {
    try {
      deps.convergencePipeline.notifyCompletion(reconstructResult.reconstructedTraceIds);
    } catch (error) {
      deps.logger?.error({ err: error }, "convergence notification failed");
    }
  }
}

export async function registerTaskQueueWorker(
  taskQueue: TaskQueue<TaskPayload>,
  deps: PhaseTwoWorkerDeps,
): Promise<void> {
  const workerDeps = deps.taskQueue
    ? deps
    : {
        ...deps,
        taskQueue,
      };

  await taskQueue.process(async (task) => {
    await processPhaseTwoTask(task, workerDeps);
  });
}

async function aggregateMetricsForPendingTraces(
  deps: PhaseTwoWorkerDeps,
): Promise<void> {
  if (!deps.metricRollupStore) return;

  // unreconstructed trace에서 metric 레코드만 조회
  const pendingTraces = await deps.traceStore.findUnreconstructed();
  for (const trace of pendingTraces) {
    const records = await deps.recordStore.findByTraceId(trace.traceId);
    const metrics = records.filter((r) => r.recordKind === "metric");
    if (metrics.length === 0) continue;

    try {
      const count = await aggregateMetrics(metrics, deps.metricRollupStore);
      deps.logger?.info(
        { traceId: trace.traceId, metricsAggregated: count },
        "metric aggregation completed",
      );
    } catch (error) {
      deps.logger?.error(
        { err: error, traceId: trace.traceId },
        "metric aggregation failed",
      );
    }
  }
}

async function computeTraceVerdictForTask(
  traceId: string,
  deps: PhaseTwoWorkerDeps,
): Promise<void> {
  let capturedFailure: unknown;
  const result = await computePendingVerdicts(
    {
      traceStore: deps.traceStore,
      sessionStore: deps.sessionStore,
      graphStore: deps.graphStore,
      scenarioSpecStore: deps.scenarioSpecStore,
      verdictStore: deps.verdictStore,
      dlqStore: deps.dlqStore,
    },
    [traceId],
    {
      captureFailuresInDlq: false,
      onError: (_failedTraceId, error) => {
        capturedFailure = error;
      },
    },
  );

  if (result.failed.includes(traceId)) {
    throw toWorkerTaskError("verdict", traceId, capturedFailure);
  }
}

async function reconstructTraceForTask(
  traceId: string,
  deps: PhaseTwoWorkerDeps,
): Promise<void> {
  const trace = await deps.traceStore.findById(traceId);
  if (!trace) {
    deps.logger?.warn(
      {
        traceId,
      },
      "skipping reconstruction for missing trace",
    );
    return;
  }

  if (trace.reconstructed) {
    deps.logger?.info(
      {
        traceId,
      },
      "skipping reconstruction for already reconstructed trace",
    );
  } else {
    let capturedFailure: unknown;
    const result = await reconstructPendingTraces(
      {
        recordStore: deps.recordStore,
        traceStore: deps.traceStore,
        graphStore: deps.graphStore,
        dlqStore: deps.dlqStore,
      },
      {
        captureFailuresInDlq: false,
        onError: (_failedTraceId, error) => {
          capturedFailure = error;
        },
        traceIds: [traceId],
      },
    );

    if (result.failedTraceIds.includes(traceId)) {
      throw toWorkerTaskError("reconstruction", traceId, capturedFailure);
    }
  }

  if (!deps.taskQueue) {
    return;
  }

  await deps.taskQueue.enqueue(
    buildVerdictTask(traceId),
    PHASE_TWO_TASK_QUEUE_OPTIONS,
  );
}

function toWorkerTaskError(
  phase: TaskPayload["phase"],
  traceId: string,
  error: unknown,
): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(`phase-two ${phase} job failed for trace ${traceId}`);
}
