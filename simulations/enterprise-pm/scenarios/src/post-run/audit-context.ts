// @def.boundary sim-scenarios
// @def.doc authorization-ontology-nested-audit-tracing

export interface AuditContextCompositeResponse {
  rootSpanId: string;
  graphId: string;
  trace: {
    count: number;
    entries: Array<{
      kind: string;
      pass?: string;
      outcome?: string;
    }>;
  };
  firstFailure: unknown | null;
  graphSnapshot: {
    snapshotId: string;
    createdAt?: string;
    graph: {
      nodes: Array<{ coord: { anchor: string } }>;
      relations: Array<{ relationId: string }>;
      realms: Array<{ realmId: string }>;
    };
  };
  graphRetentionInsight?: {
    total: number;
    summary: Record<string, number>;
    byTrigger: Record<string, number>;
    byGraphId: Record<string, number>;
  } | null;
}

export async function fetchAuditContextComposite(
  auditUrl: string,
  rootSpanId: string,
  graphId: string,
): Promise<AuditContextCompositeResponse> {
  const url = new URL(`/audit/context/${rootSpanId}/${graphId}`, auditUrl);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(
      `fetchAuditContextComposite ${rootSpanId}/${graphId}: status=${res.status} body=${await res.text()}`,
    );
  }
  return (await res.json()) as AuditContextCompositeResponse;
}

export function summarizeAuditContextComposite(result: AuditContextCompositeResponse): string {
  const retentionSummary = result.graphRetentionInsight
    ? Object.entries(result.graphRetentionInsight.summary)
        .map(([eventKey, count]) => `${eventKey}=${count}`)
        .join(', ')
    : 'none';

  return [
    `audit-context root=${result.rootSpanId}`,
    `graph=${result.graphId}`,
    `trace=${result.trace.count}`,
    `snapshot=${result.graphSnapshot.snapshotId}`,
    `firstFailure=${result.firstFailure ? 'present' : 'none'}`,
    `retention=${retentionSummary || 'none'}`,
  ].join(' | ');
}
