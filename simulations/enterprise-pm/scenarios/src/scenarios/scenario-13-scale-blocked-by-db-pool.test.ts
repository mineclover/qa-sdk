// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { describe, expect, it } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario13ScaleBlockedByDbPool } from "./scenario-13-scale-blocked-by-db-pool.js";

const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)("Scenario 13 — scale blocked by DB pool", () => {
  it(
    "scenario 13 통과 (in-process)",
    async () => {
      const result = await runScenario(scenario13ScaleBlockedByDbPool, {
        gatewayUrl: "http://sim-gateway-inproc",
        mode: "in-process",
      });
      if (result.status !== "passed") {
        console.error("[Scenario 13 실패]", result.error);
      }
      expect(result.status).toBe("passed");
    },
    60_000,
  );
});

describe("Scenario 13 — static check", () => {
  it("scenario object has required fields", () => {
    expect(scenario13ScaleBlockedByDbPool.name).toBe(
      "scenario-13-scale-blocked-by-db-pool",
    );
    expect(scenario13ScaleBlockedByDbPool.validates.length).toBeGreaterThan(0);
    expect(typeof scenario13ScaleBlockedByDbPool.setup).toBe("function");
    expect(typeof scenario13ScaleBlockedByDbPool.act).toBe("function");
    expect(typeof scenario13ScaleBlockedByDbPool.assert).toBe("function");
    expect(typeof scenario13ScaleBlockedByDbPool.teardown).toBe("function");
  });
});
