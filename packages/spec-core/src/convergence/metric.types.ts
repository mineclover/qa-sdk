/**
 * Metric 타입 정의 — convergence 함수에 대한 표준 측정 명칭 체계.
 *
 * metric ID 형식: "metric:<category>:<target>"
 *   metric:headroom:<axis>     — 축 여유 공간
 *   metric:skew:<prefix>       — 배포 버전 스큐
 *   metric:coverage:<prefix>   — entry 관측 커버리지
 *   metric:overlap:<a>:<b>     — 축 중복
 *   metric:conflict:decisions  — 결정 충돌
 *   metric:health:<domain>     — 도메인 건강
 *   metric:invariant:<dsl>     — DSL 불변조건 위반
 *
 * @layer 측정 (Measurement)
 */

import type { AddressContextRecord } from "./usage-aggregator.js";

// ═══════════════════════════════════════════════════════════════
//  Metric 정의
// ═══════════════════════════════════════════════════════════════

export type MetricStatus = "ok" | "warning" | "critical";

export interface MetricValue {
  readonly id: string;
  readonly name: string;
  readonly value: number;
  readonly status: MetricStatus;
  readonly detail?: string;
  readonly target?: string;
  readonly measuredAt?: string;
}

export interface MetricThreshold {
  readonly warning: number;
  readonly critical: number;
  /** true = 값이 threshold 이상이면 경고 (default), false = 이하이면 경고 */
  readonly above?: boolean;
}

export interface MetricDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: "headroom" | "skew" | "coverage" | "overlap" | "conflict" | "health" | "invariant";
  readonly autoRunnable: boolean;
  readonly threshold: MetricThreshold;
  /** 이 metric을 측정하는 convergence 함수 */
  readonly measureFn: string;
}

// ═══════════════════════════════════════════════════════════════
//  서비스 데이터 흐름 타입
// ═══════════════════════════════════════════════════════════════

/** ingest-server의 데이터 흐름 입력 */
export interface IngestFlowInput {
  readonly source: "ingest";
  readonly records: readonly AddressContextRecord[];
}

/** registry-service의 데이터 흐름 입력 */
export interface RegistryFlowInput {
  readonly source: "registry";
  readonly catalog: unknown;
}

/** gate-service의 데이터 흐름 입력 */
export interface GateFlowInput {
  readonly source: "gate";
  readonly versionEvent: {
    readonly subjectId: string;
    readonly subjectKind: "axis" | "prefix";
    readonly fromVersion: string;
    readonly toVersion: string;
  };
}

export type DataFlowInput = IngestFlowInput | RegistryFlowInput | GateFlowInput;
