/**
 * Spec Tracker 핵심 타입.
 *
 * ContractEvidence → ContractReport → VerificationSummary 3계층.
 * 수집기(collector), 리포터(reporter), 어댑터(vitest)가 공유한다.
 */

/** 계약 마커 종류 (definition-catalog ContractMarkerKind와 동일) */
export type ContractMarkerKind =
  | "inputs" | "outputs"
  | "precondition" | "postcondition"
  | "decision-point" | "failure"
  | "evidence" | "flow-steps";

/** 증거 상태 */
export type EvidenceStatus = "pass" | "fail" | "skip";

/** 증거 출처 */
export type EvidenceSource = "test" | "runtime";

/** 계약 증거 1건 — 테스트 또는 런타임에서 수집 */
export interface ContractEvidence {
  readonly specId: string;
  readonly marker?: ContractMarkerKind;
  readonly status: EvidenceStatus;
  readonly source: EvidenceSource;
  readonly testFile?: string;
  readonly testName?: string;
  readonly duration?: number;
  readonly error?: string;
  readonly timestamp: string;
}

/** 마커별 집계 */
export interface MarkerSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
}

/** specId별 집계 리포트 */
export interface ContractReport {
  readonly specId: string;
  readonly evidences: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly markers: Readonly<Record<string, MarkerSummary>>;
  readonly coverage: number;
  readonly lastVerified: string;
}

/** 전체 리포트 */
export interface VerificationSummary {
  readonly reports: readonly ContractReport[];
  readonly totalSpecs: number;
  readonly verifiedSpecs: number;
  readonly fullyPassed: number;
  readonly generatedAt: string;
}
