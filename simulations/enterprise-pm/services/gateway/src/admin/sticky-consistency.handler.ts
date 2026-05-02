// @def.boundary sim-gateway / @def.doc gateway-sticky-consistency
// spec 2026-05-02 §9 Stage 2 — gateway sticky-consistency endpoint handler.
//
// internal IP guard 는 호출자(app.ts) 에서 internalIpMiddleware 로 부착한다.
// 본 모듈은 query parsing + tracker 호출 + RFC 7807 응답 만 담당.

import type { Handler } from "hono";
import { z } from "zod";
import type { StickyDecisionTracker } from "../routing/sticky-decision-tracker.js";

const QuerySchema = z.object({
  windowMinutes: z.coerce.number().int().positive().optional(),
});

/** spec §9 Stage 2 응답 shape — sim-handles 와의 contract 키. */
export interface StickyConsistencyResponse {
  ratio: number;
  sample: number;
  inconsistentUsers: number;
  window: { from: string; to: string };
}

export interface StickyConsistencyHandlerOptions {
  /** 라우팅 결정 ring buffer. server.ts 에서 부팅 시 한 번 인스턴스화. */
  tracker: StickyDecisionTracker;
  /**
   * 현재 시각 주입 — 테스트 결정성 위해. 미지정 시 호출 순간 `new Date()`.
   * window 계산 (`now - N*60s ~ now`) 의 anchor 로 쓰인다.
   */
  now?: () => Date;
}

/**
 * createStickyConsistencyHandler — Hono Handler factory.
 *
 * - query `?windowMinutes=N` (자연수) → `now - N*60s ~ now` window ratio
 * - 미지정 → 전체 buffer ratio
 * - zod 검증 실패 (음수, 비정수 등) → 400 RFC 7807
 */
export function createStickyConsistencyHandler(
  opts: StickyConsistencyHandlerOptions,
): Handler {
  const now = opts.now ?? (() => new Date());
  return (c) => {
    const parsed = QuerySchema.safeParse({
      windowMinutes: c.req.query("windowMinutes"),
    });
    if (!parsed.success) {
      return c.json(
        {
          type: "https://qa-sdk.dev/errors/validation",
          title: "invalid query",
          status: 400,
          detail: parsed.error.issues.map((i) => i.message).join("; "),
        },
        400,
      );
    }
    const window = parsed.data.windowMinutes
      ? {
          from: new Date(now().getTime() - parsed.data.windowMinutes * 60_000),
          to: now(),
        }
      : undefined;
    const r = opts.tracker.getRatio(window);
    const body: StickyConsistencyResponse = {
      ratio: r.ratio,
      sample: r.sample,
      inconsistentUsers: r.inconsistentUsers,
      window: r.window,
    };
    return c.json(body);
  };
}
