// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { describe, expect, it } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario17PassPriorityCanaryBlocksScale } from "./scenario-17-pass-priority-canary-blocks-scale.js";

const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)(
  "Scenario 17 — pass priority canary blocks scale (Pass 1 hold → Pass 2 SKIP)",
  () => {
    it(
      "scenario 17 통과 (in-process)",
      async () => {
        const result = await runScenario(
          scenario17PassPriorityCanaryBlocksScale,
          {
            gatewayUrl: "http://sim-gateway-inproc",
            mode: "in-process",
          },
        );
        if (result.status !== "passed") {
          console.error("[Scenario 17 실패]", result.error);
        }
        expect(result.status).toBe("passed");
      },
      60_000,
    );
  },
);

describe("Scenario 17 — static check", () => {
  it("scenario object has required fields", () => {
    expect(scenario17PassPriorityCanaryBlocksScale.name).toBe(
      "scenario-17-pass-priority-canary-blocks-scale",
    );
    expect(
      scenario17PassPriorityCanaryBlocksScale.validates.length,
    ).toBeGreaterThan(0);
    expect(typeof scenario17PassPriorityCanaryBlocksScale.setup).toBe(
      "function",
    );
    expect(typeof scenario17PassPriorityCanaryBlocksScale.act).toBe("function");
    expect(typeof scenario17PassPriorityCanaryBlocksScale.assert).toBe(
      "function",
    );
    expect(typeof scenario17PassPriorityCanaryBlocksScale.teardown).toBe(
      "function",
    );
  });
});
