// @def.boundary sim-gateway
// @def.doc canary-routing-decision
// spec 02 §3.1 라우팅 결정 — 순수 함수, 외부 의존 없음.
// spec 2026-05-02 §9 Stage 2 — decideRouteWithTracking decoration wrapper.

import { stickyHashBucket } from "./sticky-hash.js";
import type { RouteEntry } from "./routing-table.js";
import type { StickyDecisionTracker } from "./sticky-decision-tracker.js";
export type { RouteEntry };

export interface RouteDecision {
  target: "stable" | "candidate";
  version: string;
  upstream: string;
  reason: "anonymous" | "no-candidate" | "rollback" | "sticky" | "full-canary";
  bucket?: number;
}

export interface DecideRouteArgs {
  entry: RouteEntry;
  userId: string | undefined;
}

export function decideRoute({ entry, userId }: DecideRouteArgs): RouteDecision {
  const stable = { version: entry.stable.version, upstream: entry.stable.upstream };
  if (entry.candidate === null) {
    return { target: "stable", ...stable, reason: "no-candidate" };
  }
  if (!userId) {
    return { target: "stable", ...stable, reason: "anonymous" };
  }
  if (entry.weight === 0) {
    return { target: "stable", ...stable, reason: "rollback" };
  }
  const cand = { version: entry.candidate.version, upstream: entry.candidate.upstream };
  if (entry.weight >= 100) {
    return { target: "candidate", ...cand, reason: "full-canary" };
  }
  const bucket = stickyHashBucket(userId);
  if (bucket < entry.weight) {
    return { target: "candidate", ...cand, reason: "sticky", bucket };
  }
  return { target: "stable", ...stable, reason: "sticky", bucket };
}

// spec 2026-05-02 §9 Stage 2 — 기존 decideRoute는 순수 함수로 유지하고
// tracker DI는 wrapper로 decoration. tracker 미주입/anonymous 시 record 생략 →
// legacy 호출자(Stage 7 이전) 와의 호환성 보존.

export interface DecideRouteWithTrackingArgs extends DecideRouteArgs {
  /** 미지정 시 wrapper는 단순 passthrough (record 생략). */
  tracker?: StickyDecisionTracker;
  /** 결정 시각. 미지정 시 호출 순간 `new Date()`. 테스트 결정성 위해 주입 가능. */
  now?: Date;
}

/**
 * decideRouteWithTracking — decideRoute의 decoration wrapper.
 *
 * spec §9 Stage 2: routing decision마다 `(user_id, version, at)` tuple을
 * StickyDecisionTracker에 push 한다. anonymous(userId 부재)는 sticky 의미가
 * 없으므로 record 생략 (decision 자체는 동일하게 stable로 분기됨).
 */
export function decideRouteWithTracking(
  args: DecideRouteWithTrackingArgs,
): RouteDecision {
  const decision = decideRoute({ entry: args.entry, userId: args.userId });
  if (args.tracker && args.userId) {
    args.tracker.record(args.userId, decision.version, args.now ?? new Date());
  }
  return decision;
}
