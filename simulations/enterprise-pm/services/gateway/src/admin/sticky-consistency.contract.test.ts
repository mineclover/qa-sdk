// @def.boundary sim-gateway / @def.doc gateway-sticky-consistency
// spec 2026-05-02 §10 Stage 2 Contract — sim-handles ↔ gateway endpoint shape.
//
// Plan defect note (Task 2.5):
//   초안 plan §2.5.1 은 `@sim/scenarios/runner/sim-handles/gateway-sticky-consistency`
//   에서 `GatewayStickyConsistencyResponse` 타입 import + 양방향 typecheck 를 지시했다.
//   현실:
//     1. 해당 파일은 타입을 export 하지 않는다 (inline `{ consistent, total }` 사용).
//     2. sim-handles 가 사용하는 shape `{ consistent, total }` 자체가 spec §9 shape
//        `{ ratio, sample, inconsistentUsers, window }` 와 일치하지 않는다 — Plan E
//        Stage 11 follow-up 에서 Plan B 보다 먼저 머지된 코드로 보인다.
//   Resolution:
//     - 본 contract test 는 spec §9 응답 shape 을 직접 단언한다 (정적 SSOT).
//     - sim-handles 의 타입 export 추가 + shape 정렬은 별도 PR (sim-handles 패키지)
//       범위로 분리. 본 plan 은 gateway 측 endpoint 가 spec §9 shape 을 정확히
//       내보내는지만 보장.
//     - build-time drift gate (_typecheck import) 는 sim-handles 가 타입을 export 한
//       이후에 별도 commit 으로 활성화 (defect log 참조).

import { describe, it, expect, expectTypeOf } from "vitest";
import { Hono } from "hono";
import {
  createStickyConsistencyHandler,
  type StickyConsistencyResponse,
} from "./sticky-consistency.handler.js";
import { StickyDecisionTracker } from "../routing/sticky-decision-tracker.js";
import { internalIpMiddleware } from "sim-internal-network";

/**
 * spec §9 Stage 2 응답 shape (canonical SSOT — spec 문서에서 인용).
 * sim-handles 가 동일 shape 으로 전환되면 이 타입 별칭을
 * `import type { GatewayStickyConsistencyResponse } from sim-handles` 로 교체.
 */
interface SpecGatewayStickyConsistencyResponse {
  ratio: number;
  sample: number;
  inconsistentUsers: number;
  window: { from: string; to: string };
}

describe("Stage 2 contract — gateway endpoint ↔ spec §9 shape", () => {
  it("StickyConsistencyResponse ≡ spec §9 응답 shape (양방향 typecheck)", () => {
    expectTypeOf<StickyConsistencyResponse>().toMatchTypeOf<SpecGatewayStickyConsistencyResponse>();
    expectTypeOf<SpecGatewayStickyConsistencyResponse>().toMatchTypeOf<StickyConsistencyResponse>();
  });

  it("실제 JSON 키 셋 + 타입 매치", async () => {
    const t = new StickyDecisionTracker({ maxSize: 10 });
    t.record("u-1", "v3", new Date("2026-05-02T00:00:00Z"));
    const app = new Hono();
    app.use("/admin/*", internalIpMiddleware());
    app.get(
      "/admin/routing/sticky-consistency",
      createStickyConsistencyHandler({ tracker: t }),
    );
    const res = await app.fetch(
      new Request("http://gw/admin/routing/sticky-consistency", {
        headers: { "x-forwarded-for": "172.17.0.5" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SpecGatewayStickyConsistencyResponse;
    expect(Object.keys(body).sort()).toEqual([
      "inconsistentUsers",
      "ratio",
      "sample",
      "window",
    ]);
    expect(typeof body.ratio).toBe("number");
    expect(typeof body.sample).toBe("number");
    expect(typeof body.inconsistentUsers).toBe("number");
    expect(typeof body.window.from).toBe("string");
    expect(typeof body.window.to).toBe("string");
    expect(() => new Date(body.window.from)).not.toThrow();
    expect(() => new Date(body.window.to)).not.toThrow();
  });
});
