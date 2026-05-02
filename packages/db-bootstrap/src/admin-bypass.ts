// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import postgres from "postgres";
import type { Sql } from "postgres";

/**
 * qa_admin_bypass 연결 전용 factory (Plan 15e Phase 5).
 * BYPASSRLS role 로 RLS 완전 우회 — 마이그레이션·백업·긴급 운영 경로.
 * 본 connection 의 모든 쿼리는 pgAudit 로 외부에 감사 기록됨(운영).
 */
export interface AdminBypassConnectionConfig {
  host: string;
  port: number;
  database: string;
  password: string;   // QA_SDK_ADMIN_BYPASS_PASSWORD
  max?: number;
}

export interface AdminBypassConnection {
  sql: Sql;
  close(): Promise<void>;
}

export async function createAdminBypassConnection(
  cfg: AdminBypassConnectionConfig,
): Promise<AdminBypassConnection> {
  const sql = postgres({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: "qa_admin_bypass",
    password: cfg.password,
    max: cfg.max ?? 3,
    onnotice: () => {},
  });
  // role 이 실제 BYPASSRLS 보유하는지 즉시 확인 — FORCE 미적용 상태에서 실수로 일반 role 사용 방지
  const rows = await sql<{ rolbypassrls: boolean }[]>`
    SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user
  `;
  if (!rows[0] || rows[0].rolbypassrls !== true) {
    await sql.end();
    throw new Error(
      `createAdminBypassConnection: current_user 가 BYPASSRLS 미보유. qa_admin_bypass role 로 로그인했는지 확인.`,
    );
  }
  return { sql, close: async () => { await sql.end(); } };
}
