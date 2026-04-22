// @def.boundary cli-command
// @def.doc authorization-ontology-rls-enforcement

/**
 * postgres Sql 인터페이스의 minimal 추상화 — 본 모듈은 type-only 의존만 두고
 * 실제 connection 은 호출 측 (CLI program 등록부) 에서 주입한다. CLI 번들에
 * postgres runtime 을 강제로 끌어오지 않기 위함.
 */
export interface ShadowReportSql {
  <T = unknown>(template: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
}

export interface ShadowReportOptions {
  hours: number;     // default 24
  limit: number;     // default 20 (top divergences)
}

export interface ShadowReportRow {
  resourceTable: string;
  operation: string;
  denyReason: string | null;
  divergenceCount: number;
  totalCount: number;
}

export async function runShadowReport(
  sql: ShadowReportSql,
  options: ShadowReportOptions,
): Promise<ShadowReportRow[]> {
  const rows = await sql<ShadowReportRow>`
    SELECT resource_table   AS "resourceTable",
           operation,
           deny_reason      AS "denyReason",
           SUM(CASE WHEN divergence THEN 1 ELSE 0 END)::int AS "divergenceCount",
           COUNT(*)::int                                     AS "totalCount"
      FROM audit.rls_shadow_decisions
     WHERE occurred_at > now() - make_interval(hours => ${options.hours})
     GROUP BY resource_table, operation, deny_reason
     ORDER BY "divergenceCount" DESC
     LIMIT ${options.limit}
  `;
  return rows;
}

export function formatShadowReport(rows: ShadowReportRow[]): string {
  if (rows.length === 0) return "(no shadow activity)";
  const header = "table                          | op     | deny_reason              | diverge / total";
  const sep    = "-".repeat(header.length);
  const lines = rows.map((r) =>
    `${r.resourceTable.padEnd(30)} | ${r.operation.padEnd(6)} | ${(r.denyReason ?? "-").padEnd(24)} | ${String(r.divergenceCount).padStart(8)} / ${String(r.totalCount).padStart(5)}`,
  );
  return [header, sep, ...lines].join("\n");
}
