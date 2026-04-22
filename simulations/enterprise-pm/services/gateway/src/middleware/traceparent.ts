// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

import type { MiddlewareHandler } from "hono";

/**
 * traceparent 주입 미들웨어.
 *
 * Plan 10c: pass-through. 클라이언트의 traceparent를 그대로 전달.
 * Plan 12a: OTel context에서 active span을 read하여 downstream에 주입,
 *           없으면 신규 W3C trace 생성.
 */
export const traceparent: MiddlewareHandler = async (_c, next) => {
  // 본 plan은 통과만 — Plan 12a에서 OTel context 통합
  await next();
};
