// @def.boundary sim-canary-controller
// spec 2026-05-02 §5 — Pass 1 soft rollback 윈도우 + endpoint query 공유 SSOT.
//
// controller 자체 ring buffer가 SSOT. Pass 1 soft rollback 윈도우와 endpoint query 모두
// 본 ring buffer를 참조한다. maxSize=100 (env override SIM_CONTROLLER_RING_SIZE).

import type {
  SafetyDecisionRecordInput,
  ResourceDecisionRecordInput,
  AlertEventRecordInput,
} from "sim-decision-view";

export interface DecisionRingBufferOptions {
  /** maxSize. env SIM_CONTROLLER_RING_SIZE 로 override. default 100. */
  maxSize?: number;
}

export interface DecisionFilter {
  pass: "safety" | "resource";
  verdict?: string;
  cycleIds?: readonly string[];
  since?: string;
  limit?: number;
}

export interface AlertFilter {
  kind: string;
  cycleIds?: readonly string[];
  since?: string;
}

export interface TraceView {
  cycleId: string;
  cycleAt: string;
  safety?: SafetyDecisionRecordInput;
  resource?: ResourceDecisionRecordInput;
  events: AlertEventRecordInput[];
}

export class DecisionRingBuffer {
  private safetyRing: SafetyDecisionRecordInput[] = [];
  private resourceRing: ResourceDecisionRecordInput[] = [];
  private alertEvents: AlertEventRecordInput[] = [];
  private readonly maxSize: number;

  constructor(opts: DecisionRingBufferOptions = {}) {
    this.maxSize = Math.max(1, Math.floor(opts.maxSize ?? 100));
  }

  private push<T>(arr: T[], item: T): void {
    arr.push(item);
    while (arr.length > this.maxSize) arr.shift();
  }

  appendSafety(r: SafetyDecisionRecordInput): void {
    this.push(this.safetyRing, r);
  }

  appendResource(r: ResourceDecisionRecordInput): void {
    this.push(this.resourceRing, r);
  }

  appendAlert(e: AlertEventRecordInput): void {
    this.push(this.alertEvents, e);
  }

  queryDecisions(
    f: DecisionFilter,
  ): SafetyDecisionRecordInput[] | ResourceDecisionRecordInput[] {
    const ring = f.pass === "safety" ? this.safetyRing : this.resourceRing;
    let out = ring.filter(
      (r) =>
        (f.verdict === undefined || r.verdict === f.verdict) &&
        (!f.cycleIds || f.cycleIds.includes(r.cycleId)) &&
        (f.since === undefined || r.cycleAt >= f.since),
    );
    if (f.limit !== undefined) out = out.slice(0, Math.max(0, Math.floor(f.limit)));
    return out as SafetyDecisionRecordInput[] | ResourceDecisionRecordInput[];
  }

  queryFirst(
    f: Omit<DecisionFilter, "limit">,
  ): SafetyDecisionRecordInput | ResourceDecisionRecordInput | null {
    return this.queryDecisions({ ...f, limit: 1 })[0] ?? null;
  }

  recentCycleIds(limit: number): string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];
    const max = Math.max(0, Math.floor(limit));
    const sorted = [...this.safetyRing, ...this.resourceRing].sort((a, b) =>
      a.cycleAt < b.cycleAt ? 1 : a.cycleAt > b.cycleAt ? -1 : 0,
    );
    for (const r of sorted) {
      if (!seen.has(r.cycleId)) {
        seen.add(r.cycleId);
        ordered.push(r.cycleId);
        if (ordered.length >= max) break;
      }
    }
    return ordered;
  }

  recentCycleCount(): number {
    return new Set(
      [...this.safetyRing, ...this.resourceRing].map((r) => r.cycleId),
    ).size;
  }

  countAlerts(f: AlertFilter): number {
    return this.alertEvents.reduce(
      (n, e) =>
        e.kind === f.kind &&
        (!f.cycleIds || f.cycleIds.includes(e.cycleId)) &&
        (f.since === undefined || e.occurredAt >= f.since)
          ? n + 1
          : n,
      0,
    );
  }

  trace(cycleId: string): TraceView | null {
    const safety = this.safetyRing.find((r) => r.cycleId === cycleId);
    const resource = this.resourceRing.find((r) => r.cycleId === cycleId);
    if (!safety && !resource) return null;
    return {
      cycleId,
      cycleAt: safety?.cycleAt ?? resource?.cycleAt ?? new Date(0).toISOString(),
      safety,
      resource,
      events: this.alertEvents.filter((e) => e.cycleId === cycleId),
    };
  }

  /** spec 01 §3 dwell window — Pass 1 soft rollback 카운트용. true = FAIL. */
  recentSafetyHistory(n: number): boolean[] {
    return this.safetyRing
      .slice(-Math.max(0, Math.floor(n)))
      .map((r) => r.verdict === "rollback");
  }
}
