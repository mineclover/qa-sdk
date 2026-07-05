// @def.boundary db-traffic-control-spec
// @def.doc db-traffic-control-spec
import type {
  BudgetDef,
  QueryAttributes,
  QueryDecision,
  QueryMetricEvent,
  TrafficControllerConfig,
  TrafficControllerSnapshot,
  TrafficMetricsCollector,
  Verdict,
} from "./types.js";
import { matchBudget } from "./budget.js";
import { ConcurrencyLimiter, GLOBAL_CONCURRENCY_KEY } from "./concurrency-limiter.js";
import { RateLimiter } from "./rate-limiter.js";

const ALLOW_DECISION: QueryDecision = {
  verdict: "allow",
  budgetId: null,
  budgetName: null,
  enforced: false,
  waitedMs: 0,
};

/**
 * Traffic Controller — Budget 매칭 → 동시성/QPS 제한 → 판정 → 메트릭 수집을 통합한다.
 *
 * 사용 흐름:
 * 1. beforeQuery(attrs) → 쿼리 실행 전 판정 + 슬롯 획득
 * 2. 쿼리 실행
 * 3. afterQuery(attrs, decision, durationMs) → 메트릭 기록 + 슬롯 해제
 *
 * drizzle-middleware.ts의 withTrafficControl()이 이 흐름을 자동화한다.
 */
export class TrafficController {
  private budgets: BudgetDef[];
  private readonly concurrency: ConcurrencyLimiter;
  private readonly rate: RateLimiter;
  private readonly collector: TrafficMetricsCollector | undefined;

  constructor(config: TrafficControllerConfig) {
    this.budgets = [...config.budgets];
    this.concurrency = new ConcurrencyLimiter();
    this.rate = new RateLimiter();
    this.collector = config.collector;

    // budget별 제한기 등록
    for (const budget of this.budgets) {
      this.registerLimiters(budget);
    }

    // 전역 동시성 등록
    if (config.globalMaxConcurrency !== undefined) {
      this.concurrency.register(GLOBAL_CONCURRENCY_KEY, config.globalMaxConcurrency);
    }
  }

  /**
   * 쿼리 실행 전 호출. Budget 매칭 → 제한 판정 → 슬롯 획득.
   *
   * 반환값의 release()를 afterQuery 또는 finally에서 반드시 호출해야 한다.
   * drizzle-middleware가 자동 호출하므로 직접 사용 시에만 주의.
   */
  async beforeQuery(attrs: QueryAttributes): Promise<{
    decision: QueryDecision;
    release: () => void;
  }> {
    const budget = matchBudget(attrs, this.budgets);

    // budget 미매칭 → 전역 제한만 확인
    if (!budget) {
      const globalRelease = this.tryGlobalAcquire();
      return { decision: ALLOW_DECISION, release: globalRelease };
    }

    // QPS 확인
    if (budget.limits.maxQps !== undefined) {
      const allowed = this.rate.tryConsume(budget.id);
      if (!allowed) {
        const decision = this.buildDecision(budget, "throttled", "QPS 초과", 0);
        return { decision, release: () => {} };
      }
    }

    // 동시성 확인
    if (budget.limits.maxConcurrency !== undefined) {
      const startWait = Date.now();
      const budgetRelease = this.concurrency.tryAcquire(budget.id);
      const globalRelease = this.tryGlobalAcquire();

      if (!budgetRelease) {
        globalRelease(); // 전역 슬롯 반환
        const waitedMs = Date.now() - startWait;
        const decision = this.buildDecision(budget, "rejected", "동시성 초과", waitedMs);
        return { decision, release: () => {} };
      }

      const release = () => {
        budgetRelease();
        globalRelease();
      };
      const waitedMs = Date.now() - startWait;
      const decision = this.buildDecision(budget, "allow", undefined, waitedMs);
      return { decision, release };
    }

    // 제한 없는 budget (매칭만)
    const globalRelease = this.tryGlobalAcquire();
    const decision = this.buildDecision(budget, "allow", undefined, 0);
    return { decision, release: globalRelease };
  }

  /**
   * 쿼리 실행 후 호출. 메트릭 기록.
   * release()는 별도로 호출되어야 함 (beforeQuery 반환값).
   */
  afterQuery(
    attrs: QueryAttributes,
    decision: QueryDecision,
    durationMs: number,
  ): void {
    if (!this.collector) return;

    const event: QueryMetricEvent = {
      timestamp: new Date().toISOString(),
      fingerprint: attrs.fingerprint,
      operation: attrs.operation,
      table: attrs.table,
      service: attrs.service,
      budgetId: decision.budgetId,
      verdict: decision.verdict,
      durationMs,
      waitedMs: decision.waitedMs,
      tags: attrs.tags,
    };

    this.collector.record(event);
  }

  /** Budget 동적 추가 (무중단) */
  addBudget(budget: BudgetDef): void {
    // 중복 방지
    this.removeBudget(budget.id);
    this.budgets.push(budget);
    this.registerLimiters(budget);
  }

  /** Budget 동적 제거 */
  removeBudget(budgetId: string): void {
    const idx = this.budgets.findIndex((b) => b.id === budgetId);
    if (idx === -1) return;
    this.budgets.splice(idx, 1);
    this.concurrency.unregister(budgetId);
    this.rate.unregister(budgetId);
  }

  /** Budget 모드 전환 (warn ↔ enforce) */
  setBudgetMode(budgetId: string, mode: "warn" | "enforce"): void {
    const budget = this.budgets.find((b) => b.id === budgetId);
    if (!budget) return;
    // BudgetDef는 readonly이므로 교체
    const idx = this.budgets.indexOf(budget);
    this.budgets[idx] = { ...budget, mode };
  }

  /** 전체 상태 스냅샷 */
  snapshot(): TrafficControllerSnapshot {
    const concurrency = this.concurrency.snapshot();
    const rates = this.rate.snapshot();

    const globalStatus = concurrency[GLOBAL_CONCURRENCY_KEY];
    const budgetConcurrency: Record<string, { current: number; max: number }> = {};
    for (const [key, status] of Object.entries(concurrency)) {
      if (key !== GLOBAL_CONCURRENCY_KEY) budgetConcurrency[key] = status;
    }

    return {
      budgets: [...this.budgets],
      concurrency: budgetConcurrency,
      rates,
      ...(globalStatus ? { globalConcurrency: globalStatus } : {}),
    };
  }

  /** 등록된 budget 목록 조회 */
  getBudgets(): readonly BudgetDef[] {
    return [...this.budgets];
  }

  private registerLimiters(budget: BudgetDef): void {
    if (budget.limits.maxConcurrency !== undefined) {
      this.concurrency.register(budget.id, budget.limits.maxConcurrency);
    }
    if (budget.limits.maxQps !== undefined) {
      this.rate.register(budget.id, budget.limits.maxQps);
    }
  }

  private tryGlobalAcquire(): () => void {
    const release = this.concurrency.tryAcquire(GLOBAL_CONCURRENCY_KEY);
    return release ?? (() => {}); // 전역 미등록 또는 초과 시 noop
  }

  private buildDecision(
    budget: BudgetDef,
    verdict: Verdict,
    reason: string | undefined,
    waitedMs: number,
  ): QueryDecision {
    return {
      verdict,
      budgetId: budget.id,
      budgetName: budget.name,
      reason,
      enforced: verdict !== "allow" && budget.mode === "enforce",
      waitedMs,
    };
  }
}
