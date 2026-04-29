// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// 시나리오 13 — Plan B fault-injector dbPool.tighten(pool=4) + RPS burst →
// 동시 요청 ≥4 지속으로 resourceHeadroom.dbPoolUtilization FAIL.
// 단언: Pass 2 verdict=rejected, rejectedBy=resourceHeadroom, replica 변동 0,
// audit.countAlerts({ kind: "scale-rejected" }) === 1.
// spec 01 §4 분기: loadPressure=FAIL ∧ resourceHeadroom=FAIL → rejected.

import { equal, ok } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import {
  getAuditFetcher,
  waitForCycles,
  type ResourceDecisionRecordView,
} from "../lib/audit-fetcher.js";
import { assertResourceVerdict } from "../lib/assertions/decision-assertions.js";

interface S13Ctx {
  poolHandle: { off: () => Promise<void> };
  burstHandle: { stop: () => Promise<void> };
  initialReplicas: { v1: number; v2: number };
}

export const scenario13ScaleBlockedByDbPool: Scenario<S13Ctx> = {
  name: "scenario-13-scale-blocked-by-db-pool",
  description:
    "DB pool 압박 + RPS burst → Pass 2 rejected (resourceHeadroom) + replica 불변",
  validates: [
    "spec 01 §4 분기 (loadPressure=FAIL ∧ resourceHeadroom=FAIL → rejected)",
    "rejectedBy=resourceHeadroom",
    "replica 변동 0",
    "audit alert 1건 (scale-rejected)",
  ],

  async setup() {
    const inj = (
      globalThis as unknown as {
        __simFaultInjector?: {
          dbPool: {
            tighten: (pool: number) => Promise<{ off: () => Promise<void> }>;
          };
        };
      }
    ).__simFaultInjector;
    if (!inj) throw new Error("__simFaultInjector not bound");
    const poolHandle = await inj.dbPool.tighten(4);

    const ch = (
      globalThis as unknown as {
        __simComposeHandle?: {
          getReplicas(): Promise<{ v1: number; v2: number }>;
        };
      }
    ).__simComposeHandle;
    if (!ch) throw new Error("__simComposeHandle not bound");
    const initialReplicas = await ch.getReplicas();

    const burst = (
      globalThis as unknown as {
        __simBurstLoad?: (rps: number) => Promise<{ stop: () => Promise<void> }>;
      }
    ).__simBurstLoad;
    if (!burst) throw new Error("__simBurstLoad not bound");
    const burstHandle = await burst(200);

    return { poolHandle, burstHandle, initialReplicas };
  },

  async act() {
    const cycleIds = await waitForCycles(2, 30_000);
    return { data: { cycleIds }, traceIds: [], stepCount: cycleIds.length };
  },

  async assert(ctx, actResult) {
    const cycleIds = actResult.data.cycleIds as string[];
    const audit = getAuditFetcher();

    const first = (await audit.queryFirstDecision({
      pass: "resource",
      cycleIds,
    })) as ResourceDecisionRecordView | null;
    ok(first, "first resource decision must exist");

    assertResourceVerdict(first, {
      verdict: "rejected",
      rejectedBy: "resourceHeadroom",
    });

    // replica 변동 0 — rejected 시 scale 명령 미발행.
    const ch = (
      globalThis as unknown as {
        __simComposeHandle: {
          getReplicas(): Promise<{ v1: number; v2: number }>;
        };
      }
    ).__simComposeHandle;
    const after = await ch.getReplicas();
    equal(after.v1, ctx.initialReplicas.v1, "v1 replica must not change");
    equal(after.v2, ctx.initialReplicas.v2, "v2 replica must not change");

    // alert 1건 — audit-recorder scale-rejected.
    const alertCount = await audit.countAlerts({
      cycleIds,
      kind: "scale-rejected",
    });
    equal(alertCount, 1, `expected exactly 1 scale-rejected alert, got ${alertCount}`);
  },

  async teardown(ctx) {
    await ctx.burstHandle.stop();
    await ctx.poolHandle.off();
  },
};
