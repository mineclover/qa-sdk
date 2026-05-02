// @def.boundary sim-internal-network
// spec 2026-05-02 §3 — Hono 환경(gateway)용. external IP → 404 silent.

import type { MiddlewareHandler } from "hono";
import { isInternalIp } from "./is-internal-ip.js";

export interface InternalIpMiddlewareOptions {
  /** XFF 헤더 우선순위 사용 여부. default true (gateway 컨텍스트). */
  trustForwardedFor?: boolean;
}

function extractIp(c: Parameters<MiddlewareHandler>[0], opts: InternalIpMiddlewareOptions): string | null {
  if (opts.trustForwardedFor !== false) {
    const xff = c.req.header("x-forwarded-for");
    if (xff && xff.length > 0) {
      const leftmost = xff.split(",")[0]?.trim();
      if (leftmost) return leftmost;
    }
  }
  const env = (c.env ?? {}) as { remoteAddress?: string; remoteAddr?: string };
  if (typeof env.remoteAddress === "string" && env.remoteAddress.length > 0) return env.remoteAddress;
  if (typeof env.remoteAddr === "string" && env.remoteAddr.length > 0) return env.remoteAddr;
  return null;
}

export function internalIpMiddleware(opts: InternalIpMiddlewareOptions = {}): MiddlewareHandler {
  return async (c, next) => {
    const ip = extractIp(c, opts);
    if (ip === null || !isInternalIp(ip)) return c.body(null, 404);
    await next();
  };
}
