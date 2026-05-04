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
  dispatched_at: number | null;
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
      if (typeof r.dispatched_at === "number") {
        publishedAt.push([r.id, r.dispatched_at]);
        dispatcherIds.push([r.id, r.scope_id]);
      }
    }
    return { publishedAt, dispatcherIds };
  }
}
