import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario6DelegatedResource } from "./scenario-6-delegated-resource.js";
import type { InProcessHandle } from "../env/in-process-env.js";

const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)("Scenario 6 — DELEGATED resource", () => {
  let handle: InProcessHandle;
  beforeAll(async () => {
    const { bootstrapInProcess } = await import("../env/in-process-env.js");
    handle = await bootstrapInProcess({
      jwtSecret: "x".repeat(32),
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

  it("scenario 6 통과", async () => {
    const result = await runScenario(scenario6DelegatedResource, {
      gatewayUrl: "http://sim-inproc",
      mode: "in-process",
    });
    if (result.status !== "passed") {
      console.error("[Scenario 6 실패]", result.error);
    }
    expect(result.status).toBe("passed");
  }, 30_000);
});
