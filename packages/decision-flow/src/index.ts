// @def.boundary df-system
/**
 * decision-flow — 의사결정 좌표계
 *
 * 소프트웨어/시스템 설계에서 반복되는 의사결정 과정을
 * 사전 설계된 직교 축으로 투영하여, "왜 이 결정을 했는가"를
 * 좌표 주소로 증명하는 다차원 벡터 공간 모델.
 *
 * 축 설계 (vocabulary)     — 설명력 높은 주성분을 사전 정의
 * 공간 구성 (catalog)      — 축 조합으로 관찰 가능한 좌표 공간 구성
 * 투영 (engine+coordinate) — 구체적 결정을 벡터 공간에 투영
 * 분석 (comparison+pattern)— 투영된 점들의 분포/이동/패턴 분석
 * 매핑 (observe+ingest)    — 비즈니스(X) ↔ 기술(Y)을 좌표로 연결
 * 검증 (orthogonality)     — 축 간 직교성이 실제 데이터에서도 유지되는지 검증
 *
 * @example
 * ```ts
 * import { FlowSchemaBuilder, FlowEngine } from "decision-flow";
 *
 * const schema = new FlowSchemaBuilder("feature-approval", "기능 승인")
 *   .description("기능 개발 승인 의사결정 플로우")
 *   .gate("risk", "위험도 평가", "perceive", [
 *     { id: "low", label: "낮음" },
 *     { id: "high", label: "높음" },
 *   ])
 *   .gate("approval", "승인 레벨", "decide", [
 *     { id: "auto", label: "자동" },
 *     { id: "director", label: "디렉터" },
 *   ])
 *   .build();
 *
 * const engine = new FlowEngine();
 * engine.registerSchema(schema);
 * const inst = engine.startFlow("feature-approval", { team: "payments" });
 * engine.selectBranch(inst.id, "high", [
 *   { kind: "data", source: "scan", content: "외부 API 포함", weight: 0.9 },
 * ]);
 * const result = engine.selectBranch(inst.id, "director");
 * // result.coordinateAddress → 1D 정수 (결정의 "왜"가 주소로 압축)
 * ```
 */

// ── types ────────────────────────────────────────────────
export type {
  CognitivePhase,
  GateWeight,
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
  DecisionUnit,
  DecisionVerdict,
  DecisionVerdictRecord,
  TestPlan,
  TestTarget,
  DecisionTrace,
  DecisionNarrative,
  NarrativeContext,
  NarrativeStep,
  NarrativeDestination,
  NarrativeOutcome,
  NarrativeTestResult,
  NarrativeReflection,
} from "./types.js";

export type {
  InstanceContextQuery,
  InstanceTimeRangeQuery,
  InstanceStore,
} from "./instance-store.js";

// ── schema ───────────────────────────────────────────────
export {
  FlowSchemaBuilder,
  validateFlowSchema,
  type ValidationIssue,
  type ValidationResult,
} from "./schema.js";

// ── engine ───────────────────────────────────────────────
export { FlowEngine } from "./engine.js";
export type { FlowEngineOptions, FlowEngineListener } from "./engine.js";

export { MemoryInstanceStore } from "./instance-store.js";

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

// ── policy-learning (패턴 학습) ──────────────────────────
export type {
  PatternContextValue,
  PatternGateSelection,
  PatternDetectionOptions,
  DetectedPattern,
  PolicyCandidateStatus,
  PolicyCandidate,
  PolicyCandidateThreshold,
  PolicyCandidateChanges,
  PolicyRegistrar,
  PolicyCandidateWorkflowOptions,
} from "./policy-learning.js";
export type {
  PatternClass,
  ClassifiedPattern,
} from "./policy-learning.js";
export {
  detectPatterns,
  generatePolicyCandidates,
  PolicyCandidateWorkflow,
  classifyPattern,
  classifyPatterns,
} from "./policy-learning.js";

// ── comparison (인스턴스 비교) ───────────────────────────
export type {
  GateDiffStatus,
  GateDiffEmphasis,
  EvidenceDiff,
  GateDiff,
  InstancePairDiff,
  BranchDistribution,
  DominantBranchHint,
  EvidenceKindBranchCorrelation,
  EvidenceKindCorrelation,
  GateDistribution,
  ComparisonTimeRange,
  TimeRangeComparisonOptions,
  ComparedRangeSummary,
  GateBranchShift,
  GateDistributionShift,
  ComparedPathSegment,
  TimeRangePathChange,
  TimeRangeComparison,
  ComparisonReportInput,
  DifferenceReasonType,
  DifferenceReasoning,
  DistributionInsight,
  TemporalShiftInsight,
  ComparisonReportSummary,
  ComparisonReport,
} from "./comparison.js";
export {
  diffInstances,
  gateDistribution,
  compareTimeRanges,
  createComparisonReport,
} from "./comparison.js";

// ── comparison 벡터 프레이밍 alias ──────────────────────
// 벡터 공간 분석 관점의 이름. 기존 이름도 유지 (하위호환).
export type {
  GateDiffEmphasis as GateImportanceLevel,
  EvidenceKindBranchCorrelation as EvidenceInfluence,
  ComparedRangeSummary as PeriodSnapshot,
  TemporalShiftInsight as TrendFinding,
  DifferenceReasonType as DivergenceCause,
  InstancePairDiff as VectorDiff,
  GateDistribution as DimensionDistribution,
  TimeRangeComparison as TemporalAnalysis,
} from "./comparison.js";
export {
  diffInstances as compareVectors,
  gateDistribution as analyzeDimension,
  compareTimeRanges as analyzeTemporalShift,
} from "./comparison.js";

// ── mental-model ─────────────────────────────────────────
export type {
  Reversibility,
  Magnitude,
  ReversibilityClassification,
  KnowledgeLayer,
  LayeredAnalysis,
  MentalModelId,
  MentalModel,
  AutoDecisionPrinciple,
  EscalationJudgment,
  ForcingQuestion,
} from "./mental-model.js";

export type {
  ModelAnswerCheck,
  GateModelValidation,
} from "./mental-model.js";

export {
  MENTAL_MODELS,
  FORCING_QUESTIONS,
  classifyEscalation,
  validateMentalModelAnswers,
  validateInstanceModelCoverage,
} from "./mental-model.js";

// ── vocabulary (도메인 단어) ──────────────────────────────
export type {
  ExplanatoryRole,
  AxisExplanatoryMeta,
} from "./vocabulary.js";

export {
  COGNITIVE_PHASE,
  FLOW_TYPE,
  EVIDENCE_KIND,
  MENTAL_MODEL_AXIS,
  ESCALATION_TYPE,
  DECISION_OUTCOME,
  SCOPE_MODE,
  REVERSIBILITY,
  MAGNITUDE,
  CONFIDENCE_BAND,
  FORCING_QUESTION_AXIS,
  DECISION_AXES,
  AXIS_META,
  discretizeConfidence,
} from "./vocabulary.js";

// ── catalog (prefix 정의) ────────────────────────────────
export {
  DECISION_CATALOG,
  DECISION_PREFIX_IDS,
  DECISION_AXIS_IDS,
} from "./catalog.js";

// ── observe (관찰 레이어) ────────────────────────────────
export type { ObservedEvent } from "./observe.js";
export {
  encodeDecisionEvent,
  encodeDecisionPath,
  encodeEscalation,
  encodeModelApplication,
  encodeForcingResponse,
  decodeObservedEvent,
  serializeObservedEvent,
  parseAndDecodeAddress,
} from "./observe.js";

// ── boundary (계층 + 컨텍스트 바운더리) ──────────────────
export type {
  DecisionLayerId,
  DecisionLayer,
  DecisionContext,
  ContextExport,
  ContextImport,
  LayerViolation,
  EscalationRequest,
} from "./boundary.js";
export {
  DECISION_LAYERS,
  getLayerForFlow,
  validateLayerConstraints,
  propagateScope,
  createEscalationRequest,
} from "./boundary.js";

// ── ingest-adapter (수집 파이프라인 연동) ─────────────────
export type { AddressContext } from "./ingest-adapter.js";
export {
  buildSelectionContext,
  buildPathContext,
  buildEscalationContext,
  buildModelContext,
  buildForcingContext,
  mergeContexts,
  buildFlowCompletionContext,
} from "./ingest-adapter.js";

// ── core-analysis (구조적 분석) ───────────────────────────
export type {
  GateProfile,
  CausalEdge,
  ImpactAnalysis,
  CoreDecisionTrace,
  PivotPoint,
} from "./core-analysis.js";
export {
  analyzeGateStructure,
  identifyCoreGates,
  extractCausalGraph,
  analyzeImpact,
  traceCorePath,
} from "./core-analysis.js";

// ── self-analysis (자기참조 분석) ─────────────────────────
export {
  COORDINATE_DESIGN_FLOW,
  getAnnotatedDesignFlow,
  recordQaSdkDesignDecisions,
  analyzeRecordedDecisions,
} from "./self-analysis.js";

// ── hierarchical-context (계층적 맥락 조합) ──────────────
export type {
  DomainInfo,
  DslBundleInfo,
  PrefixInfo,
  DimInfo,
  HierarchicalContext,
  HierarchySource,
} from "./hierarchical-context.js";
export {
  assembleHierarchicalContext,
  assembleMultiPrefixContext,
} from "./hierarchical-context.js";

// ── context-provider (컨텍스트 제공) ────────────────────
export type {
  DecisionContext as FlowDecisionContext,
  HistorySummary,
  PatternHint,
  PolicyHint,
  ModelHint,
  GateContext,
  ContextProviderDeps,
  FeatureLookup,
  FeatureInstance,
} from "./context-provider.js";
export { ContextProvider } from "./context-provider.js";

// ── dev-decisions (일상 개발 의사결정) ───────────────────
export {
  TEST_NEEDED_FLOW,
  SCOPE_EXPANSION_FLOW,
  STABILIZATION_FLOW,
  ARCHITECTURE_DECISION_FLOW,
  DECISION_ROUTER,
  DEV_DECISION_POLICIES,
  ALL_DEV_DECISION_FLOWS,
  DEV_DECISION_REGISTRY,
  DEV_DECISION_UNITS,
} from "./dev-decisions.js";

// ── monitor (실시간 모니터링) ──────────────────────────────
export type {
  SchemaMetrics,
  AlertSeverity,
  DecisionAlert,
  AlertHandler,
  MonitorConfig,
} from "./monitor.js";
export { DecisionMonitor } from "./monitor.js";

// ── narrative (서사 빌더) ────────────────────────────────
export type {
  BuildNarrativeInput,
  NarrativeDivergence,
} from "./narrative.js";
export {
  buildNarrative,
  extractPivotPoints,
  summarizeNarrative,
  findNarrativeDivergence,
  recordVerdict,
  evaluateDecision,
  summarizeDecisionOutcome,
} from "./narrative.js";

// ── orthogonality (직교성 검증) ──────────────────────────
export type {
  OrthogonalityResult,
  ObservedPair,
  PairExtractor,
} from "./orthogonality.js";
export {
  checkOrthogonality,
  extractPhaseEvidencePairs,
  extractEvidenceConfidencePairs,
  checkAllDeclaredOrthogonality,
} from "./orthogonality.js";

// ── sprint (gstack-inspired pipeline) ────────────────────
export {
  FORCING_QUESTIONS_FLOW,
  OFFICE_HOURS_FLOW,
  CEO_REVIEW_FLOW,
  ENG_REVIEW_FLOW,
  DESIGN_REVIEW_FLOW,
  CODE_REVIEW_FLOW,
  INVESTIGATION_FLOW,
  BUILD_FLOW,
  SHIP_FLOW,
  REFLECT_FLOW,
  SPRINT_PIPELINE,
  AUTOPLAN_POLICIES,
  ALL_SPRINT_FLOWS,
  SPRINT_FLOW_REGISTRY,
} from "./sprint.js";
