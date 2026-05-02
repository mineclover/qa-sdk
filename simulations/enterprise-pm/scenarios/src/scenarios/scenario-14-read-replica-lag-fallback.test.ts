// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { describe, expect, it } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario14ReadReplicaLagFallback } from "./scenario-14-read-replica-lag-fallback.js";

const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)("Scenario 14 — read replica lag + primary fallback", () => {
  it(
    "scenario 14 통과 (in-process)",
    async () => {
      const result = await runScenario(scenario14ReadReplicaLagFallback, {
        gatewayUrl: "http://sim-gateway-inproc",
        mode: "in-process",
      });
      if (result.status !== "passed") {
        console.error("[Scenario 14 실패]", result.error);
      }
      expect(result.status).toBe("passed");
    },
    60_000,
  );
});

describe("Scenario 14 — static check", () => {
  it("scenario object has required fields", () => {
    expect(scenario14ReadReplicaLagFallback.name).toBe(
      "scenario-14-read-replica-lag-fallback",
    );
    expect(scenario14ReadReplicaLagFallback.validates.length).toBeGreaterThan(0);
    expect(typeof scenario14ReadReplicaLagFallback.setup).toBe("function");
    expect(typeof scenario14ReadReplicaLagFallback.act).toBe("function");
    expect(typeof scenario14ReadReplicaLagFallback.assert).toBe("function");
    expect(typeof scenario14ReadReplicaLagFallback.teardown).toBe("function");
  });
});
