import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import { reconstruct } from "@qa-sdk/engine";
import {
  InMemoryDlqStore,
  InMemoryGraphStore,
  InMemoryRecordStore,
  InMemoryScenarioSpecStore,
  InMemorySessionStore,
  InMemoryTraceStore,
  InMemoryVerdictStore,
} from "@qa-sdk/store";
import type { TaskPayload } from "@qa-sdk/core";
import { InMemoryTaskQueue } from "./in-memory-task-queue.js";
import {
  buildReconstructionTask,
  buildVerdictTask,
  PHASE_TWO_TASK_QUEUE_OPTIONS,
  processPhaseTwoTask,
  registerTaskQueueWorker,
} from "./phase-two-worker.js";

function createLoggerMock(): Logger {
  return {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  } as unknown as Logger;
}

function createWorkerDeps() {
  return {
    dlqStore: new InMemoryDlqStore(),
    graphStore: new InMemoryGraphStore(),
    recordStore: new InMemoryRecordStore(),
    scenarioSpecStore: new InMemoryScenarioSpecStore(),
    sessionStore: new InMemorySessionStore(),
    traceStore: new InMemoryTraceStore(),
    verdictStore: new InMemoryVerdictStore(),
  };
}

async function seedPendingTrace(
  deps: ReturnType<typeof createWorkerDeps>,
  traceId: string,
  sessionId = "session_001",
) {
  await deps.traceStore.upsert({
    traceId,
    sessionId,
    recordCount: 1,
    firstTimestamp: new Date("2026-03-18T00:00:00.000Z"),
    lastTimestamp: new Date("2026-03-18T00:00:01.000Z"),
  });
  await deps.recordStore.insertBatch([
    {
      logId: `log_${traceId}`,
      traceId,
      spanId: `span_${traceId}`,
      timestamp: new Date("2026-03-18T00:00:00.000Z"),
      recordKind: "log",
      eventKey: "page_view",
      eventVersion: "1",
      payloadFormat: "json",
      payloadEncoding: "raw",
      payloadMaskingApplied: false,
      payloadMaskedFields: [],
      payload: {},
      qaSessionId: sessionId,
    },
  ]);
}

async function seedVerdictPrerequisites(
  deps: ReturnType<typeof createWorkerDeps>,
  traceId: string,
  sessionId = "session_001",
  scenarioId = "scenario_001",
) {
  await deps.traceStore.upsert({
    traceId,
    sessionId,
    recordCount: 1,
    firstTimestamp: new Date("2026-03-18T00:00:00.000Z"),
    lastTimestamp: new Date("2026-03-18T00:00:01.000Z"),
  });
  await deps.traceStore.markReconstructed(traceId);
  await deps.sessionStore.upsert({
    sessionId,
    scenarioId,
  });
  await deps.scenarioSpecStore.upsert({
    scenario_id: scenarioId,
    version: "1.0.0",
    domain: "checkout",
    steps: [
      {
        id: "step_1",
        event_key: "page_view",
        required: true,
        kind: "sequence",
      },
    ],
  });
  await deps.graphStore.upsert(
    traceId,
    reconstruct(traceId, [
      {
        log_id: `log_${traceId}`,
        timestamp: "2026-03-18T00:00:00.000Z",
        record_kind: "log",
        trace_id: traceId,
        span_id: `span_${traceId}`,
        event_key: "page_view",
        event_version: "1",
        payload_format: "json",
        payload_encoding: "raw",
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: {},
        qa_session_id: sessionId,
      },
    ]),
  );
}

describe("processPhaseTwoTask", () => {
  it("skips reconstruction for already reconstructed traces and enqueues verdict", async () => {
    const deps = createWorkerDeps();
    const logger = createLoggerMock();
    const taskQueue = {
      close: vi.fn(),
      enqueue: vi.fn().mockResolvedValue(undefined),
      process: vi.fn(),
    };
    await seedPendingTrace(deps, "trace_done");
    await deps.traceStore.markReconstructed("trace_done");
    const findByTraceIdSpy = vi.spyOn(deps.recordStore, "findByTraceId");

    await processPhaseTwoTask(buildReconstructionTask("trace_done"), {
      ...deps,
      logger,
      taskQueue,
    });

    expect(findByTraceIdSpy).not.toHaveBeenCalled();
    expect(taskQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "verdict",
        traceId: "trace_done",
      }),
      PHASE_TWO_TASK_QUEUE_OPTIONS,
    );
    expect(logger.info).toHaveBeenCalledWith(
      {
        phase: "reconstruction",
        traceId: "trace_done",
      },
      "phase-two job started",
    );
    expect(logger.info).toHaveBeenCalledWith(
      {
        traceId: "trace_done",
      },
      "skipping reconstruction for already reconstructed trace",
    );
    expect(logger.info).toHaveBeenCalledWith(
      {
        phase: "reconstruction",
        traceId: "trace_done",
      },
      "phase-two job completed",
    );
  });

  it("computes a verdict for verdict jobs", async () => {
    const deps = createWorkerDeps();
    await seedVerdictPrerequisites(deps, "trace_verdict");

    await processPhaseTwoTask(buildVerdictTask("trace_verdict"), deps);

    await expect(deps.verdictStore.findByTraceId("trace_verdict")).resolves.toEqual([
      expect.objectContaining({
        overallVerdict: "pass",
        scenarioId: "scenario_001",
        traceId: "trace_verdict",
      }),
    ]);
  });

  it("logs and rethrows job failures", async () => {
    const deps = createWorkerDeps();
    const logger = createLoggerMock();
    await seedPendingTrace(deps, "trace_fail");
    vi.spyOn(deps.graphStore, "upsert").mockRejectedValue(new Error("boom"));

    await expect(
      processPhaseTwoTask(buildReconstructionTask("trace_fail"), {
        ...deps,
        logger,
      }),
    ).rejects.toThrow("boom");
    expect(logger.error).toHaveBeenCalledWith(
      {
        err: expect.any(Error),
        phase: "reconstruction",
        traceId: "trace_fail",
      },
      "phase-two job failed",
    );
  });
});

describe("registerTaskQueueWorker", () => {
  it("chains reconstruction jobs into verdict jobs on the same queue", async () => {
    const deps = createWorkerDeps();
    const taskQueue = new InMemoryTaskQueue<TaskPayload>();
    await seedPendingTrace(deps, "trace_chain");
    await deps.sessionStore.upsert({
      sessionId: "session_001",
      scenarioId: "scenario_chain",
    });
    await deps.scenarioSpecStore.upsert({
      scenario_id: "scenario_chain",
      version: "1.0.0",
      domain: "checkout",
      steps: [
        {
          id: "step_1",
          event_key: "page_view",
          required: true,
          kind: "sequence",
        },
      ],
    });

    await registerTaskQueueWorker(taskQueue, {
      ...deps,
      logger: createLoggerMock(),
    });

    await taskQueue.enqueue(
      buildReconstructionTask("trace_chain"),
      PHASE_TWO_TASK_QUEUE_OPTIONS,
    );

    await expect(deps.traceStore.findById("trace_chain")).resolves.toEqual(
      expect.objectContaining({
        reconstructed: true,
        traceId: "trace_chain",
      }),
    );
    await expect(deps.verdictStore.findByTraceId("trace_chain")).resolves.toEqual([
      expect.objectContaining({
        overallVerdict: "pass",
        scenarioId: "scenario_chain",
        traceId: "trace_chain",
      }),
    ]);
  });
});
