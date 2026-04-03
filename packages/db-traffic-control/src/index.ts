// ── 핵심 타입 ──────────────────────────────────────────────
export type {
  QueryAttributes,
  QueryOperation,
  BudgetMatchRule,
  BudgetLimits,
  BudgetDef,
  Verdict,
  QueryDecision,
  QueryMetricEvent,
  TrafficMetricsCollector,
  TrafficControllerConfig,
  ConcurrencyStatus,
  RateStatus,
  TrafficControllerSnapshot,
} from "./types.js";

// ── Budget 매칭 ────────────────────────────────────────────
export { matchBudget, matchAllBudgets, matchGlob } from "./budget.js";

// ── Fingerprint ────────────────────────────────────────────
export {
  extractFingerprint,
  extractOperation,
  extractTable,
  extractTableFromBuilder,
} from "./fingerprint.js";

// ── 제한기 ─────────────────────────────────────────────────
export { ConcurrencyLimiter, GLOBAL_CONCURRENCY_KEY } from "./concurrency-limiter.js";
export { RateLimiter } from "./rate-limiter.js";

// ── 컨트롤러 ──────────────────────────────────────────────
export { TrafficController } from "./controller.js";

// ── 메트릭 수집 ────────────────────────────────────────────
export {
  InMemoryMetricsCollector,
  CallbackMetricsCollector,
  FanOutMetricsCollector,
} from "./metrics.js";
export type { FingerprintAggregation, BudgetAggregation } from "./metrics.js";

// ── Drizzle 미들웨어 ──────────────────────────────────────
export { withTrafficControl, TrafficControlError } from "./drizzle-middleware.js";
export type { TrafficControlContext } from "./drizzle-middleware.js";

// ── Event Bridge (쿼리 ↔ event-catalog 교차 검증) ────────
export type { EventBridgeIssue, EventKeyCollector } from "./event-bridge.js";
export { validateQueryEventKeys, validateQueryTransitions } from "./event-bridge.js";
