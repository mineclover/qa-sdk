// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// 시나리오 11 — v2가 stage skip → audit critical anomaly 발생.
// 단언: Pass1 rollback (hard), trigger=auditSafety, weight=0, anomaly 1건 audit-recorder 기록.
// spec 01 §2 hard rule(`auditSafety.criticalAnomalyRate > 0`) + CON-005 검증.
// Plan B fault-injector `audit-anomaly`로 stage-skip 패턴 1회 주입.

import { equal, ok } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import {
  getAuditFetcher,
  waitForCycles,
  type SafetyDecisionRecordView,
} from "../lib/audit-fetcher.js";
import {
  assertSafetyVerdict,
  assertTriggerCategory,
  assertSingleDecisionPerCyclePass,
} from "../lib/assertions/decision-assertions.js";

interface S11Ctx {
  faultHandle: { off: () => Promise<void> };
}

export const scenario11CanaryRollbackAuditSpike: Scenario<S11Ctx> = {
  name: "scenario-11-canary-rollback-audit-spike",
  description: "v2 stage skip → audit critical anomaly → hard rollback",
  validates: [
    "spec 01 §2 hard rule (auditSafety.criticalAnomalyRate > 0)",
    "CON-005 critical anomaly → auto observation",
    "audit anomaly count = 1",
  ],

  async setup() {
    const inj = (
      globalThis as unknown as {
        __simFaultInjector?: {
          auditAnomaly: { on: () => Promise<{ off: () => Promise<void> }> };
        };
      }
    ).__simFaultInjector;
    if (!inj) throw new Error("__simFaultInjector not bound");
    const faultHandle = await inj.auditAnomaly.on();
    return { faultHandle };
  },

  async act() {
    const cycleIds = await waitForCycles(2, 30_000);
    return { data: { cycleIds }, traceIds: [], stepCount: cycleIds.length };
  },

  async assert(_ctx, actResult) {
    const cycleIds = actResult.data.cycleIds as string[];
    const audit = getAuditFetcher();
    assertSingleDecisionPerCyclePass(await audit.queryDecisions({ cycleIds }));

    const first = (await audit.queryFirstDecision({
      pass: "safety",
      cycleIds,
    })) as SafetyDecisionRecordView | null;
    ok(first, "first safety decision must exist");

    assertSafetyVerdict(first, {
      verdict: "rollback",
      triggerCategory: "auditSafety",
      categoryVerdicts: { auditSafety: "FAIL" },
    });
    assertTriggerCategory(first, "auditSafety");

    // action 보강 단언 — rollback weight=0.
    ok(
      first.action?.kind === "weight-update",
      "rollback action must be weight-update",
    );
    if (first.action.kind === "weight-update") {
      equal(
        first.action.weight,
        0,
        `rollback weight must be 0, got ${first.action.weight}`,
      );
    }

    ok(
      first.triggerSignals.includes("auditSafety.criticalAnomalyRate"),
      "triggerSignals must include auditSafety.criticalAnomalyRate",
    );

    // anomaly 1건 — audit-recorder anomaly classification 기록.
    const anomalyCount = await audit.countAlerts({
      cycleIds,
      kind: "audit-critical-anomaly",
    });
    equal(anomalyCount, 1, `expected exactly 1 anomaly, got ${anomalyCount}`);
  },

  async teardown(ctx) {
    await ctx.faultHandle.off();
  },
};
