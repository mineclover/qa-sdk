// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { describe, it, expect, beforeEach } from "vitest";
import { FaultInjector } from "./fault-injector.js";
import type { Fault, FaultKind } from "./types.js";

class StubFault implements Fault {
  enabled = false;
  lastParams: unknown = null;
  resetCount = 0;
  async enable(p: unknown) {
    this.enabled = true;
    this.lastParams = p;
  }
  async disable() {
    this.enabled = false;
  }
  async reset() {
    this.enabled = false;
    this.resetCount += 1;
  }
}

describe("FaultInjector registry", () => {
  let a: StubFault, b: StubFault, inj: FaultInjector;
  beforeEach(() => {
    a = new StubFault();
    b = new StubFault();
    inj = new FaultInjector({
      "schema-break": a,
      "audit-anomaly": b,
    } as Record<FaultKind, Fault>);
  });
  it("enable routes params to matching fault only", async () => {
    await inj.enable("schema-break", { fieldName: "x" });
    expect(a.enabled).toBe(true);
    expect(a.lastParams).toEqual({ fieldName: "x" });
    expect(b.enabled).toBe(false);
  });
  it("disable leaves other faults untouched", async () => {
    await inj.enable("schema-break", {});
    await inj.enable("audit-anomaly", {});
    await inj.disable("schema-break");
    expect(a.enabled).toBe(false);
    expect(b.enabled).toBe(true);
  });
  it("resetAll invokes reset on every fault exactly once", async () => {
    await inj.resetAll();
    expect(a.resetCount).toBe(1);
    expect(b.resetCount).toBe(1);
  });
  it("rejects unknown FaultKind", async () => {
    await expect(inj.enable("nope" as FaultKind, {})).rejects.toThrow();
  });
});
