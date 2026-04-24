import { describe, expect, it } from "vitest";
import { ALL_SCENARIOS, buildCli, formatScenarioResult } from "./cli.js";

describe("sim-scenarios CLI", () => {
  it("ALL_SCENARIOS — Plan 13d 시점에 8건 (전체)", () => {
    expect(ALL_SCENARIOS).toHaveLength(8);
    expect(ALL_SCENARIOS.map((s) => s.name)).toEqual([
      "scenario-1-login",
      "scenario-2-project-create",
      "scenario-3-self-dept-approval",
      "scenario-4-cross-dept-deny",
      "scenario-5-three-stage-approval",
      "scenario-6-delegated-resource",
      "scenario-7-bitmap-refresh",
      "scenario-8-pubsub-invalidation",
    ]);
  });

  it("buildCli — list / run / density / audit / housekeeping 명령어 등록", () => {
    const cmd = buildCli();
    const cmdNames = cmd.commands.map((c) => c.name());
    expect(cmdNames).toContain("run");
    expect(cmdNames).toContain("list");
    expect(cmdNames).toContain("density");
    expect(cmdNames).toContain("audit");
    expect(cmdNames).toContain("housekeeping");
  });

  it("scenario.validates — design.md §4 매트릭스 컬럼 추적", () => {
    const s1 = ALL_SCENARIOS[0];
    expect(s1.validates).toContain("VersionedBitmap issuance");
  });

  it("formatScenarioResult — summary/traces/operator block 렌더링", () => {
    const text = formatScenarioResult({
      name: "scenario-4-cross-dept-deny",
      status: "passed",
      durationMs: 123,
      stepCount: 4,
      traceIds: ["t1", "t2"],
      operatorHints: [
        "deny-trace: pnpm --filter @qa-sdk/sim-scenarios start -- audit trace --root-span-id root-1",
      ],
    });

    expect(text).toContain("[OK] scenario-4-cross-dept-deny");
    expect(text).toContain("summary: passed, 123ms, 4 step");
    expect(text).toContain("traces: 2 (t1, t2)");
    expect(text).toContain("operator.1:");
  });
});
