// @def.boundary sim-gateway
// @def.doc canary-routing-decision

import { describe, it, expect } from "vitest";
import { decideRoute, type RouteEntry } from "./route-decision.js";

const stableOnly: RouteEntry = {
  revision: 1,
  stable: { version: "v3", upstream: "http://sim-approval-api-v1:4500" },
  candidate: null,
  weight: 0,
  stickyKey: "user_id",
};
const wc: RouteEntry = {
  ...stableOnly,
  revision: 2,
  candidate: { version: "v4-candidate", upstream: "http://sim-approval-api-v2:4500" },
  weight: 10,
};

describe("decideRoute (spec §3.1/§3.3)", () => {
  it("no candidate / anonymous / weight=0 → stable (no-candidate, anonymous, rollback)", () => {
    expect(decideRoute({ entry: stableOnly, userId: "u" }).reason).toBe("no-candidate");
    expect(decideRoute({ entry: wc, userId: undefined }).reason).toBe("anonymous");
    expect(decideRoute({ entry: { ...wc, weight: 0 }, userId: "u" }).reason).toBe("rollback");
  });

  it("weight=100 → candidate for any userId", () => {
    expect(decideRoute({ entry: { ...wc, weight: 100 }, userId: "x" }).target).toBe("candidate");
  });

  it("weight=50 → ~50% candidate over 1000 users", () => {
    const half: RouteEntry = { ...wc, weight: 50 };
    let cand = 0;
    for (let i = 0; i < 1000; i++) {
      if (decideRoute({ entry: half, userId: `u-${i}` }).target === "candidate") cand++;
    }
    expect(cand).toBeGreaterThan(400);
    expect(cand).toBeLessThan(600);
  });
});
