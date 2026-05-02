// @def.boundary sim-audit-recorder-provider
// @def.doc authorization-ontology-nested-audit-tracing

import type { AuditRecorder } from "permission-engine";
import { createAuditRecorder } from "audit-recorder-store";

export interface CreateSimAuditRecorderArgs {
  dialect: "sqlite" | "pg";
  /** drizzle DB instance — createConnection 결과의 .db 필드. */
  db: unknown;
}

/**
 * createSimAuditRecorder — 시뮬 3 서비스(pm-api/approval-api/audit-browser-api)의
 * AuditRecorder 단일 진입점.
 *
 * 내부적으로 Plan 06c 의 `createAuditRecorder({ dialect, db })` 에 그대로 위임.
 * 본 layer 가 필요한 이유:
 *   1. 3 서비스가 동일 factory 호출 → 동일 어댑터 클래스 사용 보장
 *   2. 향후 OtelAuditRecorder wrapping 등 추가 로직이 필요하면 본 한 곳에만 추가
 *   3. 인터페이스 drift 방지 — dialect/db 파라미터 형식이 유일
 *
 * fallback 금지 — dialect 미지원 또는 db null 은 즉시 throw. 호출자가 env 검증.
 */
export async function createSimAuditRecorder(
  args: CreateSimAuditRecorderArgs,
): Promise<AuditRecorder> {
  if (args.db === null || args.db === undefined) {
    throw new Error("createSimAuditRecorder: db instance required (no fallback)");
  }
  if (args.dialect !== "sqlite" && args.dialect !== "pg") {
    throw new Error(
      `createSimAuditRecorder: unsupported dialect=${String(args.dialect)}`,
    );
  }
  return createAuditRecorder({ dialect: args.dialect, db: args.db as never });
}
