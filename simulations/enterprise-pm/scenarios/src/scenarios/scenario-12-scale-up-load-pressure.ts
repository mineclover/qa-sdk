// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// 시나리오 12 — RPS 폭증(자체 generator).
// 단언: Pass2 scale-up trigger=loadPressure, target.v2 += 1, p95 회복(다음 사이클 PASS).
// spec 01 §4 Pass 2 분기(`loadPressure=FAIL ∧ resourceHeadroom≠FAIL → scale-up`,
// 카나리 진행 중 v2 우선) 검증.

import { equal, ok } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import {
  getAuditFetcher,
  waitForCycles,
  type ResourceDecisionRecordView,
  type SafetyDecisionRecordView,
} from "../lib/audit-fetcher.js";
import { assertResourceVerdict } from "../lib/assertions/decision-assertions.js";

interface S12Ctx {
  burstHandle: { stop: () => Promise<void> };
  initialReplicas: { v1: number; v2: number };
}

export const scenario12ScaleUpLoadPressure: Scenario<S12Ctx> = {
  name: "scenario-12-scale-up-load-pressure",
  description: "RPS 폭증 → Pass2 scale-up (v2 +=1) → 다음 사이클 p95 회복",
  validates: [
    "spec 01 §4 Pass 2 scale-up 분기 (loadPressure=FAIL ∧ resourceHeadroom≠FAIL)",
    "spec 01 §4 카나리 진행 중 v2 우선 증가",
    "p95 회복 다음 사이클 PASS",
  ],

  async setup() {
    const ch = (
      globalThis as unknown as {
        __simComposeHandle?: {
          getReplicas(): Promise<{ v1: number; v2: number }>;
        };
      }
    ).__simComposeHandle;
    if (!ch) throw new Error("__simComposeHandle not bound");
    const initialReplicas = await ch.getReplicas();

    // SIM_LOAD_RPS_THRESHOLD(=100) 초과로 RPS 200 burst.
    const burst = (
      globalThis as unknown as {
        __simBurstLoad?: (rps: number) => Promise<{ stop: () => Promise<void> }>;
      }
    ).__simBurstLoad;
    if (!burst) throw new Error("__simBurstLoad not bound");
    const burstHandle = await burst(200);
    return { burstHandle, initialReplicas };
  },

  async act() {
    // 첫 사이클 loadPressure=FAIL → scale-up. 둘째 사이클 replica 증가 후 p95 회복 PASS.
    const cycleIds = await waitForCycles(3, 60_000);
    return { data: { cycleIds }, traceIds: [], stepCount: cycleIds.length };
  },

  async assert(ctx, actResult) {
    const cycleIds = actResult.data.cycleIds as string[];
    const audit = getAuditFetcher();
    const decisions = await audit.queryDecisions({ cycleIds });

    // Pass 1이 rollback이면 Pass 2 SKIP — spec 01 §4. scale-up 검증을 위해 Pass 1 hold/promote만 허용.
    const safety = decisions.filter(
      (d): d is SafetyDecisionRecordView => d.pass === "safety",
    );
    ok(
      safety.every((d) => d.verdict === "promote" || d.verdict === "hold"),
      "Pass 1 must not be rollback (otherwise Pass 2 would SKIP)",
    );

    // 첫 scale-up Pass 2.
    const first = (await audit.queryFirstDecision({
      pass: "resource",
      cycleIds,
    })) as ResourceDecisionRecordView | null;
    ok(first, "first resource decision must exist");

    assertResourceVerdict(first, {
      verdict: "scale-up",
      target: { v1: ctx.initialReplicas.v1, v2: ctx.initialReplicas.v2 + 1 },
      triggerSignals: ["loadPressure.RPS"],
    });

    // 다음 사이클 — replica 증가 반영 후 loadPressure 회복.
    const resourceDecisions = decisions.filter(
      (d): d is ResourceDecisionRecordView => d.pass === "resource",
    );
    if (resourceDecisions.length >= 2) {
      const next = resourceDecisions[1];
      ok(
        next.categoryVerdicts.loadPressure !== "FAIL",
        `next cycle loadPressure must recover, got ${next.categoryVerdicts.loadPressure}`,
      );
    }

    // compose 실제 replica — 부수효과 보강 단언.
    const ch = (
      globalThis as unknown as {
        __simComposeHandle: {
          getReplicas(): Promise<{ v1: number; v2: number }>;
        };
      }
    ).__simComposeHandle;
    const after = await ch.getReplicas();
    equal(
      after.v2,
      ctx.initialReplicas.v2 + 1,
      "compose v2 replica must increase by 1",
    );
  },

  async teardown(ctx) {
    await ctx.burstHandle.stop();
  },
};
