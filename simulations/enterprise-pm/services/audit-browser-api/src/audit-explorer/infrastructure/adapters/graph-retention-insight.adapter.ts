// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import {
  GraphRetentionInsightQueryPort,
  type GraphRetentionInsightResponse,
} from "../../application/ports/graph-retention-insight.port.js";

/**
 * GraphRetentionInsightQueryPort 의 HTTP 어댑터.
 *
 * ingest 서비스의 `/v1/insights/graph-retention` 엔드포인트를 호출한다. URL 미설정
 * 또는 호출 실패 시 null (fail-open). 외부 fetch 는 AbortSignal.timeout 으로
 * 차단 보호.
 */
export class GraphRetentionInsightHttpAdapter extends GraphRetentionInsightQueryPort {
  constructor(private readonly ingestUrl?: string) {
    super();
  }

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
