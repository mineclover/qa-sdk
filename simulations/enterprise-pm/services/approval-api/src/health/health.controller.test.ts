import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller.js";

describe("sim-approval-api HealthController", () => {
  it("status=ok + service=sim-approval-api 반환", () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.status).toBe("ok");
    expect(res.service).toBe("sim-approval-api");
  });

  it("ownedPrefixes는 design.md §2 (sim.budget/resource/timeoff/expense)", () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.ownedPrefixes).toEqual(["sim.budget", "sim.resource", "sim.timeoff", "sim.expense"]);
  });

  it("ts는 ISO-8601 문자열", () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
