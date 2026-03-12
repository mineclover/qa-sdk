import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import {
  CLEANUP_INTERVAL_MS,
  installCleanupScheduler,
} from "./cleanup-scheduler.js";

describe("installCleanupScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does not schedule cleanup when disabled", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    const handle = installCleanupScheduler({
      enabled: false,
      runCleanup: vi.fn(async () => {}),
    });

    expect(handle).toBeNull();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it("runs cleanup every 24 hours and can stop the interval", async () => {
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
    } as unknown as Logger;
    const runCleanup = vi.fn(async () => {});
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const handle = installCleanupScheduler({
      enabled: true,
      logger,
      runCleanup,
    });

    expect(handle).not.toBeNull();
    expect(logger.info).toHaveBeenCalledWith(
      { intervalMs: CLEANUP_INTERVAL_MS },
      "scheduled expired data cleanup",
    );

    await vi.advanceTimersByTimeAsync(CLEANUP_INTERVAL_MS);
    expect(runCleanup).toHaveBeenCalledTimes(1);

    handle?.stop();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});
