// @def.boundary sim-gateway
// @def.doc canary-routing-decision
// spec 02 §3.1 라우팅 결정 — 순수 함수, 외부 의존 없음.

import { stickyHashBucket } from "./sticky-hash.js";
import type { RouteEntry } from "./routing-table.js";
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
