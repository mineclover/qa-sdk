import { describe, expect, it } from "vitest";
import { ALL_SCENARIOS, buildCli } from "./cli.js";

describe("sim-scenarios CLI", () => {
  it("ALL_SCENARIOS — Plan 13c 시점에 6건 (1~6)", () => {
    expect(ALL_SCENARIOS).toHaveLength(6);
    expect(ALL_SCENARIOS.map((s) => s.name)).toContain(
      "scenario-5-three-stage-approval",
    );
    expect(ALL_SCENARIOS.map((s) => s.name)).toContain(
      "scenario-6-delegated-resource",
    );
  });

  it("buildCli — list / run 명령어 등록", () => {
    const cmd = buildCli();
    const cmdNames = cmd.commands.map((c) => c.name());
    expect(cmdNames).toContain("run");
    expect(cmdNames).toContain("list");
  });

  it("scenario.validates — design.md §4 매트릭스 컬럼 추적", () => {
    const s1 = ALL_SCENARIOS[0];
    expect(s1.validates).toContain("VersionedBitmap issuance");
  });
});
