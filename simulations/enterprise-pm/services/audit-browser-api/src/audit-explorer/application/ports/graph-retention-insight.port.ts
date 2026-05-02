// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

/**
 * Cross-domain query port — ingest 서비스의 graph retention insight read.
 *
 * audit-explorer context BFF 가 trace + insight 를 합성할 때 사용. ingest URL 이
 * 미설정이면 null 반환 (fail-open).
 */

export interface GraphRetentionInsightItem {
  readonly logId: string;
  readonly traceId: string;
  readonly timestamp: string;
  readonly eventKey: string;
  readonly graphId: string | null;
  readonly graphScope: string | null;
  readonly trigger: string | null;
  readonly keepLatest: number | null;
  readonly beforeCount: number | null;
  readonly afterCount: number | null;
  readonly deletedCount: number | null;
  readonly error: string | null;
  readonly addressContext?: Record<string, string>;
}

export interface GraphRetentionInsightResponse {
  readonly items: readonly GraphRetentionInsightItem[];
  readonly total: number;
  readonly summary: Record<string, number>;
  readonly byTrigger: Record<string, number>;
  readonly byGraphId: Record<string, number>;
}

export abstract class GraphRetentionInsightQueryPort {
  abstract getForGraph(
    graphId: string,
    limit?: number,
  ): Promise<GraphRetentionInsightResponse | null>;
}
