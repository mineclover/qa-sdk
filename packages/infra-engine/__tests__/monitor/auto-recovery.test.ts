import { describe, it, expect, vi } from "vitest";
import { createAutoRecovery } from "../../src/monitor/auto-recovery.js";
import type { SyncCheckResult } from "../../src/monitor/sync-loop.js";

function makeResult(
  overrides?: Partial<SyncCheckResult>,
): SyncCheckResult {
  return {
    serviceId: "test-svc",
    previousStatus: "Synced",
    currentStatus: "OutOfSync",
    changed: true,
    checkedAt: "2026-04-23T00:00:00.000Z",
    latency: 123,
    detail: "500",
    ...overrides,
  };
}

describe("createAutoRecovery", () => {
  it("OutOfSync면 onTrigger 호출", async () => {
    const onTrigger = vi.fn(async () => true);
    const onEscalate = vi.fn();
    const recovery = createAutoRecovery({
      maxRetries: 3,
      cooldownMs: 1000,
      onTrigger,
      onEscalate,
    });

    await recovery.evaluate([makeResult()]);

    expect(onTrigger).toHaveBeenCalledWith("test-svc", 1);
    expect(onEscalate).not.toHaveBeenCalled();
  });

  it("Synced면 상태를 리셋", async () => {
    const onTrigger = vi.fn(async () => false);
    const recovery = createAutoRecovery({
      maxRetries: 3,
      cooldownMs: 0,
      onTrigger,
      onEscalate: vi.fn(),
    });

    await recovery.evaluate([makeResult()]);
    expect(recovery.getState().get("test-svc")?.attempts).toBe(1);

    await recovery.evaluate([
      makeResult({ currentStatus: "Synced", previousStatus: "OutOfSync" }),
    ]);
    expect(recovery.getState().has("test-svc")).toBe(false);
  });

  it("cooldown 안에서는 재시도하지 않음", async () => {
    const onTrigger = vi.fn(async () => false);
    const recovery = createAutoRecovery({
      maxRetries: 3,
      cooldownMs: 60_000,
      onTrigger,
      onEscalate: vi.fn(),
    });

    await recovery.evaluate([makeResult()]);
    await recovery.evaluate([makeResult()]);

    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("최대 재시도 초과 후 에스컬레이션", async () => {
    const onTrigger = vi.fn(async () => false);
    const onEscalate = vi.fn();
    const recovery = createAutoRecovery({
      maxRetries: 1,
      cooldownMs: 0,
      onTrigger,
      onEscalate,
    });

    await recovery.evaluate([makeResult()]);
    await recovery.evaluate([makeResult()]);

    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(onEscalate).toHaveBeenCalledWith("test-svc", 1);
  });
});
