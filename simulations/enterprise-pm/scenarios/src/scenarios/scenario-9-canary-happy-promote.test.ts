// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { describe, expect, it } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario9CanaryHappyPromote } from "./scenario-9-canary-happy-promote.js";

// canary-controller in-process 부트스트랩 wrapper는 Plan E 후속 stage에서 wiring.
// 환경 미충족 시 정적 import만 검증 — runtime PASS는 sim-up 환경에서 실행.
const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)("Scenario 9 — canary happy promote (5→25→50→100)", () => {
  it(
    "scenario 9 통과 (in-process)",
    async () => {
      const result = await runScenario(scenario9CanaryHappyPromote, {
        gatewayUrl: "http://sim-gateway-inproc",
        mode: "in-process",
      });
      if (result.status !== "passed") {
        console.error("[Scenario 9 실패]", result.error);
      }
      expect(result.status).toBe("passed");
      expect(result.stepCount).toBeGreaterThanOrEqual(4);
    },
    180_000,
  );
});

// SKIP 모드에서도 정적 import 무결성은 검증.
describe("Scenario 9 — static check", () => {
  it("scenario object has required fields", () => {
    expect(scenario9CanaryHappyPromote.name).toBe(
      "scenario-9-canary-happy-promote",
    );
    expect(scenario9CanaryHappyPromote.validates.length).toBeGreaterThan(0);
    expect(typeof scenario9CanaryHappyPromote.setup).toBe("function");
    expect(typeof scenario9CanaryHappyPromote.act).toBe("function");
    expect(typeof scenario9CanaryHappyPromote.assert).toBe("function");
    expect(typeof scenario9CanaryHappyPromote.teardown).toBe("function");
  });
});
