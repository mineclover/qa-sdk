import { describe, it, expect } from "vitest";
import {
  toSafetyDecisionView, toResourceDecisionView, toAlertEventView, toAuditTraceView,
  type SafetyDecisionRecordInput, type ResourceDecisionRecordInput, type AlertEventRecordInput,
} from "./conversion.js";

const ID = "01HXYZ0000000000000000", AT = "2026-05-02T10:00:00.000Z";
const safety: SafetyDecisionRecordInput = {
  decisionId: `sim.dec.safety.${ID}`, cycleId: `sim.cyc.${ID}`, cycleAt: AT,
  pass: "safety", verdict: "promote", triggerSignals: [], confidence: 0.92,
  categoryVerdicts: { perf: "PASS", compatibility: "PASS", decisionQuality: "PASS", auditSafety: "PASS", replicationHealth: "PASS" },
  evidence: [{ kind: "data", source: "metrics:perf", content: { ok: true }, weight: 1 }],
  action: { kind: "weight-update", revision: 2, weight: 25 },
};
const resource: ResourceDecisionRecordInput = {
  decisionId: `sim.dec.resource.${ID}`, cycleId: safety.cycleId, cycleAt: "2026-05-02T10:00:30.000Z",
  pass: "resource", verdict: "rejected", rejectedBy: "resourceHeadroom",
  triggerSignals: ["resourceHeadroom"], confidence: 0.81,
  categoryVerdicts: { loadPressure: "FAIL", resourceHeadroom: "FAIL", stability: "PASS" },
  evidence: [], action: { kind: "rejected", reason: "resourceHeadroom FAIL" },
};
const alert: AlertEventRecordInput = {
  cycleId: safety.cycleId, kind: "scale-rejected", occurredAt: "2026-05-02T10:00:30.500Z",
  details: { rejectedBy: "resourceHeadroom" }, internalSeq: 17,
};

describe("conversion (sim-decision-view §4)", () => {
  it("4 view 변환: 필드 보존 + evidence/internalSeq drop + audit trace 합성/undefined", () => {
    const s = toSafetyDecisionView(safety), r = toResourceDecisionView(resource), a = toAlertEventView(alert);
    expect(s.action).toEqual({ kind: "weight-update", revision: 2, weight: 25 });
    expect(r.rejectedBy).toBe("resourceHeadroom");
    expect(a.kind).toBe("scale-rejected");
    for (const v of [s, r]) expect((v as unknown as { evidence?: unknown }).evidence).toBeUndefined();
    expect((a as unknown as { internalSeq?: unknown }).internalSeq).toBeUndefined();
    const t = toAuditTraceView({ cycleId: safety.cycleId, cycleAt: AT, safety, resource, events: [alert] });
    expect(t.decisions.safety?.verdict).toBe("promote");
    expect(t.decisions.resource?.verdict).toBe("rejected");
    expect(t.events).toHaveLength(1);
    const t2 = toAuditTraceView({ cycleId: safety.cycleId, cycleAt: AT, safety: undefined, resource: undefined, events: [] });
    expect(t2.decisions.safety).toBeUndefined();
    expect(t2.decisions.resource).toBeUndefined();
  });
});
