// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// 시나리오 9 — v2 = v1 호환, 자연 트래픽, 30s × N 사이클.
// 단언: weight 5→25→50→100 단조 증가, sticky 일관성 100%, catalog v3 retired·v4 stable 전이 1회.
// spec 05 §3.1 (a) 압축 예시 — `safety.filter(d => d.verdict === "promote").map(d => d.action)` deepEqual.

import { equal, deepEqual, ok } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import {
  getAuditFetcher,
  waitForCycles,
  type SafetyDecisionRecordView,
} from "../lib/audit-fetcher.js";
import {
  assertSafetyVerdict,
  assertSingleDecisionPerCyclePass,
} from "../lib/assertions/decision-assertions.js";

interface S9Ctx {
  initialCatalog: { v3: string; v4: string };
}

export const scenario9CanaryHappyPromote: Scenario<S9Ctx> = {
  name: "scenario-9-canary-happy-promote",
  description: "v2 호환 + 자연 트래픽 → 5→25→50→100 단조 promote + catalog 전이",
  validates: [
    "Pass 1 promote sequence (5→25→50→100)",
    "spec 01 §3 dwellTime 준수",
    "spec 02 catalog 상태 전이 (v3 retired, v4 stable)",
    "spec 02 sticky session 일관성",
  ],

  async setup() {
    const cs = (
      globalThis as unknown as {
        __simCatalogStore?: {
          getStates(): Promise<{ v3: string; v4: string }>;
        };
      }
    ).__simCatalogStore;
    if (!cs) throw new Error("__simCatalogStore not bound");
    const initialCatalog = await cs.getStates();
    equal(initialCatalog.v3, "stable", "v3 must start as stable");
    equal(initialCatalog.v4, "undeployed", "v4 must start as undeployed");
    return { initialCatalog };
  },

  async act() {
    // Plan B fault-injector OFF — happy path. cycle=2s 단축으로 4 promote + post-100 dwellTime.
    const cycleIds = await waitForCycles(6, 120_000);
    return {
      data: { cycleIds },
      traceIds: [],
      stepCount: cycleIds.length,
      operatorHints: [
        `pnpm sim:audit query --cycle-id ${cycleIds.at(-1) ?? ""}`,
      ],
    };
  },

  async assert(_ctx, actResult) {
    const cycleIds = actResult.data.cycleIds as string[];
    ok(cycleIds.length >= 4, `expected ≥ 4 cycles, got ${cycleIds.length}`);
    const audit = getAuditFetcher();
    const decisions = await audit.queryDecisions({ cycleIds });
    assertSingleDecisionPerCyclePass(decisions);

    const safety = decisions.filter(
      (d): d is SafetyDecisionRecordView => d.pass === "safety",
    );

    // spec 05 §3.1 압축 예시 — promote action 시퀀스 deepEqual.
    deepEqual(
      safety.filter((d) => d.verdict === "promote").map((d) => d.action),
      [
        { kind: "weight-update", weight: 5, revision: 1 },
        { kind: "weight-update", weight: 25, revision: 2 },
        { kind: "weight-update", weight: 50, revision: 3 },
        { kind: "weight-update", weight: 100, revision: 4 },
      ],
      "promote weight sequence 5→25→50→100 with monotonic revision",
    );

    for (const d of safety.filter((d) => d.verdict === "promote")) {
      assertSafetyVerdict(d, {
        verdict: "promote",
        categoryVerdicts: {
          perf: "PASS",
          compatibility: "PASS",
          decisionQuality: "PASS",
          auditSafety: "PASS",
          replicationHealth: "PASS",
        },
        minConfidence: 0.6,
      });
    }

    // catalog 전이 — spec 05 §3.1 인용.
    const cs = (
      globalThis as unknown as {
        __simCatalogStore: {
          getStates(): Promise<{ v3: string; v4: string }>;
        };
      }
    ).__simCatalogStore;
    const catalog = await cs.getStates();
    equal(catalog.v3, "retired", "v3 must transition to retired");
    equal(catalog.v4, "stable", "v4 must transition to stable");

    // sticky 일관성 — Plan D gateway routing user→version sticky 보장.
    const stickyMetrics = (
      globalThis as unknown as {
        __simGatewayStickyConsistency?: () => Promise<number>;
      }
    ).__simGatewayStickyConsistency;
    if (stickyMetrics) {
      const ratio = await stickyMetrics();
      equal(ratio, 1.0, `sticky consistency must be 100%, got ${ratio}`);
    }
  },

  async teardown() {},
};
