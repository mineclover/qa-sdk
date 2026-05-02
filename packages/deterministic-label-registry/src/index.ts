/**
 * Deterministic label registry — public barrel.
 *
 * System 단위 분할:
 *   - shared.ts:     pure 문자열/메타데이터 primitives (어떤 system도 의존 가능)
 *   - coordinate.ts: URN/kind/domain 좌표 모델 + diagnostic 빌더
 *   - projection.ts: DocumentEnvelope → candidate 투영 + document helpers
 *   - collision.ts:  candidate 충돌 감지
 *   - records.ts:    candidate → DeterministicLabelRecord 투영
 *   - inventory.ts:  inventory 조립 + summary
 *
 * FSM readiness 및 transition dry-run은 이 패키지 범위의 단순화 과정에서 제거됨 (2026-04-18).
 * 이는 전역 FSM 금지가 아니라 deterministic-label projection의 목적 단위 결정이다.
 * 상세: `deterministic-label-stability-boundary.memo.md`.
 */

// @def.boundary deterministic-label-architecture

export {
  buildSemanticCoordinateCandidate,
  isSemanticCoordinateLabelKind,
  SEMANTIC_COORDINATE_CANONICAL_EXAMPLES,
  SEMANTIC_COORDINATE_DIAGNOSTIC_CODES,
  SEMANTIC_COORDINATE_DOMAINS,
  SEMANTIC_COORDINATE_LABEL_KINDS,
  SEMANTIC_EXISTING_ID_SOURCES,
  SEMANTIC_PHYSICAL_REF_KINDS,
} from "./coordinate.js";

export type {
  SemanticCoordinate,
  SemanticCoordinateCandidate,
  SemanticCoordinateCandidateInput,
  SemanticCoordinateCandidateResult,
  SemanticCoordinateDiagnostic,
  SemanticCoordinateDiagnosticCode,
  SemanticCoordinateDomain,
  SemanticCoordinateLabelKind,
  SemanticExistingIdSource,
  SemanticPhysicalRef,
  SemanticPhysicalRefInput,
  SemanticPhysicalRefKind,
} from "./coordinate.js";

export {
  buildSemanticCoordinateCandidatesFromDocument,
  collectSemanticCoordinateCandidatesFromDocuments,
} from "./projection.js";

export type {
  SemanticCoordinateCandidateInventory,
  SemanticCoordinateCandidateInventoryOptions,
  SemanticCoordinateSkippedDocument,
} from "./projection.js";

export { detectSemanticCoordinateCandidateCollisions } from "./collision.js";

export {
  buildDeterministicLabelRecord,
  projectDeterministicLabelRecordsFromDocuments,
} from "./records.js";

export type {
  DeterministicLabelRecord,
  DeterministicLabelRecordInput,
  DeterministicLabelRecordProjection,
  DeterministicLabelRecordProjectionOptions,
} from "./records.js";

export { buildDeterministicLabelInventory } from "./inventory.js";

export type {
  DeterministicLabelInventory,
  DeterministicLabelInventoryOptions,
  DeterministicLabelInventorySummary,
} from "./inventory.js";
