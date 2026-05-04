// @def.boundary df-analysis-group
/**
 * 의사결정 모니터 (Decision Monitor)
 *
 * FlowEngine에 리스너로 등록하여 결정을 실시간 관찰한다.
 *
 * 수집하는 메트릭:
 * - 결정 속도 (gate별 평균 confidence)
 * - 자동화 비율 (auto vs manual 선택)
 * - 스키마별 완료/포기 분포
 * - 코어 gate 선택 분포
 *
 * 알림 조건:
 * - confidence가 임계값 이하로 떨어짐
 * - 자동 선택 비율이 급변
 * - 코어 gate에서 이전과 다른 경로 선택
 * - 결정 공간의 새 영역에 처음 도달
 *
 * 단일 스레드 전용 (Node.js 기본). 멀티스레드 환경에서는 외부 동기화 필요.
 */

import type { FlowEngineListener } from "./engine.js";
import type { FlowInstance, GateSchema, GateSelection } from "./types.js";

// ─── 메트릭 타입 ─────────────────────────────────────────

/** 스키마별 집계 메트릭 */
export interface SchemaMetrics {
  readonly schemaId: string;
  /** 총 시작 수 */
  totalStarted: number;
  /** 총 완료 수 */
  totalCompleted: number;
  /** 총 gate 선택 수 */
  totalSelections: number;
  /** 자동 선택 수 */
  autoSelections: number;
  /** confidence 합계 (평균 계산용) */
  confidenceSum: number;
  /** 코어 gate 선택 분포: gateId → branchId → 횟수 */
  coreDistribution: Map<string, Map<string, number>>;
  /** 도달한 좌표 주소 집합 */
  reachedAddresses: Set<number>;
}

/** 알림 심각도 */
export type AlertSeverity = "info" | "warning" | "critical";

/** 모니터가 발행하는 알림 */
export interface DecisionAlert {
  readonly severity: AlertSeverity;
  readonly type: string;
  readonly message: string;
  readonly schemaId: string;
  readonly instanceId: string;
  readonly timestamp: string;
  readonly data?: Record<string, unknown>;
}

/** 알림 핸들러 */
export type AlertHandler = (alert: DecisionAlert) => void;

/** 모니터 설정 */
export interface MonitorConfig {
  /** confidence 경고 임계값 (기본 0.3) */
  readonly lowConfidenceThreshold?: number;
  /** 알림 핸들러 */
  readonly onAlert?: AlertHandler;
}

// ─── DecisionMonitor ─────────────────────────────────────

/**
 * 의사결정 모니터.
 *
 * engine.addListener(monitor)로 등록하면
 * 모든 결정 이벤트를 수집하고 알림을 발행한다.
 */
export class DecisionMonitor implements FlowEngineListener {
  private readonly metrics = new Map<string, SchemaMetrics>();
  private readonly alerts: DecisionAlert[] = [];
  private readonly config: Required<Pick<MonitorConfig, "lowConfidenceThreshold">>;
  private readonly onAlert?: AlertHandler;

  constructor(config: MonitorConfig = {}) {
    this.config = {
      lowConfidenceThreshold: config.lowConfidenceThreshold ?? 0.3,
    };
    this.onAlert = config.onAlert;
  }

  // ── 리스너 구현 ──────────────────────────────────────

  onFlowStarted(instance: FlowInstance): void {
    const m = this.getOrCreateMetrics(instance.schemaId);
    m.totalStarted++;
  }

  onGateSelected(instance: FlowInstance, selection: GateSelection, gate: GateSchema): void {
    const m = this.getOrCreateMetrics(instance.schemaId);
    m.totalSelections++;
    m.confidenceSum += selection.confidence;

    // 코어 gate 분포 추적
    if (gate.weight === "core") {
      let gateDist = m.coreDistribution.get(gate.id);
      if (!gateDist) {
        gateDist = new Map();
        m.coreDistribution.set(gate.id, gateDist);
      }
      gateDist.set(selection.branchId, (gateDist.get(selection.branchId) ?? 0) + 1);
    }

    // 알림: 낮은 confidence
    if (selection.confidence < this.config.lowConfidenceThreshold) {
      this.raiseAlert({
        severity: "warning",
        type: "low-confidence",
        message: `gate "${gate.id}"에서 confidence ${selection.confidence.toFixed(2)}로 결정 — 임계값 ${this.config.lowConfidenceThreshold} 미만`,
        schemaId: instance.schemaId,
        instanceId: instance.id,
        timestamp: selection.timestamp,
        data: { gateId: gate.id, branchId: selection.branchId, confidence: selection.confidence },
      });
    }

    // 알림: 코어 gate에서 소수 경로 선택 (기존 분포의 10% 미만 경로)
    if (gate.weight === "core") {
      const gateDist = m.coreDistribution.get(gate.id);
      if (gateDist) {
        const total = [...gateDist.values()].reduce((s, c) => s + c, 0);
        const thisCount = gateDist.get(selection.branchId) ?? 0;
        if (total > 5 && thisCount <= 1) {
          this.raiseAlert({
            severity: "info",
            type: "rare-core-path",
            message: `코어 gate "${gate.id}"에서 드문 경로 "${selection.branchId}" 선택 (${total}건 중 ${thisCount}건)`,
            schemaId: instance.schemaId,
            instanceId: instance.id,
            timestamp: selection.timestamp,
            data: { gateId: gate.id, branchId: selection.branchId, total, thisCount },
          });
        }
      }
    }
  }

  onAutoSelected(
    instance: FlowInstance,
    _gate: GateSchema,
    _action: { branchId: string; confidence: number },
  ): void {
    const m = this.getOrCreateMetrics(instance.schemaId);
    m.autoSelections++;
  }

  onFlowCompleted(instance: FlowInstance): void {
    const m = this.getOrCreateMetrics(instance.schemaId);
    m.totalCompleted++;

    // 좌표 추적
    if (instance.coordinateAddress !== undefined) {
      const isNew = !m.reachedAddresses.has(instance.coordinateAddress);
      m.reachedAddresses.add(instance.coordinateAddress);

      // 알림: 새 영역 도달
      if (isNew && m.totalCompleted > 3) {
        this.raiseAlert({
          severity: "info",
          type: "new-territory",
          message: `결정 공간의 새 영역에 도달: address ${instance.coordinateAddress} (스키마 "${instance.schemaId}")`,
          schemaId: instance.schemaId,
          instanceId: instance.id,
          timestamp: instance.completedAt ?? new Date().toISOString(),
          data: { address: instance.coordinateAddress, totalUniqueAddresses: m.reachedAddresses.size },
        });
      }
    }
  }

  // ── 메트릭 조회 ──────────────────────────────────────

  /** 스키마별 메트릭 조회 */
  getMetrics(schemaId: string): Readonly<SchemaMetrics> | undefined {
    return this.metrics.get(schemaId);
  }

  /** 전체 메트릭 스냅샷 */
  getAllMetrics(): ReadonlyMap<string, Readonly<SchemaMetrics>> {
    return this.metrics;
  }

  /** 평균 confidence (스키마별) */
  averageConfidence(schemaId: string): number | undefined {
    const m = this.metrics.get(schemaId);
    if (!m || m.totalSelections === 0) return undefined;
    return m.confidenceSum / m.totalSelections;
  }

  /** 자동화 비율 (스키마별) — 0~1 */
  automationRate(schemaId: string): number | undefined {
    const m = this.metrics.get(schemaId);
    if (!m || m.totalSelections === 0) return undefined;
    return m.autoSelections / m.totalSelections;
  }

  /** 완료율 (스키마별) — 0~1 */
  completionRate(schemaId: string): number | undefined {
    const m = this.metrics.get(schemaId);
    if (!m || m.totalStarted === 0) return undefined;
    return m.totalCompleted / m.totalStarted;
  }

  /** 도달한 고유 좌표 수 (결정 공간 탐색 범위) */
  uniqueAddressCount(schemaId: string): number {
    return this.metrics.get(schemaId)?.reachedAddresses.size ?? 0;
  }

  /** 발행된 알림 목록 */
  getAlerts(): readonly DecisionAlert[] {
    return this.alerts;
  }

  /** 특정 타입의 알림만 필터 */
  getAlertsByType(type: string): readonly DecisionAlert[] {
    return this.alerts.filter((a) => a.type === type);
  }

  // ── 내부 ──────────────────────────────────────────────

  private getOrCreateMetrics(schemaId: string): SchemaMetrics {
    let m = this.metrics.get(schemaId);
    if (!m) {
      m = {
        schemaId,
        totalStarted: 0,
        totalCompleted: 0,
        totalSelections: 0,
        autoSelections: 0,
        confidenceSum: 0,
        coreDistribution: new Map(),
        reachedAddresses: new Set(),
      };
      this.metrics.set(schemaId, m);
    }
    return m;
  }

  private raiseAlert(alert: DecisionAlert): void {
    this.alerts.push(alert);
    this.onAlert?.(alert);
  }
}
