// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * ConvergencePipelineRunner — Phase 2 완료 후 convergence 분석 파이프라인.
 *
 * Window-based 배치 처리:
 * - traceId를 버퍼에 축적
 * - threshold(건수) 또는 timer(시간) 도달 시 flush
 * - flush: recordStore에서 레코드 조회 → aggregateUsageData → collectMetrics → metricsToObservations → DKG store 저장
 *         + 세션별 패턴 분류 → 이상 감지 → observation 생성
 *
 * 에러 격리: convergence 실패가 Phase 2 verdict를 절대 차단하지 않음.
 *           패턴 분류 실패도 metric pipeline을 차단하지 않음.
 */

import type {
  RecordStore,
  PatternClassification,
  PatternAnomaly,
  PatternStats,
  PatternHealthReport,
  PatternRule,
  Catalog,
} from "@qa-sdk/core";
import type {
  AddressContextRecord,
  UsageData,
  MetricValue,
  ObservationNode,
} from "@qa-sdk/convergence";
import type { Logger } from "pino";

// ── 동적 import 대상 함수 시그니처 (구체 타입) ─────────

/** 패턴 분류 엔진 입력 */
export interface ClassifierInputPort {
  readonly events: readonly { readonly event_key: string; readonly timestamp: string; readonly actor_id?: string; readonly user_id?: string }[];
  readonly sessionId?: string;
  readonly platform?: string;
  readonly ownerType?: string;
}

/** 그래프 조회 최소 인터페이스 (convergence 함수에 전달) */
export interface ConvergenceGraphPort {
  getNodesByKind(kind: string): readonly { kind: string; id: string; [key: string]: unknown }[];
  getNode?(id: string): { kind: string; id: string; [key: string]: unknown } | undefined;
  edgesFrom?(id: string, type?: string): readonly { type: string; from: string; to: string }[];
  edgesTo?(id: string, type?: string): readonly { type: string; from: string; to: string }[];
  neighbors?(id: string, type: string): string[];
  addNode?(node: { kind: string; id: string }): void;
  addEdge?(type: string, from: string, to: string, meta?: Record<string, unknown>): void;
}

/** convergence 분석 함수 (spec-core/convergence에서 동적 import) */
export interface ConvergenceFunctions {
  aggregateUsageData: (catalog: Catalog, records: readonly AddressContextRecord[]) => UsageData;
  collectMetrics: (catalog: Catalog, graph: ConvergenceGraphPort, usage: UsageData | null) => MetricValue[];
  metricsToObservations: (metrics: readonly MetricValue[], options?: { date?: string }) => ObservationNode[];
  resolveRecoveredMetrics?: (metrics: readonly MetricValue[], existingObs: readonly ObservationNode[], options?: { date?: string }) => ObservationNode[];
  traceFlows?: (graph: ConvergenceGraphPort, records: readonly AddressContextRecord[], options?: { date?: string }) => {
    violations: readonly { intentLinkId: string; count: number }[];
    observations: readonly ObservationNode[];
    summary: string;
  };
}

/** 패턴 분류 관련 함수 (optional — CONVERGENCE_ENABLED일 때만 로드) */
export interface PatternFunctions {
  classifyPattern: (input: ClassifierInputPort, rules: readonly PatternRule[]) => PatternClassification;
  aggregatePatternStats: (classifications: readonly PatternClassification[]) => PatternStats[];
  detectAnomalies: (input: { current: readonly PatternClassification[]; previous?: readonly PatternStats[]; ratioShiftThreshold?: number; volumeSpikeMultiplier?: number }) => PatternAnomaly[];
  buildPatternHealthReport: (classifications: readonly PatternClassification[], anomalyCount?: number) => PatternHealthReport;
  patternRules: readonly PatternRule[];
}

/** DkgSqliteStore 인터페이스 (최소 필수) */
export interface DkgStorePort {
  saveUsageSnapshotWithObservations(
    usage: UsageData,
    observations: readonly ObservationNode[],
  ): { snapshotId: number; observationsWritten: number };
  /** observation 노드 업데이트 (자동 해소용) */
  updateNode?(node: ObservationNode): void;
  /** 노드/엣지 추가 저장 (prompts 연결 등) */
  saveNodes?(nodes: readonly unknown[], edges: readonly { type: string; from: string; to: string }[], source: string): void;
}

// ── Pipeline 설정 ────────────────────────────────────

export interface ConvergencePipelineConfig {
  /** 건수 기반 flush 임계값 (default: 100) */
  recordThreshold?: number;
  /** 타이머 기반 flush 주기 ms (default: 60_000) */
  flushIntervalMs?: number;
  /** 버퍼 최대 크기 — 메모리 cap (default: 10_000) */
  maxBufferSize?: number;
}

export interface ConvergencePipelineDeps {
  recordStore: RecordStore;
  convergenceFns: ConvergenceFunctions;
  patternFns?: PatternFunctions;
  graphProvider: () => ConvergenceGraphPort;
  catalogProvider: () => Catalog;
  dkgStore?: DkgStorePort;
  logger?: Logger;
}

export interface PatternFlushResult {
  sessionsClassified: number;
  anomaliesDetected: number;
  classificationRate: number;
}

export interface ConvergenceFlushResult {
  recordsProcessed: number;
  metricsCollected: number;
  observationsGenerated: number;
  snapshotId?: number;
  pattern?: PatternFlushResult;
  flowViolations?: number;
}

// ── Pipeline Runner ──────────────────────────────────

export class ConvergencePipelineRunner {
  private readonly deps: ConvergencePipelineDeps;
  private readonly config: Required<ConvergencePipelineConfig>;
  private buffer: string[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private closed = false;

  constructor(deps: ConvergencePipelineDeps, config?: ConvergencePipelineConfig) {
    this.deps = deps;
    this.config = {
      recordThreshold: config?.recordThreshold ?? 100,
      flushIntervalMs: config?.flushIntervalMs ?? 60_000,
      maxBufferSize: config?.maxBufferSize ?? 10_000,
    };

    // 타이머 기반 flush 설치
    this.timer = setInterval(() => {
      void this.flush().catch((err) => {
        this.deps.logger?.error({ err }, "convergence scheduled flush failed");
      });
    }, this.config.flushIntervalMs);

    if ("unref" in this.timer && typeof this.timer.unref === "function") {
      this.timer.unref();
    }
  }

  /**
   * Phase 2 완료 후 traceId를 알린다.
   * threshold에 도달하면 자동 flush.
   */
  notifyCompletion(traceIds: readonly string[]): void {
    if (this.closed) return;

    for (const id of traceIds) {
      if (this.buffer.length >= this.config.maxBufferSize) {
        // 메모리 cap — 강제 flush
        void this.flush().catch((err) => {
          this.deps.logger?.error({ err }, "convergence cap flush failed");
        });
        break;
      }
      this.buffer.push(id);
    }

    if (this.buffer.length >= this.config.recordThreshold) {
      void this.flush().catch((err) => {
        this.deps.logger?.error({ err }, "convergence threshold flush failed");
      });
    }
  }

  /**
   * 버퍼의 traceId를 소비하여 convergence 파이프라인을 실행.
   */
  async flush(): Promise<ConvergenceFlushResult | null> {
    if (this.flushing || this.buffer.length === 0) return null;
    this.flushing = true;

    // 버퍼 스왑 (flush 중 새 notification 수용)
    const traceIds = this.buffer;
    this.buffer = [];

    try {
      return await this.runPipeline(traceIds);
    } catch (error) {
      this.deps.logger?.error(
        { err: error, traceCount: traceIds.length },
        "convergence pipeline flush failed",
      );
      return null;
    } finally {
      this.flushing = false;
    }
  }

  /** 정리: 타이머 해제 + 잔여 flush. */
  async close(): Promise<void> {
    this.closed = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // 잔여 버퍼 flush
    if (this.buffer.length > 0) {
      await this.flush();
    }
  }

  get pendingCount(): number {
    return this.buffer.length;
  }

  // ── Private ────────────────────────────────────────

  /** 이전 윈도우의 패턴 통계 (비율 비교용) */
  private previousPatternStats: PatternStats[] = [];

  private async runPipeline(traceIds: string[]): Promise<ConvergenceFlushResult> {
    const { recordStore, convergenceFns, patternFns, graphProvider, catalogProvider, dkgStore, logger } = this.deps;

    // 1. 레코드 조회 — address_context가 있는 것만 수집
    const addressRecords: AddressContextRecord[] = [];
    for (const traceId of traceIds) {
      try {
        const records = await recordStore.findByTraceId(traceId);
        for (const r of records) {
          const rec = r as unknown as Record<string, unknown>;
          if (rec.addressContext && typeof rec.addressContext === "object") {
            addressRecords.push({
              address_context: rec.addressContext as Record<string, string>,
              timestamp: (rec.createdAt as string) ?? new Date().toISOString(),
              log_id: (rec.id as string) ?? "",
              trace_id: traceId,
              session_id: rec.sessionId as string | undefined,
              event_key: (rec.eventKey as string) ?? "",
              actor_id: rec.actorId as string | undefined,
              user_id: rec.userId as string | undefined,
            });
          }
        }
      } catch (error) {
        logger?.warn({ err: error, traceId }, "convergence: failed to load records for trace");
      }
    }

    if (addressRecords.length === 0) {
      logger?.debug({ traceCount: traceIds.length }, "convergence: no address_context records found");
      return { recordsProcessed: 0, metricsCollected: 0, observationsGenerated: 0 };
    }

    // 2. 집계
    const catalog = catalogProvider();
    const usage = convergenceFns.aggregateUsageData(catalog, addressRecords);

    // 3. metric 수집
    const graph = graphProvider();
    const metrics = convergenceFns.collectMetrics(catalog, graph, usage);

    // 4. 자동 observation 생성
    const observations: ObservationNode[] = [...convergenceFns.metricsToObservations(metrics)];

    // 4b. ok 복귀 metric의 자동 해소
    let autoResolvedCount = 0;
    if (convergenceFns.resolveRecoveredMetrics && dkgStore) {
      try {
        const existingObs = graph.getNodesByKind("observation") as unknown as ObservationNode[];
        const resolved = convergenceFns.resolveRecoveredMetrics(metrics, existingObs);
        if (resolved.length > 0) {
          for (const obs of resolved) {
            dkgStore.updateNode?.(obs);
          }
          autoResolvedCount = resolved.length;
        }
      } catch (error) {
        logger?.warn({ err: error }, "convergence: auto-resolve failed");
      }
    }

    // 5. 패턴 분류 (에러 격리: 실패해도 metric pipeline 결과는 유지)
    let patternResult: PatternFlushResult | undefined;
    if (patternFns) {
      try {
        patternResult = this.runPatternClassification(addressRecords, patternFns, observations, logger);
      } catch (error) {
        logger?.warn({ err: error }, "convergence: pattern classification failed");
      }
    }

    // 5b. IntentLink 흐름 검증 (에러 격리)
    let flowViolationCount = 0;
    if (convergenceFns.traceFlows) {
      try {
        const flowResult = convergenceFns.traceFlows(graph, addressRecords);
        flowViolationCount = flowResult.violations.length;
        if (flowResult.observations.length > 0) {
          observations.push(...flowResult.observations);
          logger?.warn(
            { violations: flowViolationCount, summary: flowResult.summary },
            "convergence: IntentLink flow violations detected",
          );
        }
      } catch (error) {
        logger?.warn({ err: error }, "convergence: flow-trace failed");
      }
    }

    // 6. DKG store 저장
    let snapshotId: number | undefined;
    if (dkgStore && usage) {
      try {
        const result = dkgStore.saveUsageSnapshotWithObservations(usage, observations);
        snapshotId = result.snapshotId;

        // OBS-PATTERN → CON-005 prompts 자동 연결
        const patternObs = observations.filter(o => o.id.startsWith("OBS-PATTERN-"));
        if (patternObs.length > 0) {
          const promptsEdges = patternObs.map(o => ({
            type: "prompts" as const,
            from: o.id,
            to: "CON-005",
          }));
          try {
            dkgStore.saveNodes?.([], promptsEdges, "auto");
          } catch { /* prompts 저장 실패는 무시 */ }
        }
      } catch (error) {
        logger?.error({ err: error }, "convergence: failed to save snapshot");
      }
    }

    logger?.info(
      {
        traceCount: traceIds.length,
        recordsProcessed: addressRecords.length,
        metricsCollected: metrics.length,
        observationsGenerated: observations.length,
        autoResolvedCount,
        flowViolationCount,
        pattern: patternResult,
        snapshotId,
      },
      "convergence pipeline flush completed",
    );

    return {
      recordsProcessed: addressRecords.length,
      metricsCollected: metrics.length,
      observationsGenerated: observations.length,
      snapshotId,
      pattern: patternResult,
      flowViolations: flowViolationCount > 0 ? flowViolationCount : undefined,
    };
  }

  /**
   * 패턴 분류 단계 — 세션별 이벤트 시퀀스를 분류하고 이상을 감지한다.
   *
   * 흐름:
   * 1. addressRecords를 session_id별 그룹핑
   * 2. 각 세션 → classifyPattern(input, rules)
   * 3. aggregatePatternStats(classifications)
   * 4. detectAnomalies({ current, previous })
   * 5. 이상 패턴 → observation 변환 → observations 배열에 추가
   * 6. previousPatternStats 갱신 (다음 윈도우 비교용)
   */
  private runPatternClassification(
    addressRecords: readonly AddressContextRecord[],
    fns: PatternFunctions,
    observations: ObservationNode[],
    logger?: Logger,
  ): PatternFlushResult {
    // 1. 세션별 그룹핑
    const sessionMap = new Map<string, AddressContextRecord[]>();
    for (const rec of addressRecords) {
      const sid = rec.session_id ?? "unknown";
      let group = sessionMap.get(sid);
      if (!group) {
        group = [];
        sessionMap.set(sid, group);
      }
      group.push(rec);
    }

    // 2. 각 세션을 패턴으로 분류
    const classifications: PatternClassification[] = [];
    for (const [sessionId, records] of sessionMap) {
      const sorted = [...records].toSorted((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      const events = sorted.map(r => ({
        event_key: r.event_key ?? "",
        timestamp: r.timestamp ?? new Date().toISOString(),
        actor_id: r.actor_id,
        user_id: r.user_id,
      }));

      // event_key가 없는 세션은 건너뜀
      if (events.every(e => !e.event_key)) continue;

      const classification = fns.classifyPattern(
        { events, sessionId },
        fns.patternRules,
      );
      classifications.push(classification);
    }

    if (classifications.length === 0) {
      return { sessionsClassified: 0, anomaliesDetected: 0, classificationRate: 1 };
    }

    // 3. 이상 감지 (이전 윈도우와 비교)
    const anomalies = fns.detectAnomalies({
      current: classifications,
      previous: this.previousPatternStats.length > 0 ? this.previousPatternStats : undefined,
    });

    // 4. critical/warning 이상 → DKG ObservationNode 변환
    for (const anomaly of anomalies) {
      if (anomaly.severity === "info") continue;
      observations.push({
        kind: "observation",
        id: `OBS-PATTERN-${anomaly.kind}-${anomaly.detectedAt.slice(0, 10)}`,
        date: anomaly.detectedAt.slice(0, 10),
        source: "runtime",
        subjects: ["pattern_anomaly", anomaly.kind],
        finding: `[${anomaly.severity}] ${anomaly.description} (kind=${anomaly.kind})`,
        intent: anomaly.severity === "critical" ? "action-needed" : "monitoring",
        suggestion: anomaly.kind === "unclassified"
          ? { kind: "add-constraint", rule: "새 패턴 규칙 추가 검토" }
          : undefined,
      });
    }

    // 5. 건전성 보고서 생성 + 이전 통계 갱신
    const report = fns.buildPatternHealthReport(classifications, anomalies.length);
    this.previousPatternStats = [...report.stats];

    logger?.info(
      {
        sessionsClassified: classifications.length,
        classificationRate: report.classificationRate.toFixed(2),
        anomaliesDetected: anomalies.length,
        topPattern: report.stats[0]?.pattern,
      },
      "pattern classification completed",
    );

    return {
      sessionsClassified: classifications.length,
      anomaliesDetected: anomalies.length,
      classificationRate: report.classificationRate,
    };
  }
}
