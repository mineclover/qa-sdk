// @def.boundary cli-command-spec
// @def.doc authorization-ontology-rls-enforcement

/**
 * postgres Sql 인터페이스의 minimal 추상화 — type-only.
 * CLI 번들에 postgres runtime 을 강제로 끌어오지 않기 위함.
 */
export interface RlsCliSql {
  <T = unknown>(template: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
}

export const PROTECTED_TABLES = Object.freeze([
  "auth.resource_policies",
  "audit.audit_entries",
  "audit.rls_shadow_decisions",
  "ingest.key_observations",
  "ingest.key_observation_prefixes",
  "ingest.event_records",
] as const);

export interface EnforcePreflight {
  helperFunctionsOk: boolean;
  missingHelpers: string[];
  policyOk: boolean;
  missingPolicies: string[];
  adminBypassRoleExists: boolean;
}

/** Plan 15a/15b 의 사전 조건을 DB 에서 조회해 반환. */
export async function preflightEnforce(sql: RlsCliSql): Promise<EnforcePreflight> {
  const helpers = await sql<{ proname: string }>`
    SELECT p.proname FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname = 'auth'
       AND p.proname IN ('current_user_id','has_bit','resource_state','current_role_tag')
  `;
  const helperNames = new Set(helpers.map((r) => r.proname));
  const expectedHelpers = ["current_user_id", "has_bit", "resource_state", "current_role_tag"];
  const missingHelpers = expectedHelpers.filter((n) => !helperNames.has(n));

  const policies = await sql<{ polname: string }>`
    SELECT polname FROM pg_policy
     WHERE polname IN ('rp_select_policy','rp_insert_policy','rp_admin_bypass',
                       'ae_select_policy','ae_insert_policy','ae_admin_bypass',
                       'ko_select_policy','er_select_policy')
  `;
  const polnames = new Set(policies.map((r) => r.polname));
  const expectedPolicies = [
    "rp_select_policy","rp_admin_bypass",
    "ae_select_policy","ae_admin_bypass",
    "ko_select_policy","er_select_policy",
  ];
  const missingPolicies = expectedPolicies.filter((p) => !polnames.has(p));

  const bypassRole = await sql<{ count: number }>`
    SELECT count(*)::int AS count FROM pg_roles WHERE rolname = 'qa_admin_bypass'
  `;

  return {
    helperFunctionsOk: missingHelpers.length === 0,
    missingHelpers,
    policyOk: missingPolicies.length === 0,
    missingPolicies,
    adminBypassRoleExists: (bypassRole[0]?.count ?? 0) > 0,
  };
}

export interface EnforceStatus {
  table: string;
  rowSecurityEnabled: boolean;
  forced: boolean;
}

export async function queryEnforceStatus(sql: RlsCliSql): Promise<EnforceStatus[]> {
  const protectedList = PROTECTED_TABLES as readonly string[];
  const rows = await sql<{ full_name: string; rowsecurity: boolean; forcerowsecurity: boolean }>`
    SELECT n.nspname || '.' || c.relname AS full_name,
           c.relrowsecurity               AS rowsecurity,
           c.relforcerowsecurity          AS forcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
     WHERE n.nspname || '.' || c.relname = ANY(${protectedList})
  `;
  return rows.map((r) => ({
    table: r.full_name,
    rowSecurityEnabled: r.rowsecurity,
    forced: r.forcerowsecurity,
  }));
}

export function formatEnforceStatus(rows: EnforceStatus[]): string {
  const header = "table                                     | RLS enabled | FORCE";
  const sep = "-".repeat(header.length);
  const lines = rows.map((r) =>
    `${r.table.padEnd(42)} | ${String(r.rowSecurityEnabled).padEnd(11)} | ${String(r.forced)}`,
  );
  return [header, sep, ...lines].join("\n");
}
