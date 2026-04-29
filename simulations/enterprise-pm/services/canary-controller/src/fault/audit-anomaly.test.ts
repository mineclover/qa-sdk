// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { describe, it, expect, beforeEach } from "vitest";
import {
  AuditAnomalyFault,
  type AuditAnomalyStore,
} from "./audit-anomaly.js";

class InMem implements AuditAnomalyStore {
  rows: Array<{ severity: string; reason: string; recordedAt: number }> = [];
  async appendAnomaly(r: (typeof this.rows)[number]) {
    this.rows.push(r);
  }
  async clearInjected() {
    this.rows = [];
  }
}

describe("AuditAnomalyFault (시나리오 #11)", () => {
  let s: InMem, f: AuditAnomalyFault;
  beforeEach(() => {
    s = new InMem();
    f = new AuditAnomalyFault(s, () => 1714291200000);
  });
  it("enable appends exactly 1 critical anomaly row", async () => {
    await f.enable({ reason: "stage-skip-detected" });
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]).toEqual({
      severity: "critical",
      reason: "stage-skip-detected",
      recordedAt: 1714291200000,
    });
  });
  it("repeated enable appends multiple rows (append-only) + disable clears", async () => {
    await f.enable({ reason: "first" });
    await f.enable({ reason: "second" });
    expect(s.rows).toHaveLength(2);
    await f.disable();
    expect(s.rows).toHaveLength(0);
  });
  it("rejects enable without reason", async () => {
    await expect(f.enable({})).rejects.toThrow();
  });
});
