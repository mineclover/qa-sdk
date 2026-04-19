// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * AppHubInsightsStore — Google App Hub 기반 InsightsStore 구현.
 *
 * collect()에서 App Hub API로 데이터를 전달하고,
 * 읽기 메서드에서 App Hub 집계 API를 호출한다.
 *
 * TODO: App Hub SDK 연동 후 각 메서드 구현
 */

import type { Logger } from "pino";
import type {
  InsightsStore,
  InsightsCollectBatch,
  InsightsSummary,
  ServiceInsight,
  EventKeyInsight,
  PrefixUsageInsight,
  TimelineBucket,
  FlowInsight,
  SessionInsight,
  CoverageInsight,
  PermissionInsight,
  ServicePrefixInsight,
  CorrelationInsight,
  ErrorInsight,
} from "../ports/insights-store.port.js";

export interface AppHubConfig {
  /** App Hub 엔드포인트 URL */
  readonly endpoint: string;
  /** 인증 토큰 또는 서비스 계정 키 경로 */
  readonly credential: string;
  /** 프로젝트/데이터셋 식별자 */
  readonly projectId: string;
  /** 요청 타임아웃 (ms) */
  readonly timeoutMs?: number;
}

export class AppHubInsightsStore implements InsightsStore {
  private readonly config: AppHubConfig;
  private readonly logger?: Logger;

  constructor(config: AppHubConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger;
    this.logger?.info({ endpoint: config.endpoint, projectId: config.projectId }, "AppHubInsightsStore 초기화");
  }

  // ── 쓰기: App Hub로 데이터 전달 ──

  async collect(batch: InsightsCollectBatch): Promise<void> {
    const recordCount = batch.records?.length ?? 0;
    const traceCount = batch.traces?.length ?? 0;
    const sessionCount = batch.sessions?.length ?? 0;

    if (recordCount === 0 && traceCount === 0 && sessionCount === 0) return;

    // TODO: App Hub SDK/API로 배치 전달
    // const response = await fetch(`${this.config.endpoint}/v1/ingest`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "Authorization": `Bearer ${this.config.credential}`,
    //   },
    //   body: JSON.stringify({
    //     projectId: this.config.projectId,
    //     records: batch.records,
    //     traces: batch.traces,
    //     sessions: batch.sessions,
    //   }),
    //   signal: AbortSignal.timeout(this.config.timeoutMs ?? 5_000),
    // });

    this.logger?.info(
      { records: recordCount, traces: traceCount, sessions: sessionCount },
      "App Hub collect (stub — 미구현)",
    );
  }

  // ── 읽기: App Hub 집계 API 호출 ──

  async getSummary(): Promise<InsightsSummary> {
    return this.stubQuery("getSummary", {
      traces: 0, records: 0, sessions: 0, services: 0,
      eventKeys: 0, autoRecords: 0, manualRecords: 0, actors: 0, errorRecords: 0,
    });
  }

  async getServiceDistribution(): Promise<readonly ServiceInsight[]> {
    return this.stubQuery("getServiceDistribution", []);
  }

  async getEventKeyFrequency(_opts?: { limit?: number }): Promise<readonly EventKeyInsight[]> {
    return this.stubQuery("getEventKeyFrequency", []);
  }

  async getPrefixUsage(_opts?: { limit?: number }): Promise<readonly PrefixUsageInsight[]> {
    return this.stubQuery("getPrefixUsage", []);
  }

  async getTimeline(_opts?: { limit?: number }): Promise<readonly TimelineBucket[]> {
    return this.stubQuery("getTimeline", []);
  }

  async getFlows(_opts?: { limit?: number }): Promise<readonly FlowInsight[]> {
    return this.stubQuery("getFlows", []);
  }

  async getSessions(_opts?: { limit?: number }): Promise<readonly SessionInsight[]> {
    return this.stubQuery("getSessions", []);
  }

  async getCoverage(): Promise<CoverageInsight> {
    return this.stubQuery("getCoverage", {
      totalObservedKeys: 0, totalRecords: 0, categories: [],
    });
  }

  async getPermissionEvents(_opts?: { limit?: number }): Promise<PermissionInsight> {
    return this.stubQuery("getPermissionEvents", { items: [], summary: {}, total: 0 });
  }

  async getServicePrefixes(): Promise<readonly ServicePrefixInsight[]> {
    return this.stubQuery("getServicePrefixes", []);
  }

  async getCorrelations(_opts?: { minSupport?: number }): Promise<CorrelationInsight> {
    return this.stubQuery("getCorrelations", {
      totalGroups: 0, sessionGroups: 0, traceGroups: 0,
      totalPairs: 0, correlations: [], suggestions: [], prefixFrequency: [],
    });
  }

  async getErrors(_opts?: { limit?: number }): Promise<ErrorInsight> {
    return this.stubQuery("getErrors", { items: [], total: 0, byService: {}, byCode: {} });
  }

  // ── 내부 ──

  private stubQuery<T>(method: string, fallback: T): T {
    this.logger?.debug({ method }, "App Hub query (stub — 미구현)");
    return fallback;
  }
}
