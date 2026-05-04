// @def.boundary sim-approval-api
// @def.doc server-side-admin-endpoints
//
// sim-handle outbox-client polling 용 per-id state 조회 service.
// `GET /admin/outbox/dispatch?ids=...` 가 본 service 의 queryState 호출.
//
// 반환 shape: `{ publishedAt: [[id, epochMs]...], dispatcherIds: [[id, scope_id]...] }`
// scope_id 가 dispatcher 식별자 — outbox-dispatcher 가 claim 시 갱신.

import { Inject, Injectable } from "@nestjs/common";
import type { Sql } from "postgres";
import { OUTBOX_INSERT_CLIENT } from "./outbox-admin.tokens.js";

interface OutboxStateRow {
  id: string;
  // postgres.js 는 BIGINT 를 JS Number 정밀도 손실 회피 위해 기본 string 반환.
  // 본 컬럼 (epoch ms) 는 Number.MAX_SAFE_INTEGER 미만이라 안전하게 number 변환.
  dispatched_at: string | number | null;
  scope_id: string;
}

@Injectable()
export class OutboxAdminStateQueryService {
  constructor(
    @Inject(OUTBOX_INSERT_CLIENT) private readonly sql: Sql,
  ) {}

  async queryState(ids: readonly string[]): Promise<{
    publishedAt: Array<[string, number]>;
    dispatcherIds: Array<[string, string]>;
  }> {
    if (ids.length === 0) return { publishedAt: [], dispatcherIds: [] };
    const rows = await this.sql<OutboxStateRow[]>`
      SELECT id, dispatched_at, scope_id
      FROM sim.approval_outbox_events
      WHERE id IN ${this.sql(ids as string[])}
    `;
    const publishedAt: Array<[string, number]> = [];
    const dispatcherIds: Array<[string, string]> = [];
    for (const r of rows) {
      const ms =
        typeof r.dispatched_at === "number"
          ? r.dispatched_at
          : typeof r.dispatched_at === "string"
            ? Number(r.dispatched_at)
            : null;
      if (ms !== null && Number.isFinite(ms)) {
        publishedAt.push([r.id, ms]);
        dispatcherIds.push([r.id, r.scope_id]);
      }
    }
    return { publishedAt, dispatcherIds };
  }
}
