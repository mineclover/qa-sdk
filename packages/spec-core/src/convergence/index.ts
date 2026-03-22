/**
 * convergence — @qa-sdk/convergence 패키지의 re-export barrel.
 *
 * 물리 분리 후 하위 호환을 위해 유지.
 * 새 코드는 `@qa-sdk/convergence`를 직접 import할 것.
 *
 * NOTE: GraphPort, DKG 타입 (DecisionNode 등), scaffoldDecision은
 * spec-core의 shared/ 및 dkg/ 에서 이미 export하므로 여기서 중복 export하지 않는다.
 */

// ── Types ──────────────────────────────────────────
export type {
  EntryUsage,
  AddressUsage,
  CoOccurrence,
  VersionUsage,
  UsageData,
  AxisOverlap,
  PrefixOverlap,
  DecisionConflict,
  CausalCandidate,
  SimplificationCandidate,
  SimplificationSuggestion,
  BoundaryRecommendation,
  CollectionHealthReport,
  OrphanAddress,
  StaleVersionUsage,
  DormantReason,
} from "@qa-sdk/convergence";

// ── 집계 (Aggregation) ─────────────────────────────
export { aggregateUsageData, analyzeCollectionHealth } from "@qa-sdk/convergence";
export { aggregateByDsl, aggregateByCategory, aggregateByService } from "@qa-sdk/convergence";
export type { ScopedUsage, BranchDistribution, ScopedReport } from "@qa-sdk/convergence";
export type { AddressContextRecord } from "@qa-sdk/convergence";

// ── 측정 (Measurement) ────────────────────────────
export { analyzeDeploymentSkew } from "@qa-sdk/convergence";
export type { DeploymentSkew } from "@qa-sdk/convergence";
export { analyzeEntryCoverage } from "@qa-sdk/convergence";
export type { EntryState, PrefixCoverage, DimCoverage, CoverageReport } from "@qa-sdk/convergence";
export { analyzeTemporalTrends } from "@qa-sdk/convergence";
export type { TimeWindow, TrendPoint, Anomaly, SlaViolation, SlaRule, TemporalReport } from "@qa-sdk/convergence";

// ── 비교 (Comparison) ─────────────────────────────
export { compareAxes, comparePrefixes, scanAxisOverlaps } from "@qa-sdk/convergence";
export { compareDecisions, scanDecisionConflicts } from "@qa-sdk/convergence";
export { discoverCausality, discoverCausalityWithObservations } from "@qa-sdk/convergence";

// ── 추천 (Recommendation) ─────────────────────────
export { analyzeSimplification, scanAllSimplifications } from "@qa-sdk/convergence";
export { recommendFromSimplification, recommendFromObservation, recommendFromCausality, recommendAll } from "@qa-sdk/convergence";
export { analyzeHeadroom, applyHeadroomDecisions } from "@qa-sdk/convergence";
export type { HeadroomIssue, HeadroomReport } from "@qa-sdk/convergence";
export { optimalCapacity, optimizeCapacities, optimizeWithImpact } from "@qa-sdk/convergence";
export type { CapacityRecommendation, CapacityOptimizationReport } from "@qa-sdk/convergence";

// ── 오케스트레이터 ─────────────────────────────────
export { runConvergenceAnalysis } from "@qa-sdk/convergence";
export type { ConvergenceReport } from "@qa-sdk/convergence";

// ── 기록 (Recording) ──────────────────────────────
export { recordSeparation, applySeparationRecord } from "@qa-sdk/convergence";
export type { SeparationRecord } from "@qa-sdk/convergence";
export { syncRefEntries, printSyncReport } from "@qa-sdk/convergence";
export type { RefEntrySyncResult } from "@qa-sdk/convergence";

// ── 필터 (Filtering) ──────────────────────────────
export { filterUsageByCategory, groupUsageByCategory, summarizeByCategory } from "@qa-sdk/convergence";

// ── 좌표 승격 ─────────────────────────────────────
export { scanPromotionCandidates } from "@qa-sdk/convergence";
export type { PromotionCandidate } from "@qa-sdk/convergence";

// ── Self-Check 분석 (Layer 2 순수 함수) ────────────
export { analyzeSelfCheck, SELF_CHECK_PKG_NAMES } from "@qa-sdk/convergence";
export type { SelfCheckResult, SelfCheckAnalysis, InvariantViolation } from "@qa-sdk/convergence";

// ── Metric 체계 ───────────────────────────────────
export type {
  MetricStatus,
  MetricValue,
  MetricThreshold,
  MetricDef,
  IngestFlowInput,
  RegistryFlowInput,
  GateFlowInput,
  DataFlowInput,
} from "@qa-sdk/convergence";
export { METRIC_DEFS, collectMetrics, metricsToObservations, resolveRecoveredMetrics } from "@qa-sdk/convergence";
export type { SchemaHealthAuditor, SchemaHealthReportLike } from "@qa-sdk/convergence";

// ── 패턴 분류 (ADR-006) ──────────────────────────
export { classifyPattern } from "@qa-sdk/convergence";
export type { ClassifierInput, ClassifierEvent } from "@qa-sdk/convergence";
export { DEMO_PATTERN_RULES, SYSTEM_PATTERN_RULES, SHOPPING_PATTERN_RULES, combinePatternRules } from "@qa-sdk/convergence";
export { detectAnomalies } from "@qa-sdk/convergence";
export type { AnomalyDetectionInput } from "@qa-sdk/convergence";
export { aggregatePatternStats, buildPatternHealthReport } from "@qa-sdk/convergence";
