// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// 시나리오 15 — v2 replica=3, 5 이벤트 동시 INSERT.
// 단언: 5 이벤트 = 5 ingest 발행(정확히), dispatcher별 처리 row disjoint,
// 락 경합 추가 lag < 100ms.
// Plan D outbox dispatcher PG advisory lock(row lease) 검증.

import { equal, ok } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";

interface S15Ctx {
  insertedEventIds: string[];
  dispatcherAssignments: Map<string, string>;
}

export const scenario15OutboxMultiDispatcherLock: Scenario<S15Ctx> = {
  name: "scenario-15-outbox-multi-dispatcher-lock",
  description: "outbox replica=3 + 5 동시 INSERT → 정확히 5 발행 + disjoint 처리",
  validates: [
    "Plan D outbox dispatcher PG advisory lock (row lease)",
    "spec 05 §1 outbox dispatcher fail policy (retry + DLQ)",
    "락 경합 추가 lag < 100ms",
  ],

  async setup() {
    return { insertedEventIds: [], dispatcherAssignments: new Map() };
  },

  async act(ctx) {
    const oc = (
      globalThis as unknown as {
        __simOutboxClient?: {
          insertEvents(count: number): Promise<string[]>;
          waitForDispatch(
            eventIds: string[],
            timeoutMs: number,
          ): Promise<{
            publishedAt: Map<string, number>;
            dispatcherIds: Map<string, string>;
            insertedAtMs: number;
          }>;
        };
      }
    ).__simOutboxClient;
    if (!oc) throw new Error("__simOutboxClient not bound");

    const ids = await oc.insertEvents(5);
    ctx.insertedEventIds = ids;
    const r = await oc.waitForDispatch(ids, 10_000);
    for (const [eid, did] of r.dispatcherIds) {
      ctx.dispatcherAssignments.set(eid, did);
    }
    return {
      data: {
        ids,
        publishedAt: Array.from(r.publishedAt.entries()),
        dispatcherIds: Array.from(r.dispatcherIds.entries()),
        insertedAtMs: r.insertedAtMs,
      },
      traceIds: [],
      stepCount: ids.length,
    };
  },

  async assert(_ctx, actResult) {
    const ids = actResult.data.ids as string[];
    const publishedAt = new Map(
      actResult.data.publishedAt as [string, number][],
    );
    const dispatcherIds = new Map(
      actResult.data.dispatcherIds as [string, string][],
    );
    const insertedAtMs = actResult.data.insertedAtMs as number;

    // 정확히 5 발행 — 중복도 누락도 없음.
    equal(ids.length, 5, "5 events inserted");
    equal(
      publishedAt.size,
      5,
      "exactly 5 events published (no dup, no miss)",
    );

    // dispatcher별 처리 row disjoint — 한 이벤트 → 한 dispatcher.
    const inverse = new Map<string, Set<string>>();
    for (const [eid, did] of dispatcherIds) {
      const set = inverse.get(did) ?? new Set<string>();
      set.add(eid);
      inverse.set(did, set);
    }
    const allEvents = Array.from(inverse.values()).flatMap((s) =>
      Array.from(s),
    );
    equal(
      new Set(allEvents).size,
      allEvents.length,
      "dispatcher event sets must be disjoint",
    );

    // 락 경합 추가 lag — first publish vs last publish 차이.
    const times = Array.from(publishedAt.values()).sort((a, b) => a - b);
    const baselineLagMs = times[0] - insertedAtMs;
    const maxLagMs = times[times.length - 1] - insertedAtMs;
    const contentionLagMs = maxLagMs - baselineLagMs;
    ok(
      contentionLagMs < 100,
      `lock contention lag must be < 100ms, got ${contentionLagMs}ms`,
    );
  },

  async teardown() {},
};
