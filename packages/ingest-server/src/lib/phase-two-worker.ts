// @def.boundary ingest-system
// @def.doc ingest-system

import {
  now,
  type DlqStore,
  type GraphStore,
  type RecordStore,
  type ScenarioSpecStore,
  type SessionStore,
  type TaskPayload,
  type TaskQueue,
  type TaskQueueOptions,
  type TraceStore,
  type VerdictStore,
} from '@qa-sdk/core';
import { computePendingVerdicts, reconstructPendingTraces } from '@qa-sdk/engine';
import type { Logger } from 'pino';
import type { MetricsCounterPort } from './metrics-collector.js';
import {
  countPhaseTwoFailure,
  runPostVerdictStages,
  type ConvergencePipelinePort,
  type PhaseTwoStage,
  type TransitionEnginePort,
} from './post-verdict-stages.js';

export {
  DECODE_SKIPPED_METRIC,
  PHASE_TWO_FAILURES_METRIC,
  type ConvergencePipelinePort,
  type PhaseTwoStage,
  type TransitionEnginePort,
} from './post-verdict-stages.js';

export const PHASE_TWO_TASK_QUEUE_OPTIONS = {
  retryAttempts: 2,
  retryDelayMs: 1_000,
} as const satisfies TaskQueueOptions;

export interface PhaseTwoWorkerDeps {
  recordStore: RecordStore;
  traceStore: TraceStore;
  graphStore: GraphStore;
  sessionStore: SessionStore;
  verdictStore: VerdictStore;
  scenarioSpecStore: ScenarioSpecStore;
  dlqStore: DlqStore;
  convergencePipeline?: ConvergencePipelinePort;
  transitionEngine?: TransitionEnginePort;
  transitionCatalog?: unknown;
  /** decode-service URL — 설정 시 address_context 디코딩에 외부 서비스 사용 */
  decodeServiceUrl?: string;
  logger?: Logger;
  /** Phase 2 단계 실패·decode skip counter (optional) */
  metricsCollector?: MetricsCounterPort;
  taskQueue?: TaskQueue<TaskPayload>;
}

function countFailure(deps: Pick<PhaseTwoWorkerDeps, 'metricsCollector'>, stage: PhaseTwoStage) {
  countPhaseTwoFailure(deps.metricsCollector, stage);
}

export function buildReconstructionTask(traceId: string): TaskPayload {
  return {
    traceId,
    phase: 'reconstruction',
    enqueuedAt: now(),
  };
}

export function buildVerdictTask(traceId: string): TaskPayload {
  return {
    traceId,
    phase: 'verdict',
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
    'phase-two job started',
  );

  try {
    if (task.phase === 'verdict') {
      await computeTraceVerdictForTask(task.traceId, deps);
    } else {
      await reconstructTraceForTask(task.traceId, deps);
    }

    deps.logger?.info(
      {
        phase: task.phase,
        traceId: task.traceId,
      },
      'phase-two job completed',
    );
  } catch (error) {
    countFailure(deps, task.phase);
    deps.logger?.error(
      {
        err: error,
        phase: task.phase,
        traceId: task.traceId,
      },
      'phase-two job failed',
    );
    throw error;
  }
}

export async function processPendingPhaseTwo(deps: PhaseTwoWorkerDeps): Promise<void> {
  const reconstructResult = await reconstructPendingTraces(
    {
      recordStore: deps.recordStore,
      traceStore: deps.traceStore,
      graphStore: deps.graphStore,
      dlqStore: deps.dlqStore,
    },
    {
      onError: (traceId, error) => {
        countFailure(deps, 'reconstruction');
        deps.logger?.error(
          {
            err: error,
            traceId,
          },
          'failed to reconstruct trace',
        );
      },
    },
  );

  if (reconstructResult.reconstructedTraceIds.length === 0) {
    return;
  }

  const verdictResult = await computePendingVerdicts(
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
        countFailure(deps, 'verdict');
        deps.logger?.error(
          {
            err: error,
            traceId,
          },
          'failed to compute verdict',
        );
      },
    },
  );

  // ── Phase 2.5/3: verdict가 실패하지 않은 trace만 (queue 경로와 동일 조건) ──
  const failed = new Set(verdictResult.failed);
  await runPostVerdictStages(
    deps,
    reconstructResult.reconstructedTraceIds.filter((traceId) => !failed.has(traceId)),
  );
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
    throw toWorkerTaskError('verdict', traceId, capturedFailure);
  }

  // ── Phase 2.5/3: inline 경로와 같은 공용 단계 (fail-open — job 실패로 이어지지 않음) ──
  await runPostVerdictStages(deps, [traceId]);
}

async function reconstructTraceForTask(traceId: string, deps: PhaseTwoWorkerDeps): Promise<void> {
  const trace = await deps.traceStore.findById(traceId);
  if (!trace) {
    deps.logger?.warn(
      {
        traceId,
      },
      'skipping reconstruction for missing trace',
    );
    return;
  }

  if (trace.reconstructed) {
    deps.logger?.info(
      {
        traceId,
      },
      'skipping reconstruction for already reconstructed trace',
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
      throw toWorkerTaskError('reconstruction', traceId, capturedFailure);
    }
  }

  if (!deps.taskQueue) {
    return;
  }

  await deps.taskQueue.enqueue(buildVerdictTask(traceId), PHASE_TWO_TASK_QUEUE_OPTIONS);
}

function toWorkerTaskError(phase: TaskPayload['phase'], traceId: string, error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(`phase-two ${phase} job failed for trace ${traceId}`);
}
