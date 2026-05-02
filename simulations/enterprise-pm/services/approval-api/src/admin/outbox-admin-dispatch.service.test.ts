// @def.boundary sim-approval-api
// @def.doc server-side-admin-endpoints

// Stage 4 §4.2 — N-replica dispatch 시뮬 단위 테스트.
// disjoint / default opts / duplicates>0 / timeout 4 케이스.

import { describe, it, expect } from "vitest";
import {
  OutboxAdminDispatchService,
  type OutboxAdminDispatcher,
  type OutboxDispatcherFactory,
} from "./outbox-admin-dispatch.service.js";

// disjoint factory — 모든 worker 가 동일 cursor 를 공유, 각 tick 에서 batchSize 만큼 분배.
// SKIP LOCKED 모사: cursor 진행 후 자기 worker 의 claimed 에 push.
function disjointFactory(eventIds: string[]): OutboxDispatcherFactory {
  let cursor = 0;
  return (consumerName: string): OutboxAdminDispatcher => {
    const claimed: string[] = [];
    return {
      consumerName,
      claimed,
      async tick(batchSize?: number) {
        const size = batchSize ?? 10;
        if (cursor >= eventIds.length) return 0;
        const slice = eventIds.slice(cursor, cursor + size);
        cursor += slice.length;
        claimed.push(...slice);
        return slice.length;
      },
    };
  };
}

// collision factory — 일부러 같은 id 를 두 worker 에 emit (consumer-log 결함 시뮬).
function makeCollisionFactory(): OutboxDispatcherFactory {
  let callCount = 0;
  return (consumerName: string): OutboxAdminDispatcher => {
    const claimed: string[] = [];
    let myCalls = 0;
    return {
      consumerName,
      claimed,
      async tick() {
        myCalls++;
        callCount++;
        // 처음 두 호출(서로 다른 worker 의 첫 tick)은 같은 id "evt-x" 를 yield.
        if (myCalls === 1 && callCount <= 2) {
          claimed.push("evt-x");
          return 1;
        }
        return 0;
      },
    };
  };
}

// slow factory — tick 이 200ms 후 1개 yield. timeoutMs<200 이면 1번만 실행되어야 한다.
function slowFactory(consumerName: string): OutboxAdminDispatcher {
  const claimed: string[] = [];
  return {
    consumerName,
    claimed,
    async tick() {
      await new Promise((resolve) => setTimeout(resolve, 200));
      claimed.push(`${consumerName}-evt`);
      return 1;
    },
  };
}

describe("OutboxAdminDispatchService", () => {
  it("replicaCount=3, ROWS=30 — disjoint + totalDispatched=30 + duplicates=0", async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `evt-${i}`);
    const r = await new OutboxAdminDispatchService(disjointFactory(ids)).dispatchAll(
      { replicaCount: 3, timeoutMs: 5_000 },
    );
    expect(r.byReplica).toHaveLength(3);
    expect(r.totalDispatched).toBe(30);
    expect(r.duplicates).toBe(0);
    expect(new Set(r.byReplica.flatMap((x) => x.dispatchedEventIds)).size).toBe(30);
    expect(r.byReplica.map((x) => x.replicaId).sort()).toEqual([
      "sim-approval-api-0",
      "sim-approval-api-1",
      "sim-approval-api-2",
    ]);
  });

  it("default replicaCount=3, timeoutMs=5000", async () => {
    const r = await new OutboxAdminDispatchService(disjointFactory([])).dispatchAll(
      {},
    );
    expect(r.byReplica).toHaveLength(3);
    expect(r.totalDispatched).toBe(0);
  });

  it("duplicates>0 — 같은 id가 여러 replica 에 잡히면 정확히 카운트", async () => {
    const r = await new OutboxAdminDispatchService(makeCollisionFactory()).dispatchAll(
      { replicaCount: 2, timeoutMs: 1_000 },
    );
    expect(r.totalDispatched).toBe(2);
    expect(r.duplicates).toBe(1);
  });

  it("timeoutMs 도달 → worker 가 현재 tick 종료 후 stop", async () => {
    const r = await new OutboxAdminDispatchService(slowFactory).dispatchAll({
      replicaCount: 2,
      timeoutMs: 50,
    });
    expect(r.durationMs).toBeGreaterThanOrEqual(200);
    expect(r.byReplica.every((x) => x.dispatchedEventIds.length <= 1)).toBe(true);
  });
});
