// @def.boundary sim-scenarios
// @def.doc authorization-ontology-nested-audit-tracing

export interface AuditTraceViewResponse {
  rootSpanId: string;
  count: number;
  entries: Array<{
    spanId?: string;
    kind?: string;
    pass?: string;
    outcome?: string;
  }>;
}

export interface AuditFirstFailureViewResponse {
  rootSpanId: string;
  firstFailure: {
    spanId?: string;
    kind?: string;
    pass?: string;
    outcome?: string;
    denyReason?: string;
  } | null;
}

export async function fetchAuditTraceView(
  auditUrl: string,
  rootSpanId: string,
): Promise<AuditTraceViewResponse> {
  const url = new URL(`/audit/trace/${rootSpanId}`, auditUrl);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(
      `fetchAuditTraceView ${rootSpanId}: status=${res.status} body=${await res.text()}`,
    );
  }
  return (await res.json()) as AuditTraceViewResponse;
}

export async function fetchAuditFirstFailureView(
  auditUrl: string,
  rootSpanId: string,
): Promise<AuditFirstFailureViewResponse> {
  const url = new URL(`/audit/firstFailure/${rootSpanId}`, auditUrl);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(
      `fetchAuditFirstFailureView ${rootSpanId}: status=${res.status} body=${await res.text()}`,
    );
  }
  return (await res.json()) as AuditFirstFailureViewResponse;
}

export async function fetchAuditEntryView(
  auditUrl: string,
  spanId: string,
): Promise<Record<string, unknown>> {
  const url = new URL(`/audit/entry/${spanId}`, auditUrl);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`fetchAuditEntryView ${spanId}: status=${res.status} body=${await res.text()}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

export function summarizeAuditTraceView(result: AuditTraceViewResponse): string {
  const denyChecks = result.entries.filter(
    (entry) => entry.kind === 'check' && entry.outcome === 'deny',
  ).length;
  return [
    `audit-trace root=${result.rootSpanId}`,
    `count=${result.count}`,
    `denyChecks=${denyChecks}`,
  ].join(' | ');
}

export function summarizeAuditFirstFailureView(result: AuditFirstFailureViewResponse): string {
  if (!result.firstFailure) {
    return `audit-first-failure root=${result.rootSpanId} | none`;
  }

  return [
    `audit-first-failure root=${result.rootSpanId}`,
    `span=${result.firstFailure.spanId ?? 'unknown'}`,
    `kind=${result.firstFailure.kind ?? 'unknown'}`,
    `outcome=${result.firstFailure.outcome ?? 'unknown'}`,
    result.firstFailure.denyReason ? `denyReason=${result.firstFailure.denyReason}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
}

export function summarizeAuditEntryView(result: Record<string, unknown>): string {
  return [
    `audit-entry span=${String(result.spanId ?? 'unknown')}`,
    `kind=${String(result.kind ?? 'unknown')}`,
    `outcome=${String(result.outcome ?? 'unknown')}`,
  ].join(' | ');
}
