// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import type { Sql } from "postgres";
import type { RlsShadowPrediction } from "db-bootstrap";
import { randomUUID } from "node:crypto";

export interface ShadowRecordInput {
  userId: string | null;
  tenantId: string | null;
  resourceTable: string;
  operation: "select" | "insert" | "update" | "delete";
  applicationDecision: "allow" | "deny";
  rlsPrediction: RlsShadowPrediction;
  requestId?: string | null;
}

export interface Logger {
  error(payload: object, msg: string): void;
}

/**
 * 쓰기 전용 shadow recorder.
 * Hot path 영향 최소화를 위해 fire-and-forget 반환 — caller 는 await 하지 않는다.
 * INSERT 실패는 logger 로만 기록 (spec §에러 처리 convention).
 */
export class PgRlsShadowRecorder {
  constructor(
    private readonly sql: Sql,
    private readonly logger: Logger,
    private readonly tableRef: string = "audit.rls_shadow_decisions",
  ) {}

  record(input: ShadowRecordInput): void {
    const id = randomUUID();
    const divergence = input.applicationDecision !== input.rlsPrediction.decision;
    // postgres driver 의 tagged template 은 identifier 파라미터화에 sql.unsafe 필요
    const promise = this.sql.unsafe(
      `INSERT INTO ${this.tableRef}
        (id, occurred_at, user_id, tenant_id, resource_table, operation,
         application_decision, rls_would_decision, divergence, deny_reason, request_id)
       VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        input.userId,
        input.tenantId,
        input.resourceTable,
        input.operation,
        input.applicationDecision,
        input.rlsPrediction.decision,
        divergence,
        input.rlsPrediction.denyReason,
        input.requestId ?? null,
      ],
    );
    // fire-and-forget — 실패만 로깅
    Promise.resolve(promise).catch((err: unknown) => {
      this.logger.error({ err, shadowId: id }, "rls-shadow 기록 실패");
    });
  }
}
