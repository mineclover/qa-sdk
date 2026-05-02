// @def.boundary sim-canary-controller
// spec 2026-05-02 §8 — perf-warn fault (시나리오 17).
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.3
//
// 5 케이스:
//   (a) enable({severity:"warn"}) → isEnabled true
//   (b) enable({severity:"fail"}) → throw (현재 spec 은 "warn" 만 허용)
//   (c) disable() → isEnabled false
//   (d) applyTo("PASS") → "WARN" 격상
//   (e) applyTo("FAIL") → "FAIL" 보존 (격하 금지)

import { describe, it, expect, beforeEach } from "vitest";
import { PerfWarnFault } from "./perf-warn.js";

describe("PerfWarnFault (spec §8)", () => {
  let fault: PerfWarnFault;
  beforeEach(() => {
    fault = new PerfWarnFault();
  });

  it("(a) enable + isEnabled", async () => {
    await fault.enable({ severity: "warn" });
    expect(fault.isEnabled()).toBe(true);
    expect(fault.getParams()).toEqual({ severity: "warn" });
  });

  it("(b) rejects unsupported severity", async () => {
    await expect(fault.enable({ severity: "fail" })).rejects.toThrow(
      /severity must be "warn"/,
    );
  });

  it("(c) disable resets state", async () => {
    await fault.enable({ severity: "warn" });
    await fault.disable();
    expect(fault.isEnabled()).toBe(false);
    expect(fault.getParams()).toBeNull();
  });

  it("(d) applyTo upgrades PASS → WARN when enabled", async () => {
    // disabled → passthrough
    expect(fault.applyTo("PASS")).toBe("PASS");
    await fault.enable({ severity: "warn" });
    expect(fault.applyTo("PASS")).toBe("WARN");
  });

  it("(e) applyTo preserves FAIL and WARN", async () => {
    await fault.enable({ severity: "warn" });
    expect(fault.applyTo("FAIL")).toBe("FAIL");
    // WARN already → still WARN (no degradation)
    expect(fault.applyTo("WARN")).toBe("WARN");
  });
});
