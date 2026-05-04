import type { QueryMetricEvent, TrafficMetricsCollector, Verdict } from "./types.js";

/** fingerprint별 집계 결과 */
export interface FingerprintAggregation {
  readonly fingerprint: string;
  readonly count: number;
  readonly avgDurationMs: number;
  readonly p95DurationMs: number;
  readonly verdicts: Readonly<Record<Verdict, number>>;
}

/** budget별 집계 결과 */
export interface BudgetAggregation {
  readonly budgetId: string;
  readonly totalQueries: number;
  readonly allowedQueries: number;
  readonly throttledQueries: number;
  readonly rejectedQueries: number;
  readonly avgDurationMs: number;
  readonly avgWaitedMs: number;
}

/**
 * 인메모리 메트릭 수집기. 개발/테스트/로컬 디버깅용.
 *
 * 최근 maxEvents개 이벤트를 보관하며 집계 함수를 제공한다.
 */
export class InMemoryMetricsCollector implements TrafficMetricsCollector {
  private events: QueryMetricEvent[] = [];
  private readonly maxEvents: number;

  constructor(opts?: { maxEvents?: number }) {
    this.maxEvents = opts?.maxEvents ?? 10_000;
  }

  record(event: QueryMetricEvent): void {
    this.events.push(event);
    // 초과 시 앞에서 제거
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /** 최근 N개 이벤트 조회 */
  getRecent(limit?: number): readonly QueryMetricEvent[] {
    if (limit === undefined) return [...this.events];
    return this.events.slice(-limit);
  }

  /** fingerprint별 집계 */
  aggregateByFingerprint(): readonly FingerprintAggregation[] {
    const groups = new Map<string, QueryMetricEvent[]>();
    for (const event of this.events) {
      const list = groups.get(event.fingerprint) ?? [];
      list.push(event);
      groups.set(event.fingerprint, list);
    }

    const results: FingerprintAggregation[] = [];
    for (const [fingerprint, events] of groups) {
      const durations = events.map((e) => e.durationMs).toSorted((a, b) => a - b);
      const verdicts: Record<Verdict, number> = { allow: 0, throttled: 0, rejected: 0 };
      for (const e of events) verdicts[e.verdict] += 1;

      results.push({
        fingerprint,
        count: events.length,
        avgDurationMs: durations.reduce((s, d) => s + d, 0) / durations.length,
        p95DurationMs: percentile(durations, 0.95),
        verdicts,
      });
    }

    return results.toSorted((a, b) => b.count - a.count);
  }

  /** budget별 집계 */
  aggregateByBudget(): readonly BudgetAggregation[] {
    const groups = new Map<string, QueryMetricEvent[]>();
    for (const event of this.events) {
      const key = event.budgetId ?? "__unmatched__";
      const list = groups.get(key) ?? [];
      list.push(event);
      groups.set(key, list);
    }

    const results: BudgetAggregation[] = [];
    for (const [budgetId, events] of groups) {
      let allowed = 0;
      let throttled = 0;
      let rejected = 0;
      let totalDuration = 0;
      let totalWaited = 0;

      for (const e of events) {
        if (e.verdict === "allow") allowed += 1;
        else if (e.verdict === "throttled") throttled += 1;
        else rejected += 1;
        totalDuration += e.durationMs;
        totalWaited += e.waitedMs;
      }

      results.push({
        budgetId,
        totalQueries: events.length,
        allowedQueries: allowed,
        throttledQueries: throttled,
        rejectedQueries: rejected,
        avgDurationMs: totalDuration / events.length,
        avgWaitedMs: totalWaited / events.length,
      });
    }

    return results.toSorted((a, b) => b.totalQueries - a.totalQueries);
  }

  /** tags.event_key가 있는 쿼리에서 event_key 목록 추출 (중복 제거) */
  collectEventKeys(): string[] {
    const keys = new Set<string>();
    for (const event of this.events) {
      const ek = event.tags.event_key;
      if (ek) keys.add(ek);
    }
    return [...keys];
  }

  /** tags.transition이 있는 쿼리에서 transition별 event_key 그룹 수집 */
  collectTransitionGroups(): Map<string, string[]> {
    const groups = new Map<string, Set<string>>();
    for (const event of this.events) {
      const tid = event.tags.transition;
      const ek = event.tags.event_key;
      if (!tid || !ek) continue;
      const set = groups.get(tid) ?? new Set();
      set.add(ek);
      groups.set(tid, set);
    }
    return new Map([...groups.entries()].map(([k, v]) => [k, [...v]]));
  }

  /** 전체 이벤트 수 */
  get size(): number {
    return this.events.length;
  }

  /** 초기화 */
  reset(): void {
    this.events = [];
  }
}

/**
 * 콜백 기반 메트릭 수집기.
 * ingest pipeline 연동 등 외부 전달용.
 */
export class CallbackMetricsCollector implements TrafficMetricsCollector {
  constructor(private readonly onRecord: (event: QueryMetricEvent) => void) {}

  record(event: QueryMetricEvent): void {
    this.onRecord(event);
  }
}

/**
 * 다중 수집기 팬아웃. 하나의 이벤트를 여러 수집기에 동시 전달.
 */
export class FanOutMetricsCollector implements TrafficMetricsCollector {
  constructor(private readonly collectors: readonly TrafficMetricsCollector[]) {}

  record(event: QueryMetricEvent): void {
    for (const collector of this.collectors) {
      collector.record(event);
    }
  }
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.ceil(p * sortedValues.length) - 1;
  return sortedValues[Math.max(0, idx)]!;
}
