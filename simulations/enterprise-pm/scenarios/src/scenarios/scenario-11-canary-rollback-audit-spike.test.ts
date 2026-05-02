// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { describe, expect, it } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario11CanaryRollbackAuditSpike } from "./scenario-11-canary-rollback-audit-spike.js";

const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)(
  "Scenario 11 — canary rollback (audit critical anomaly)",
  () => {
    it(
      "scenario 11 통과 (in-process)",
      async () => {
        const result = await runScenario(scenario11CanaryRollbackAuditSpike, {
          gatewayUrl: "http://sim-gateway-inproc",
          mode: "in-process",
        });
        if (result.status !== "passed") {
          console.error("[Scenario 11 실패]", result.error);
        }
        expect(result.status).toBe("passed");
        expect(result.stepCount).toBeGreaterThanOrEqual(1);
      },
      60_000,
    );
  },
);

describe("Scenario 11 — static check", () => {
  it("scenario object has required fields", () => {
    expect(scenario11CanaryRollbackAuditSpike.name).toBe(
      "scenario-11-canary-rollback-audit-spike",
    );
    expect(scenario11CanaryRollbackAuditSpike.validates.length).toBeGreaterThan(
      0,
    );
    expect(typeof scenario11CanaryRollbackAuditSpike.setup).toBe("function");
    expect(typeof scenario11CanaryRollbackAuditSpike.act).toBe("function");
    expect(typeof scenario11CanaryRollbackAuditSpike.assert).toBe("function");
    expect(typeof scenario11CanaryRollbackAuditSpike.teardown).toBe("function");
  });
});
