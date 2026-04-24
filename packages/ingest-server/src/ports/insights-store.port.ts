// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * InsightsStore 포트 — 인사이트 수집/조회 추상화.
 *
 * INSIGHTS_DRIVER 환경변수로 구현체를 선택한다:
 *   - "local"   → DrizzleInsightsStore (SQLite, 기본값)
 *   - "app-hub" → AppHubInsightsStore  (Google App Hub)
 *
 * 읽기(조회)와 쓰기(수집)를 하나의 인터페이스에 통합하여
 * 드라이버만 바꾸면 수집 주체와 조회 대상이 함께 전환된다.
 */

// ── 결과 타입 ────────────────────────────────────────────

export interface InsightsSummary {
  readonly traces: number;
  readonly records: number;
  readonly sessions: number;
  readonly services: number;
  readonly eventKeys: number;
  readonly autoRecords: number;
  readonly manualRecords: number;
  readonly actors: number;
  readonly errorRecords: number;
}

export interface ServiceInsight {
  readonly service: string;
  readonly traces: number;
  readonly records: number;
  readonly firstSeen: string | null;
  readonly lastSeen: string | null;
}

export interface EventKeyInsight {
  readonly eventKey: string;
  readonly count: number;
  readonly source: "auto" | "manual";
  readonly category: string;
  readonly firstSeen: string | null;
  readonly lastSeen: string | null;
}

export interface PrefixUsageInsight {
  readonly prefix: string;
  readonly count: number;
}

export interface TimelineBucket {
  readonly hour: string;
  readonly count: number;
}

export interface FlowInsight {
  readonly traceId: string;
  readonly service: string;
  readonly recordCount: number;
  readonly firstTimestamp: string;
  readonly sequence: readonly string[];
  readonly prefixes: readonly string[];
}

export interface SessionInsight {
  readonly sessionId: string;
  readonly startedAt: string | null;
  readonly closedAt: string | null;
  readonly scenarioId: string | null;
  readonly traces: number;
  readonly records: number;
  readonly services: readonly string[];
}

export interface CoverageCategory {
  readonly category: string;
  readonly observedKeys: readonly string[];
  readonly observedCount: number;
  readonly coverage: number;
}

export interface CoverageInsight {
  readonly totalObservedKeys: number;
  readonly totalRecords: number;
  readonly categories: readonly CoverageCategory[];
}

export interface PermissionEventItem {
  readonly logId: string;
  readonly traceId: string;
  readonly timestamp: string;
  readonly eventKey: string;
  readonly actorId: string | null;
  readonly userId: string | null;
  readonly sessionId: string | null;
  readonly payload: Record<string, unknown> | undefined;
  readonly addressContext: Record<string, string> | undefined;
}

export interface PermissionInsight {
  readonly items: readonly PermissionEventItem[];
  readonly summary: Readonly<Record<string, number>>;
  readonly total: number;
}

export interface ServicePrefixInsight {
  readonly service: string;
  readonly activePrefixes: readonly string[];
  readonly prefixCounts: Readonly<Record<string, number>>;
  readonly totalEvents: number;
}

export interface PrefixCorrelation {
  readonly prefixA: string;
  readonly prefixB: string;
  readonly cooccurrence: number;
  readonly jaccard: number;
  readonly support: number;
}

export interface IntentLinkSuggestion {
  readonly id: string;
  readonly endpoints: readonly string[];
  readonly avgJaccard: number;
  readonly evidence: number;
}

export interface PrefixFrequency {
  readonly prefix: string;
  readonly count: number;
  readonly soloRate: number;
}

export interface CorrelationInsight {
  readonly totalGroups: number;
  readonly sessionGroups: number;
  readonly traceGroups: number;
  readonly totalPairs: number;
  readonly correlations: readonly PrefixCorrelation[];
  readonly suggestions: readonly IntentLinkSuggestion[];
  readonly prefixFrequency: readonly PrefixFrequency[];
}

export interface ErrorEventItem {
  readonly logId: string;
  readonly traceId: string;
  readonly timestamp: string;
  readonly eventKey: string;
  readonly service: string;
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly statusCode?: number;
}

export interface ErrorInsight {
  readonly items: readonly ErrorEventItem[];
  readonly total: number;
  readonly byService: Readonly<Record<string, number>>;
  readonly byCode: Readonly<Record<string, number>>;
}

export interface GraphRetentionEventItem {
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
  readonly addressContext: Record<string, string> | undefined;
}

export interface GraphRetentionInsight {
  readonly items: readonly GraphRetentionEventItem[];
  readonly total: number;
  readonly summary: Readonly<Record<string, number>>;
  readonly byTrigger: Readonly<Record<string, number>>;
  readonly byGraphId: Readonly<Record<string, number>>;
}

// ── 수집 배치 (쓰기) ────────────────────────────────────

export interface InsightsRecord {
  readonly logId: string;
  readonly timestamp: string;
  readonly traceId: string;
  readonly eventKey: string;
  readonly eventVersion: string;
  readonly recordKind: string;
  readonly addressContext?: Readonly<Record<string, string>>;
  readonly payload?: unknown;
  readonly actorId?: string;
  readonly userId?: string;
  readonly qaSessionId?: string;
}

export interface InsightsTrace {
  readonly traceId: string;
  readonly serviceName?: string;
  readonly recordCount: number;
  readonly firstTimestamp?: string;
  readonly lastTimestamp?: string;
  readonly sessionId?: string;
}

export interface InsightsSession {
  readonly sessionId: string;
  readonly startedAt: string;
  readonly closedAt?: string;
  readonly scenarioId?: string;
}

export interface InsightsCollectBatch {
  readonly records?: readonly InsightsRecord[];
  readonly traces?: readonly InsightsTrace[];
  readonly sessions?: readonly InsightsSession[];
}

// ── 포트 인터페이스 ─────────────────────────────────────

export interface InsightsStore {
  // ── 읽기 (조회) ──
  getSummary(): Promise<InsightsSummary>;
  getServiceDistribution(): Promise<readonly ServiceInsight[]>;
  getEventKeyFrequency(opts?: { limit?: number }): Promise<readonly EventKeyInsight[]>;
  getPrefixUsage(opts?: { limit?: number }): Promise<readonly PrefixUsageInsight[]>;
  getTimeline(opts?: { limit?: number }): Promise<readonly TimelineBucket[]>;
  getFlows(opts?: { limit?: number }): Promise<readonly FlowInsight[]>;
  getSessions(opts?: { limit?: number }): Promise<readonly SessionInsight[]>;
  getCoverage(): Promise<CoverageInsight>;
  getPermissionEvents(opts?: { limit?: number }): Promise<PermissionInsight>;
  getServicePrefixes(): Promise<readonly ServicePrefixInsight[]>;
  getCorrelations(opts?: { minSupport?: number }): Promise<CorrelationInsight>;
  getErrors(opts?: { limit?: number }): Promise<ErrorInsight>;
  getGraphRetentionEvents(opts?: {
    limit?: number;
    graphId?: string;
  }): Promise<GraphRetentionInsight>;

  // ── 쓰기 (수집) ──
  /**
   * 수집된 데이터를 인사이트 저장소에 기록한다.
   *
   * - local 모드: no-op (ingest pipeline이 같은 DB에 이미 기록)
   * - app-hub 모드: 외부 서비스로 전달
   */
  collect(batch: InsightsCollectBatch): Promise<void>;
}
