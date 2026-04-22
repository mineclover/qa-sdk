import { describe, expect, it } from "vitest";
import { ALL_SCENARIOS, buildCli } from "./cli.js";

describe("sim-scenarios CLI", () => {
  it("ALL_SCENARIOS — Plan 13b 시점에 4건 (1~4)", () => {
    expect(ALL_SCENARIOS).toHaveLength(4);
    expect(ALL_SCENARIOS.map((s) => s.name)).toEqual([
      "scenario-1-login",
      "scenario-2-project-create",
      "scenario-3-self-dept-approval",
      "scenario-4-cross-dept-deny",
    ]);
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
