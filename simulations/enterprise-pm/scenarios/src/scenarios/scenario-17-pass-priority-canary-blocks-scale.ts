// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// 시나리오 17 — 카나리 진행 중(weight=25 dwellTime 미충족, perf WARN) +
// RPS 폭증 동시 — Plan B fault-injector perf.warn + RPS burst 동시 활성화.
// 단언: Pass 1 = hold (perf=WARN), Pass 2 SKIP (decisions.filter(pass=resource).length === 0).
// audit evidence에 SKIP 사유 기록 — evidence.find(source="pass-priority-skip")?.content === "pass1-not-promote-or-stable".
// spec 01 §4 "Pass 1이 promote/stable이 아니면 SKIP" 분기.

import { equal, ok } from 'node:assert/strict';
import type { Scenario } from '../runner/types.js';
import {
  getAuditFetcher,
  waitForCycles,
  type ResourceDecisionRecordView,
  type SafetyDecisionRecordView,
} from '../lib/audit-fetcher.js';
import { assertSafetyVerdict } from '../lib/assertions/decision-assertions.js';

interface S17Ctx {
  perfHandle: { off: () => Promise<void> };
  burstHandle: { stop: () => Promise<void> };
}

export const scenario17PassPriorityCanaryBlocksScale: Scenario<S17Ctx> = {
  name: 'scenario-17-pass-priority-canary-blocks-scale',
  description: '카나리 진행 중 perf WARN + RPS burst → Pass 1 hold + Pass 2 SKIP',
  validates: [
    'spec 01 §4 Pass 1이 promote/stable이 아니면 Pass 2 SKIP',
    'audit evidence에 SKIP 사유 기록',
  ],

  async setup() {
    const inj = (
      globalThis as unknown as {
        __simFaultInjector?: {
          perfWarn: { on: () => Promise<{ off: () => Promise<void> }> };
        };
      }
    ).__simFaultInjector;
    if (!inj) throw new Error('__simFaultInjector not bound');
    const perfHandle = await inj.perfWarn.on();

    const burst = (
      globalThis as unknown as {
        __simBurstLoad?: (rps: number) => Promise<{ stop: () => Promise<void> }>;
      }
    ).__simBurstLoad;
    if (!burst) throw new Error('__simBurstLoad not bound');
    const burstHandle = await burst(200);

    return { perfHandle, burstHandle };
  },

  async act() {
    const cycleIds = await waitForCycles(2, 30_000);
    return { data: { cycleIds }, traceIds: [], stepCount: cycleIds.length };
  },

  async assert(_ctx, actResult) {
    const cycleIds = actResult.data.cycleIds as string[];
    const audit = getAuditFetcher();
    const decisions = await audit.queryDecisions({ cycleIds });

    const safety = decisions.filter((d): d is SafetyDecisionRecordView => d.pass === 'safety');
    ok(safety.length >= 1, 'expected at least 1 safety decision');

    const first = safety[0];
    assertSafetyVerdict(first, {
      verdict: 'hold',
      categoryVerdicts: { perf: 'WARN' },
    });

    // Pass 2 SKIP — resource 결정 record 0건.
    const resourceDecisions = decisions.filter(
      (d): d is ResourceDecisionRecordView => d.pass === 'resource',
    );
    equal(
      resourceDecisions.length,
      0,
      `Pass 2 must SKIP when Pass 1 != promote/stable, got ${resourceDecisions.length} resource decisions`,
    );

    // SKIP 사유 evidence — pass-priority-skip source.
    const skipEvidence = first.evidence.find((e) => e.source === 'pass-priority-skip');
    ok(skipEvidence, 'expected pass-priority-skip evidence on hold safety');
    equal(
      skipEvidence.content,
      'pass1-not-promote-or-stable',
      `evidence content mismatch, got ${JSON.stringify(skipEvidence.content)}`,
    );
  },

  async teardown(ctx) {
    await ctx.burstHandle.stop();
    await ctx.perfHandle.off();
  },
};
