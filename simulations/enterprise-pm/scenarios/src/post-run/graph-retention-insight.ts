// @def.boundary sim-scenarios
// @def.doc authorization-graph-store

export interface GraphRetentionInsightItem {
  logId: string;
  traceId: string;
  timestamp: string;
  eventKey: string;
  graphId: string | null;
  graphScope: string | null;
  trigger: string | null;
  keepLatest: number | null;
  beforeCount: number | null;
  afterCount: number | null;
  deletedCount: number | null;
  error: string | null;
  addressContext?: Record<string, string>;
}

export interface GraphRetentionInsightResponse {
  items: GraphRetentionInsightItem[];
  total: number;
  summary: Record<string, number>;
  byTrigger: Record<string, number>;
  byGraphId: Record<string, number>;
}

export interface GraphRetentionInsightArgs {
  graphId?: string;
  limit?: number;
}

export async function fetchGraphRetentionInsight(
  ingestUrl: string,
  args: GraphRetentionInsightArgs = {},
): Promise<GraphRetentionInsightResponse> {
  const url = new URL('/v1/insights/graph-retention', ingestUrl);
  if (args.graphId) {
    url.searchParams.set('graph_id', args.graphId);
  }
  if (args.limit !== undefined) {
    url.searchParams.set('limit', String(args.limit));
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(
      `fetchGraphRetentionInsight ${url.pathname}: status=${res.status} body=${await res.text()}`,
    );
  }
  return (await res.json()) as GraphRetentionInsightResponse;
}

export function summarizeGraphRetentionInsight(result: GraphRetentionInsightResponse): string {
  const summary = Object.entries(result.summary)
    .map(([eventKey, count]) => `${eventKey}=${count}`)
    .join(', ');
  const byTrigger = Object.entries(result.byTrigger)
    .map(([trigger, count]) => `${trigger}=${count}`)
    .join(', ');

  return [
    `graph-retention insight total=${result.total}`,
    summary ? `events: ${summary}` : 'events: none',
    byTrigger ? `triggers: ${byTrigger}` : 'triggers: none',
  ].join(' | ');
}
