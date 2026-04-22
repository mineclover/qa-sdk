import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario7BitmapRefresh } from "./scenario-7-bitmap-refresh.js";
import type { InProcessHandle } from "../env/in-process-env.js";

const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)("Scenario 7 — bitmap refresh", () => {
  let handle: InProcessHandle;
  beforeAll(async () => {
    const { bootstrapInProcess } = await import("../env/in-process-env.js");
    // 짧은 TTL 로 bootstrap
    handle = await bootstrapInProcess({
      jwtSecret: "x".repeat(32),
      jwtTtlSeconds: 2,
      dialect: "sqlite",
    });
    const g = globalThis as unknown as {
      __simGatewayFetch: typeof handle.gatewayFetch;
      __simHandle: typeof handle;
    };
    g.__simGatewayFetch = handle.gatewayFetch;
    g.__simHandle = handle;
  }, 60_000);
  afterAll(async () => {
    if (handle) await handle.cleanup();
  });

  it("scenario 7 통과", async () => {
    const result = await runScenario(scenario7BitmapRefresh, {
      gatewayUrl: "http://sim-inproc",
      mode: "in-process",
    });
    if (result.status !== "passed") {
      console.error("[Scenario 7 실패]", result.error);
    }
    expect(result.status).toBe("passed");
  }, 60_000);
});
