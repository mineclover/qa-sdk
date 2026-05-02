// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// 시나리오 10 — v2가 outbox에 신규 필수 필드 추가(호환 깨짐).
// 단언: 첫 사이클 내 Pass1 rollback (hard), trigger=compatibility, weight=0,
// audit에 책임 카테고리/신호 기록, v3 stable 유지.
// spec 01 §2 hard rule (`compatibility.schemaCompatRate < 1.0`) 즉시 FAIL을 검증하며
// Plan B fault-injector `schema-break`를 setup에서 활성화.

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

interface S10Ctx {
  faultHandle: { off: () => Promise<void> };
}

export const scenario10CanaryRollbackCompatibility: Scenario<S10Ctx> = {
  name: "scenario-10-canary-rollback-compatibility",
  description: "v2 schema 호환 깨짐 → Pass1 hard rollback + v3 stable 유지",
  validates: [
    "spec 01 §2 hard rule (compatibility.schemaCompatRate < 1.0)",
    "spec 01 §3 hard rollback first 분기",
    "audit-recorder triggerCategory + triggerSignals 기록",
  ],

  async setup() {
    const inj = (
      globalThis as unknown as {
        __simFaultInjector?: {
          schemaBreak: { on: () => Promise<{ off: () => Promise<void> }> };
        };
      }
    ).__simFaultInjector;
    if (!inj) throw new Error("__simFaultInjector not bound");
    const faultHandle = await inj.schemaBreak.on();
    return { faultHandle };
  },

  async act() {
    // hard rule이므로 첫 사이클 안에 rollback 발생. 2 cycle 대기로 충분.
    const cycleIds = await waitForCycles(2, 30_000);
    return { data: { cycleIds }, traceIds: [], stepCount: cycleIds.length };
  },

  async assert(_ctx, actResult) {
    const cycleIds = actResult.data.cycleIds as string[];
    ok(cycleIds.length >= 1, "expected at least 1 cycle");
    const audit = getAuditFetcher();
    assertSingleDecisionPerCyclePass(await audit.queryDecisions({ cycleIds }));

    const first = (await audit.queryFirstDecision({
      pass: "safety",
      cycleIds,
    })) as SafetyDecisionRecordView | null;
    ok(first, "first safety decision must exist");

    assertSafetyVerdict(first, {
      verdict: "rollback",
      triggerCategory: "compatibility",
      categoryVerdicts: { compatibility: "FAIL" },
    });
    // action 보강 단언 — rollback weight=0 invariant, revision은 monotonic counter 값.
    ok(first.action?.kind === "weight-update", "rollback action must be weight-update");
    if (first.action.kind === "weight-update") {
      equal(first.action.weight, 0, `rollback weight must be 0, got ${first.action.weight}`);
    }
    assertTriggerCategory(first, "compatibility");

    ok(
      first.triggerSignals.includes("compatibility.schemaCompatRate"),
      `triggerSignals must include compatibility.schemaCompatRate, got ${JSON.stringify(first.triggerSignals)}`,
    );

    // catalog v3 stable 유지 — rollback이므로 전이 금지.
    const cs = (
      globalThis as unknown as {
        __simCatalogStore: {
          getStates(): Promise<{ v3: string; v4: string }>;
        };
      }
    ).__simCatalogStore;
    const catalog = await cs.getStates();
    equal(catalog.v3, "stable", "v3 must remain stable on rollback");
  },

  async teardown(ctx) {
    await ctx.faultHandle.off();
  },
};
