// @def.boundary sim-audit-browser-api
// @def.doc authorization-graph-store

import { Inject, Injectable } from "@nestjs/common";

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

export const GRAPH_RETENTION_INSIGHT_ENDPOINT = Symbol(
  "GRAPH_RETENTION_INSIGHT_ENDPOINT",
);

@Injectable()
export class GraphRetentionInsightService {
  constructor(
    @Inject(GRAPH_RETENTION_INSIGHT_ENDPOINT)
    private readonly ingestUrl?: string,
  ) {}

  async getForGraph(
    graphId: string,
    limit = 20,
  ): Promise<GraphRetentionInsightResponse | null> {
    if (!this.ingestUrl) {
      return null;
    }

    try {
      const url = new URL("/v1/insights/graph-retention", this.ingestUrl);
      url.searchParams.set("graph_id", graphId);
      url.searchParams.set("limit", String(limit));

      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as GraphRetentionInsightResponse;
    } catch {
      return null;
    }
  }
}
