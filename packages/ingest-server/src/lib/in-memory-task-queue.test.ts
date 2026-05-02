// @def.boundary ingest-system
// @def.doc ingest-system

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskPayload } from "@qa-sdk/core";
import { InMemoryTaskQueue } from "./in-memory-task-queue.js";

function buildTask(overrides: Partial<TaskPayload> = {}): TaskPayload {
  return {
    traceId: "trace_1",
    phase: "reconstruction",
    enqueuedAt: "2026-03-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("InMemoryTaskQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips tasks from enqueue to process", async () => {
    const queue = new InMemoryTaskQueue<TaskPayload>();
    const handled: TaskPayload[] = [];

    await queue.enqueue(buildTask());

    expect(handled).toEqual([]);

    await queue.process(async (task) => {
      handled.push(task);
    });

    expect(handled).toEqual([buildTask()]);
  });

  it("retries failed tasks using enqueue options", async () => {
    const queue = new InMemoryTaskQueue<TaskPayload>();
    let attempts = 0;

    await queue.process(async () => {
      attempts += 1;

      if (attempts === 1) {
        throw new Error("temporary failure");
      }
    });

    const enqueuePromise = queue.enqueue(buildTask(), {
      retryAttempts: 1,
      retryDelayMs: 25,
    });

    await vi.runAllTimersAsync();

    await expect(enqueuePromise).resolves.toBeUndefined();
    expect(attempts).toBe(2);
  });

  it("rejects enqueue after close", async () => {
    const queue = new InMemoryTaskQueue<TaskPayload>();

    await queue.process(async () => {});
    await queue.close();

    await expect(queue.enqueue(buildTask())).rejects.toThrow("TaskQueue is closed");
  });
});
