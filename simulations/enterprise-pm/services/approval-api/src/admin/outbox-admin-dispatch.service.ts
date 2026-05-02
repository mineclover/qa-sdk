// @def.boundary sim-approval-api
// @def.doc server-side-admin-endpoints

// Stage 4 §4.2 — N개 worker promise 동시 실행, byReplica 결과 집계.
// SKIP LOCKED + consumer-log UNIQUE 가 disjoint 를 보장 — 본 service 는 *집계 + duplicates 계산*에 집중.
// 종료 조건: 연속 빈 tick 2회 또는 deadline 도달 (진행 중 tick 은 마치고 종료).

import { Inject, Injectable } from "@nestjs/common";
import { OUTBOX_DISPATCHER_FACTORY } from "./outbox-admin.tokens.js";

export interface OutboxAdminDispatcher {
  consumerName: string;
  claimed: string[];
  tick(batchSize?: number): Promise<number>;
}

export type OutboxDispatcherFactory = (
  consumerName: string,
) => OutboxAdminDispatcher;

export interface OutboxDispatchAllOptions {
  replicaCount?: number;
  timeoutMs?: number;
  batchSize?: number;
}

export interface OutboxDispatchAllResult {
  byReplica: Array<{ replicaId: string; dispatchedEventIds: string[] }>;
  totalDispatched: number;
  duplicates: number;
  durationMs: number;
}

@Injectable()
export class OutboxAdminDispatchService {
  constructor(
    @Inject(OUTBOX_DISPATCHER_FACTORY)
    private readonly factory: OutboxDispatcherFactory,
  ) {}

  async dispatchAll(
    opts: OutboxDispatchAllOptions,
  ): Promise<OutboxDispatchAllResult> {
    const replicaCount = opts.replicaCount ?? 3;
    const timeoutMs = opts.timeoutMs ?? 5_000;
    const batchSize = opts.batchSize ?? 10;
    const start = Date.now();
    const deadline = start + timeoutMs;

    const dispatchers = Array.from({ length: replicaCount }, (_, i) =>
      this.factory(`sim-approval-api-${i}`),
    );

    const runWorker = async (d: OutboxAdminDispatcher): Promise<void> => {
      let empty = 0;
      while (Date.now() < deadline) {
        const n = await d.tick(batchSize);
        if (n === 0) {
          empty++;
          if (empty >= 2) break;
        } else {
          empty = 0;
        }
      }
    };

    await Promise.all(dispatchers.map(runWorker));

    const byReplica = dispatchers.map((d) => ({
      replicaId: d.consumerName,
      dispatchedEventIds: [...d.claimed],
    }));
    const all = byReplica.flatMap((r) => r.dispatchedEventIds);
    return {
      byReplica,
      totalDispatched: all.length,
      duplicates: all.length - new Set(all).size,
      durationMs: Date.now() - start,
    };
  }
}
