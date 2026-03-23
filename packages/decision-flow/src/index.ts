/**
 * decision-flow — 의사결정 분기 관리 시스템
 *
 * 의사결정 과정을 좌표 공간으로 모델링한다.
 * index-meta가 "공간의 좌표"를 다뤘다면, decision-flow는 "사고의 좌표"를 다룬다.
 *
 * @example
 * ```ts
 * import { FlowSchemaBuilder, FlowEngine } from "decision-flow";
 *
 * // 1. 스키마 정의
 * const schema = new FlowSchemaBuilder("feature-approval", "기능 승인")
 *   .description("기능 개발 승인 의사결정 플로우")
 *   .gate("risk", "위험도 평가", "perceive", [
 *     { id: "low", label: "낮음" },
 *     { id: "medium", label: "보통" },
 *     { id: "high", label: "높음" },
 *     { id: "critical", label: "치명적" },
 *   ])
 *   .gate("approval", "승인 레벨", "decide", [
 *     { id: "auto", label: "자동 승인" },
 *     { id: "lead", label: "팀 리드" },
 *     { id: "director", label: "디렉터" },
 *   ])
 *   .build();
 *
 * // 2. 엔진에 등록 + 인스턴스 시작
 * const engine = new FlowEngine();
 * engine.registerSchema(schema);
 * const inst = engine.startFlow("feature-approval", { team: "payments" });
 *
 * // 3. 분기 선택 (근거 첨부)
 * engine.selectBranch(inst.id, "high", [
 *   { kind: "data", source: "security-scan", content: "외부 API 호출 포함", weight: 0.9 },
 * ]);
 * const result = engine.selectBranch(inst.id, "director");
 *
 * // 4. 좌표 확인
 * console.log(result.coordinateAddress);
 * // → 8 (risk=high(3), approval=director(3) → 3×3 matrix에서 주소 8)
 * ```
 */

// ── types ────────────────────────────────────────────────
export type {
  CognitivePhase,
  EvidenceKind,
  Evidence,
  Condition,
  BranchSchema,
  GateSchema,
  OutcomeSchema,
  FlowSchema,
  FlowStatus,
  GateSelection,
  FlowInstance,
  PolicyAction,
  FlowPolicy,
  FlowCoordinateSpace,
  DecodedPath,
} from "./types.js";

// ── schema ───────────────────────────────────────────────
export {
  FlowSchemaBuilder,
  validateFlowSchema,
  type ValidationIssue,
  type ValidationResult,
} from "./schema.js";

// ── engine ───────────────────────────────────────────────
export { FlowEngine } from "./engine.js";

// ── coordinate ───────────────────────────────────────────
export {
  buildCoordinateSpace,
  createFlowIndex,
  encodeSelections,
  decodePath,
  resolveDeepPath,
  constraintForGate,
} from "./coordinate.js";

// ── policy ───────────────────────────────────────────────
export {
  evaluateCondition,
  evaluateAllConditions,
  findApplicablePolicies,
  resolvePolicyConflicts,
  tryAutoSelect,
} from "./policy.js";
