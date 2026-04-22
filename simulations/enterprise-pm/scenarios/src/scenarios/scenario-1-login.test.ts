import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario1Login } from "./scenario-1-login.js";
import type { InProcessHandle } from "../env/in-process-env.js";

const SECRET = "x".repeat(32);
const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)("Scenario 1 — login + bitmap 발행", () => {
  let handle: InProcessHandle;
  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    const { bootstrapInProcess } = await import("../env/in-process-env.js");
    handle = await bootstrapInProcess({ jwtSecret: SECRET, dialect: "sqlite" });
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

  it("scenario 1 통과 (in-process)", async () => {
    const result = await runScenario(scenario1Login, {
      gatewayUrl: "http://sim-gateway-inproc",
      mode: "in-process",
    });
    if (result.status !== "passed") {
      console.error("[Scenario 1 실패]", result.error);
    }
    expect(result.status).toBe("passed");
    expect(result.stepCount).toBeGreaterThanOrEqual(1);
  }, 30_000);
});
