// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * ConvergencePipelineRunner — Phase 2 완료 후 convergence 분석 파이프라인.
 *
 * Window-based 배치 처리:
 * - traceId를 버퍼에 축적
 * - threshold(건수) 또는 버퍼 cap 도달 시 즉시 flush
 * - 주기 flush는 convergence-scheduler가 단독으로 담당한다 (D-4 — runner는 timer를 갖지 않음)
 * - flush: recordStore에서 레코드 조회 → aggregateUsageData → flow trace/evidence → collectMetrics → metricsToObservations → DKG store 저장
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
} from '@qa-sdk/core';
import type {
  AddressContextRecord,
  UsageData,
  MetricValue,
  ObservationNode,
} from '@qa-sdk/convergence';
import type { Logger } from 'pino';
import type { MetricsCollector } from './metrics-collector.js';
import type { PatternStatsCache } from '../routes/patterns.js';

/** convergence 버퍼에 쌓인 trace 수 gauge */
export const CONVERGENCE_BUFFER_DEPTH_METRIC = 'convergence_buffer_depth';

// ── 동적 import 대상 함수 시그니처 (구체 타입) ─────────

/** 패턴 분류 엔진 입력 */
export interface ClassifierInputPort {
  readonly events: readonly {
    readonly event_key: string;
    readonly timestamp: string;
    readonly actor_id?: string;
    readonly user_id?: string;
  }[];
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
  replaceNode?(node: { kind: string; id: string }): void;
}

/** convergence 분석 함수 (@qa-sdk/convergence에서 동적 import) */
export interface ConvergenceFunctions {
  aggregateUsageData: (catalog: Catalog, records: readonly AddressContextRecord[]) => UsageData;
  collectMetrics: (
    catalog: Catalog,
    graph: ConvergenceGraphPort,
    usage: UsageData | null,
  ) => MetricValue[];
  metricsToObservations: (
    metrics: readonly MetricValue[],
    options?: { date?: string },
  ) => ObservationNode[];
  resolveRecoveredMetrics?: (
    metrics: readonly MetricValue[],
    existingObs: readonly ObservationNode[],
    options?: { date?: string },
  ) => ObservationNode[];
  resolveRecoveredFlowObservations?: (
    graph: ConvergenceGraphPort,
    records: readonly AddressContextRecord[],
    result: {
      violations: readonly {
        intentLinkId: string;
        missingPrefixes: readonly string[];
      }[];
    },
    existingObs: readonly ObservationNode[],
    options?: { date?: string },
  ) => ObservationNode[];
  traceFlows?: (
    graph: ConvergenceGraphPort,
    records: readonly AddressContextRecord[],
    options?: { date?: string },
  ) => {
    violations: readonly {
      intentLinkId: string;
      missingPrefixes: readonly string[];
      count: number;
    }[];
    observations: readonly ObservationNode[];
    summary: string;
  };
}

/** 패턴 분류 관련 함수 (optional — CONVERGENCE_ENABLED일 때만 로드) */
export interface PatternFunctions {
  classifyPattern: (
    input: ClassifierInputPort,
    rules: readonly PatternRule[],
  ) => PatternClassification;
  aggregatePatternStats: (classifications: readonly PatternClassification[]) => PatternStats[];
  detectAnomalies: (input: {
    current: readonly PatternClassification[];
    previous?: readonly PatternStats[];
    ratioShiftThreshold?: number;
    volumeSpikeMultiplier?: number;
  }) => PatternAnomaly[];
  buildPatternHealthReport: (
    classifications: readonly PatternClassification[],
    anomalyCount?: number,
  ) => PatternHealthReport;
  patternRules: readonly PatternRule[];
}

/** DkgSqliteStore 인터페이스 (최소 필수) */
export interface DkgStorePort {
  saveUsageSnapshotWithObservations(
    usage: UsageData,
    observations: readonly ObservationNode[],
  ): { snapshotId: number; observationsWritten: number };
  /** raw address_context 기반 flow evidence 저장 (선택적 store capability) */
  saveFlowEvidence?(input: {
    readonly runId: string;
    readonly observedAt: string;
    readonly snapshotId?: number;
    readonly records: readonly {
      readonly timestamp: string;
      readonly addressContext: Readonly<Record<string, string>>;
      readonly logId?: string;
      readonly traceId?: string;
      readonly sessionId?: string;
      readonly eventKey?: string;
    }[];
  }): { recordsWritten: number };
  /** observation 노드 업데이트 (자동 해소용) */
  updateNode?(node: ObservationNode): void;
  /** 노드/엣지 추가 저장 (prompts 연결 등) */
  saveNodes?(
    nodes: readonly unknown[],
    edges: readonly { type: string; from: string; to: string }[],
    source: string,
  ): void;
}

// ── Pipeline 설정 ────────────────────────────────────

export interface ConvergencePipelineConfig {
  /** 건수 기반 flush 임계값 (default: 100) */
  recordThreshold?: number;
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
  /** 버퍼 depth gauge (optional) */
  metrics?: Pick<MetricsCollector, 'setGauge'>;
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
  flowObservationsResolved?: number;
  flowEvidence?: {
    readonly runId: string;
    readonly recordCount: number;
    readonly traceCount: number;
    readonly sessionCount: number;
    readonly observedPrefixes: readonly string[];
    readonly recordsPersisted: number;
  };
}

// ── Pipeline Runner ──────────────────────────────────

/** `/v1/patterns/stats`에 노출하는 상위 패턴·최근 이상 개수 */
const MAX_TOP_PATTERNS = 10;
const MAX_RECENT_ANOMALIES = 20;

export class ConvergencePipelineRunner {
  private readonly deps: ConvergencePipelineDeps;
  private readonly config: Required<ConvergencePipelineConfig>;
  private buffer: string[] = [];
  private flushing = false;
  private closed = false;

  constructor(deps: ConvergencePipelineDeps, config?: ConvergencePipelineConfig) {
    this.deps = deps;
    this.config = {
      recordThreshold: config?.recordThreshold ?? 100,
      maxBufferSize: config?.maxBufferSize ?? 10_000,
    };
  }

  /**
   * Phase 2 완료 후 traceId를 알린다.
   * threshold에 도달하면 자동 flush.
   */
  /** 마지막 패턴 분류 통계 — `/v1/patterns` route 공급 (U-2) */
  getPatternStats(): PatternStatsCache | null {
    return this.latestPatternStats;
  }

  notifyCompletion(traceIds: readonly string[]): void {
    if (this.closed) return;

    for (const id of traceIds) {
      if (this.buffer.length >= this.config.maxBufferSize) {
        // 메모리 cap — 강제 flush
        void this.flush().catch((err) => {
          this.deps.logger?.error({ err }, 'convergence cap flush failed');
        });
        break;
      }
      this.buffer.push(id);
    }

    this.reportBufferDepth();

    if (this.buffer.length >= this.config.recordThreshold) {
      void this.flush().catch((err) => {
        this.deps.logger?.error({ err }, 'convergence threshold flush failed');
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
    this.reportBufferDepth();

    try {
      return await this.runPipeline(traceIds);
    } catch (error) {
      this.deps.logger?.error(
        { err: error, traceCount: traceIds.length },
        'convergence pipeline flush failed',
      );
      return null;
    } finally {
      this.flushing = false;
    }
  }

  /** 정리: 신규 알림 차단 + 잔여 flush. */
  async close(): Promise<void> {
    this.closed = true;
    // 잔여 버퍼 flush
    if (this.buffer.length > 0) {
      await this.flush();
    }
  }

  get pendingCount(): number {
    return this.buffer.length;
  }

  // ── Private ────────────────────────────────────────

  private reportBufferDepth(): void {
    this.deps.metrics?.setGauge(CONVERGENCE_BUFFER_DEPTH_METRIC, this.buffer.length);
  }

  /** 이전 윈도우의 패턴 통계 (비율 비교용) */
  private previousPatternStats: PatternStats[] = [];

  /** `/v1/patterns` 조회용 마지막 패턴 분류 결과 (분류가 한 번도 없으면 null) */
  private latestPatternStats: PatternStatsCache | null = null;

  private async runPipeline(traceIds: string[]): Promise<ConvergenceFlushResult> {
    const {
      recordStore,
      convergenceFns,
      patternFns,
      graphProvider,
      catalogProvider,
      dkgStore,
      logger,
    } = this.deps;

    // 1. 레코드 조회 — address_context가 있는 것만 수집
    const addressRecords: AddressContextRecord[] = [];
    for (const traceId of traceIds) {
      try {
        const records = await recordStore.findByTraceId(traceId);
        for (const r of records) {
          const rec = r as unknown as Record<string, unknown>;
          if (rec.addressContext && typeof rec.addressContext === 'object') {
            const rawTimestamp = rec.timestamp ?? rec.createdAt;
            addressRecords.push({
              address_context: rec.addressContext as Record<string, string>,
              timestamp:
                rawTimestamp instanceof Date
                  ? rawTimestamp.toISOString()
                  : typeof rawTimestamp === 'string'
                    ? rawTimestamp
                    : new Date().toISOString(),
              log_id: String(rec.logId ?? rec.id ?? ''),
              trace_id: traceId,
              session_id: (rec.qaSessionId ?? rec.sessionId) as string | undefined,
              event_key: (rec.eventKey as string) ?? '',
              actor_id: rec.actorId as string | undefined,
              user_id: rec.userId as string | undefined,
            });
          }
        }
      } catch (error) {
        logger?.warn({ err: error, traceId }, 'convergence: failed to load records for trace');
      }
    }

    if (addressRecords.length === 0) {
      logger?.debug(
        { traceCount: traceIds.length },
        'convergence: no address_context records found',
      );
      return { recordsProcessed: 0, metricsCollected: 0, observationsGenerated: 0 };
    }

    // 2. 집계
    const catalog = catalogProvider();
    const usage = convergenceFns.aggregateUsageData(catalog, addressRecords);

    const graph = graphProvider();
    const observedAt = new Date().toISOString();
    const flowEvidenceRunId = `convergence-${observedAt}-${traceIds.length}`;

    // 3. flow evidence — metric보다 먼저 회복 상태를 반영한다.
    // 현재 배치에서 endpoint가 실제 관측된 IntentLink만 회복시키고,
    // 미관측 link는 정상 결과만으로 닫지 않는다.
    let flowViolationCount = 0;
    let flowObservations: readonly ObservationNode[] = [];
    let flowObservationsResolved = 0;
    if (convergenceFns.traceFlows) {
      try {
        const flowResult = convergenceFns.traceFlows(graph, addressRecords, {
          date: observedAt.slice(0, 10),
        });
        flowViolationCount = flowResult.violations.length;
        flowObservations = flowResult.observations;

        if (convergenceFns.resolveRecoveredFlowObservations) {
          const existingObs = graph.getNodesByKind(
            'observation',
          ) as unknown as readonly ObservationNode[];
          const resolved = convergenceFns.resolveRecoveredFlowObservations(
            graph,
            addressRecords,
            flowResult,
            existingObs,
            { date: observedAt.slice(0, 10) },
          );
          for (const observation of resolved) {
            graph.replaceNode?.(observation);
            dkgStore?.updateNode?.(observation);
          }
          flowObservationsResolved = resolved.length;
        }

        if (flowViolationCount > 0) {
          logger?.warn(
            { violations: flowViolationCount, summary: flowResult.summary },
            'convergence: IntentLink flow violations detected',
          );
        }
      } catch (error) {
        logger?.warn({ err: error }, 'convergence: flow-trace failed');
      }
    }

    // 4. metric 수집 — 현재 flow evidence가 반영된 graph를 사용한다.
    const metrics = convergenceFns.collectMetrics(catalog, graph, usage);

    // 5. 자동 observation 생성
    const observations: ObservationNode[] = [...convergenceFns.metricsToObservations(metrics)];

    // 5b. ok 복귀 metric의 자동 해소
    let autoResolvedCount = 0;
    if (convergenceFns.resolveRecoveredMetrics && dkgStore) {
      try {
        const existingObs = graph.getNodesByKind('observation') as unknown as ObservationNode[];
        const resolved = convergenceFns.resolveRecoveredMetrics(metrics, existingObs);
        if (resolved.length > 0) {
          for (const obs of resolved) {
            dkgStore.updateNode?.(obs);
          }
          autoResolvedCount = resolved.length;
        }
      } catch (error) {
        logger?.warn({ err: error }, 'convergence: auto-resolve failed');
      }
    }

    // 6. 패턴 분류 (에러 격리: 실패해도 metric pipeline 결과는 유지)
    let patternResult: PatternFlushResult | undefined;
    if (patternFns) {
      try {
        patternResult = this.runPatternClassification(
          addressRecords,
          patternFns,
          observations,
          logger,
        );
      } catch (error) {
        logger?.warn({ err: error }, 'convergence: pattern classification failed');
      }
    }

    // 6b. IntentLink 흐름 observation 추가 (검사는 3단계에서 선행)
    if (flowObservations.length > 0) {
      observations.push(...flowObservations);
    }

    // 7. DKG store 저장
    let snapshotId: number | undefined;
    let flowEvidenceRecordsPersisted = 0;
    if (dkgStore && usage) {
      try {
        const result = dkgStore.saveUsageSnapshotWithObservations(usage, observations);
        snapshotId = result.snapshotId;

        if (dkgStore.saveFlowEvidence) {
          try {
            const evidenceResult = dkgStore.saveFlowEvidence({
              runId: flowEvidenceRunId,
              observedAt,
              snapshotId,
              records: addressRecords.map((record) => ({
                timestamp: record.timestamp,
                addressContext: record.address_context,
                ...(record.log_id ? { logId: record.log_id } : {}),
                ...(record.trace_id ? { traceId: record.trace_id } : {}),
                ...(record.session_id ? { sessionId: record.session_id } : {}),
                ...(record.event_key ? { eventKey: record.event_key } : {}),
              })),
            });
            flowEvidenceRecordsPersisted = evidenceResult.recordsWritten;
          } catch (error) {
            logger?.warn({ err: error }, 'convergence: flow evidence persistence failed');
          }
        }

        // OBS-PATTERN → 관련 constraint prompts 연결 (scope가 observation subjects와 겹치는 active constraint)
        const promptsEdges = patternPromptEdges(
          observations.filter((o) => o.id.startsWith('OBS-PATTERN-')),
          graph,
        );
        if (promptsEdges.length > 0) {
          try {
            dkgStore.saveNodes?.([], promptsEdges, 'auto');
          } catch (error) {
            logger?.warn({ err: error }, 'convergence: pattern prompts edge 저장 실패');
          }
        }
      } catch (error) {
        logger?.error({ err: error }, 'convergence: failed to save snapshot');
      }
    }

    const flowEvidence = {
      runId: flowEvidenceRunId,
      recordCount: addressRecords.length,
      traceCount: new Set(addressRecords.map((record) => record.trace_id).filter(Boolean)).size,
      sessionCount: new Set(addressRecords.map((record) => record.session_id).filter(Boolean)).size,
      observedPrefixes: [
        ...new Set(addressRecords.flatMap((record) => Object.keys(record.address_context))),
      ].toSorted(),
      recordsPersisted: flowEvidenceRecordsPersisted,
    };

    logger?.info(
      {
        traceCount: traceIds.length,
        recordsProcessed: addressRecords.length,
        metricsCollected: metrics.length,
        observationsGenerated: observations.length,
        autoResolvedCount,
        flowViolationCount,
        flowObservationsResolved,
        flowEvidence,
        pattern: patternResult,
        snapshotId,
      },
      'convergence pipeline flush completed',
    );

    return {
      recordsProcessed: addressRecords.length,
      metricsCollected: metrics.length,
      observationsGenerated: observations.length,
      snapshotId,
      pattern: patternResult,
      flowViolations: flowViolationCount > 0 ? flowViolationCount : undefined,
      flowObservationsResolved: flowObservationsResolved > 0 ? flowObservationsResolved : undefined,
      flowEvidence,
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
      const sid = rec.session_id ?? 'unknown';
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
      const sorted = [...records].toSorted(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      const events = sorted.map((r) => ({
        event_key: r.event_key ?? '',
        timestamp: r.timestamp ?? new Date().toISOString(),
        actor_id: r.actor_id,
        user_id: r.user_id,
      }));

      // event_key가 없는 세션은 건너뜀
      if (events.every((e) => !e.event_key)) continue;

      const classification = fns.classifyPattern({ events, sessionId }, fns.patternRules);
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
      if (anomaly.severity === 'info') continue;
      observations.push({
        kind: 'observation',
        id: `OBS-PATTERN-${anomaly.kind}-${anomaly.detectedAt.slice(0, 10)}`,
        date: anomaly.detectedAt.slice(0, 10),
        source: 'runtime',
        subjects: ['pattern_anomaly', anomaly.kind],
        finding: `[${anomaly.severity}] ${anomaly.description} (kind=${anomaly.kind})`,
        intent: anomaly.severity === 'critical' ? 'action-needed' : 'monitoring',
        suggestion:
          anomaly.kind === 'unclassified'
            ? { kind: 'add-constraint', rule: '새 패턴 규칙 추가 검토' }
            : undefined,
      });
    }

    // 5. 건전성 보고서 생성 + 이전 통계 갱신
    const report = fns.buildPatternHealthReport(classifications, anomalies.length);
    this.previousPatternStats = [...report.stats];
    this.latestPatternStats = {
      lastFlushAt: report.generatedAt,
      sessionsClassified: classifications.length,
      classificationRate: report.classificationRate * 100,
      anomaliesDetected: anomalies.length,
      topPatterns: report.stats.slice(0, MAX_TOP_PATTERNS).map((stat) => ({
        pattern: stat.pattern,
        count: stat.count,
        ratio: stat.percentage,
      })),
      recentAnomalies: anomalies
        .filter((anomaly) => anomaly.severity !== 'info')
        .slice(-MAX_RECENT_ANOMALIES)
        .map((anomaly) => ({
          kind: anomaly.kind,
          severity: anomaly.severity,
          sessionId: anomaly.sessionId,
          description: anomaly.description,
          detectedAt: anomaly.detectedAt,
        })),
    };

    logger?.info(
      {
        sessionsClassified: classifications.length,
        classificationRate: report.classificationRate.toFixed(2),
        anomaliesDetected: anomalies.length,
        topPattern: report.stats[0]?.pattern,
      },
      'pattern classification completed',
    );

    return {
      sessionsClassified: classifications.length,
      anomaliesDetected: anomalies.length,
      classificationRate: report.classificationRate,
    };
  }
}

/**
 * pattern observation이 검토를 촉구(prompts)할 constraint를 DKG에서 찾는다.
 * constraint id를 코드에 두지 않고, scope가 observation subjects와 겹치는 active constraint를 고른다
 * (예: subjects `pattern_anomaly` → scope에 `pattern_anomaly`가 있는 CON-004·CON-005).
 */
export function patternPromptEdges(
  observations: readonly ObservationNode[],
  graph: Pick<ConvergenceGraphPort, 'getNodesByKind'>,
): { type: 'prompts'; from: string; to: string }[] {
  if (observations.length === 0) return [];
  const constraints = graph
    .getNodesByKind('constraint')
    .filter((node) => node.lifecycle === undefined || node.lifecycle === 'active');
  const edges: { type: 'prompts'; from: string; to: string }[] = [];
  for (const observation of observations) {
    const subjects = new Set(observation.subjects ?? []);
    for (const constraint of constraints) {
      const scope = Array.isArray(constraint.scope) ? (constraint.scope as unknown[]) : [];
      if (scope.some((item) => typeof item === 'string' && subjects.has(item))) {
        edges.push({ type: 'prompts', from: observation.id, to: constraint.id });
      }
    }
  }
  return edges;
}
