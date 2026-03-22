/**
 * convergence — 수렴 분석 sub-path barrel.
 *
 * 집계, 측정, 비교, 추천, 오케스트레이터, 기록, 필터, 패턴 분류 전체를 제공.
 */

// ── Types ──────────────────────────────────────────
export type {
  EntryUsage,
  AddressUsage,
  CoOccurrence,
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
} from "./convergence.types.js";

// ── 집계 (Aggregation) ─────────────────────────────
export { aggregateUsageData, analyzeCollectionHealth } from "./usage-aggregator.js";
export { aggregateByDsl, aggregateByCategory, aggregateByService } from "./scoped-aggregator.js";
export type { ScopedUsage, BranchDistribution, ScopedReport } from "./scoped-aggregator.js";
export type { AddressContextRecord } from "./usage-aggregator.js";

// ── 측정 (Measurement) ────────────────────────────
export { analyzeDeploymentSkew } from "./deployment-skew.js";
export type { DeploymentSkew } from "./deployment-skew.js";
export { analyzeEntryCoverage } from "./entry-coverage.js";
export type { EntryState, PrefixCoverage, DimCoverage, CoverageReport } from "./entry-coverage.js";
export { analyzeTemporalTrends } from "./temporal-analysis.js";
export type { TimeWindow, TrendPoint, Anomaly, SlaViolation, SlaRule, TemporalReport } from "./temporal-analysis.js";

// ── 비교 (Comparison) ─────────────────────────────
export { compareAxes, comparePrefixes, scanAxisOverlaps } from "./symbol-comparator.js";
export { compareDecisions, scanDecisionConflicts } from "./decision-comparator.js";
export { discoverCausality, discoverCausalityWithObservations } from "./causal-discovery.js";

// ── 추천 (Recommendation) ─────────────────────────
export { analyzeSimplification, scanAllSimplifications } from "./simplification-advisor.js";
export { recommendFromSimplification, recommendFromObservation, recommendFromCausality, recommendAll } from "./boundary-recommender.js";
export { analyzeHeadroom, applyHeadroomDecisions } from "./headroom-advisor.js";
export type { HeadroomIssue, HeadroomReport } from "./headroom-advisor.js";
export { optimalCapacity, optimizeCapacities, optimizeWithImpact } from "./capacity-optimizer.js";
export type { CapacityRecommendation, CapacityOptimizationReport } from "./capacity-optimizer.js";

// ── 오케스트레이터 ─────────────────────────────────
export { runConvergenceAnalysis } from "./convergence-runner.js";
export type { ConvergenceReport } from "./convergence-runner.js";

// ── 기록 (Recording) ──────────────────────────────
export { recordSeparation, applySeparationRecord } from "./separation-record.js";
export type { SeparationRecord } from "./separation-record.js";

// ── 필터 (Filtering) ──────────────────────────────
export { filterUsageByCategory, groupUsageByCategory, summarizeByCategory } from "./category-filter.js";

// ── 좌표 승격 ─────────────────────────────────────
export { scanPromotionCandidates } from "./promotion-scanner.js";
export type { PromotionCandidate } from "./promotion-scanner.js";

// ── Self-Check 분석 (Layer 2 순수 함수) ────────────
export { analyzeSelfCheck, SELF_CHECK_PKG_NAMES } from "./self-check-analyzer.js";
export type { SelfCheckResult, SelfCheckAnalysis, InvariantViolation } from "./self-check-analyzer.js";

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
} from "./metric.types.js";
export { METRIC_DEFS, collectMetrics, metricsToObservations, resolveRecoveredMetrics } from "./metric-registry.js";

// ── 패턴 분류 (ADR-006) ──────────────────────────
export { classifyPattern } from "./pattern-classifier.js";
export type { ClassifierInput, ClassifierEvent } from "./pattern-classifier.js";
export { DEMO_PATTERN_RULES, SYSTEM_PATTERN_RULES, SHOPPING_PATTERN_RULES, combinePatternRules } from "./pattern-rules.js";
export { detectAnomalies } from "./pattern-anomaly.js";
export type { AnomalyDetectionInput } from "./pattern-anomaly.js";
export { aggregatePatternStats, buildPatternHealthReport } from "./pattern-aggregator.js";
