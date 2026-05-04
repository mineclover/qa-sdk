// @def.boundary system-support
// ── 쿼리 속성 (분류 입력) ──────────────────────────────────

/** 쿼리 실행 시 자동 추출되는 속성 */
export interface QueryAttributes {
  /** SQL 정규화 fingerprint (파라미터 제거) */
  readonly fingerprint: string;
  /** 쿼리 종류 */
  readonly operation: QueryOperation;
  /** 대상 테이블 */
  readonly table?: string;
  /** 발신 서비스 */
  readonly service?: string;
  /** DB 사용자 */
  readonly dbUser?: string;
  /** 커스텀 태그 (sqlcommenter 기반) */
  readonly tags: Readonly<Record<string, string>>;
}

export type QueryOperation = "select" | "insert" | "update" | "delete";

// ── Budget 정의 ────────────────────────────────────────────

/** Budget 매칭 규칙 — 지정된 조건이 모두 AND로 결합 */
export interface BudgetMatchRule {
  /** 쿼리 fingerprint 패턴 (glob: * 와일드카드 지원) */
  readonly fingerprint?: string;
  /** 쿼리 operation 필터 */
  readonly operations?: readonly QueryOperation[];
  /** 대상 테이블 (정확 일치, 복수) */
  readonly tables?: readonly string[];
  /** 발신 서비스 (정확 일치, 복수) */
  readonly services?: readonly string[];
  /** 커스텀 태그 조건 — 모든 key=value가 일치해야 함 */
  readonly tags?: Readonly<Record<string, string>>;
}

/** 리소스 제한 */
export interface BudgetLimits {
  /** 최대 동시 쿼리 수 */
  readonly maxConcurrency?: number;
  /** 초당 최대 쿼리 수 (QPS) */
  readonly maxQps?: number;
  /** 쿼리당 최대 실행 시간 (ms). 초과 시 AbortSignal.timeout 사용 */
  readonly maxDurationMs?: number;
}

/** Budget 정의 */
export interface BudgetDef {
  readonly id: string;
  readonly name: string;
  readonly match: BudgetMatchRule;
  readonly limits: BudgetLimits;
  /** warn: 로그만 (쿼리 차단 안 함), enforce: 실제 차단 */
  readonly mode: "warn" | "enforce";
  /** 우선순위 — 여러 budget 매칭 시 낮은 값 우선 */
  readonly priority: number;
}

// ── 판정 결과 ──────────────────────────────────────────────

export type Verdict = "allow" | "throttled" | "rejected";

export interface QueryDecision {
  readonly verdict: Verdict;
  readonly budgetId: string | null;
  readonly budgetName: string | null;
  /** 차단/쓰로틀 사유 */
  readonly reason?: string;
  /** enforce 모드에서만 true. warn 모드면 항상 false */
  readonly enforced: boolean;
  /** 동시성 제한으로 큐잉 대기한 시간 (ms) */
  readonly waitedMs: number;
}

// ── 메트릭 ─────────────────────────────────────────────────

export interface QueryMetricEvent {
  readonly timestamp: string;
  readonly fingerprint: string;
  readonly operation: string;
  readonly table?: string;
  readonly service?: string;
  readonly budgetId: string | null;
  readonly verdict: Verdict;
  readonly durationMs: number;
  readonly waitedMs: number;
  readonly tags: Readonly<Record<string, string>>;
}

/** 메트릭 수집 포트 — 구현체를 소비자가 주입 */
export interface TrafficMetricsCollector {
  record(event: QueryMetricEvent): void;
}

// ── 컨트롤러 설정 ──────────────────────────────────────────

export interface TrafficControllerConfig {
  readonly budgets: readonly BudgetDef[];
  readonly collector?: TrafficMetricsCollector;
  /** 전역 동시성 상한 (budget 무관, 미지정 시 무제한) */
  readonly globalMaxConcurrency?: number;
}

// ── 스냅샷 ─────────────────────────────────────────────────

export interface ConcurrencyStatus {
  readonly current: number;
  readonly max: number;
}

export interface RateStatus {
  readonly currentQps: number;
  readonly maxQps: number;
}

export interface TrafficControllerSnapshot {
  readonly budgets: readonly BudgetDef[];
  readonly concurrency: Readonly<Record<string, ConcurrencyStatus>>;
  readonly rates: Readonly<Record<string, RateStatus>>;
  readonly globalConcurrency?: ConcurrencyStatus;
}
