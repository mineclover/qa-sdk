// @def.boundary sim-gateway
// @def.doc canary-routing-decision
// spec 02 §3.4 escape hatch. 외부 IP의 헤더는 silent ignore (정보 노출 X).

import type { MiddlewareHandler } from "hono";
import { isInternalIp, type Cidr } from "../lib/internal-network.js";

export interface CanaryOverride {
  target: "stable" | "candidate";
  version: string;
}
export interface CanaryOverrideOptions {
  internalCidrs: Cidr[];
}

const OVERRIDE_PATTERN = /^(stable|candidate):(v[1-9][0-9]*(?:-candidate|-retired)?)$/;

function clientIp(req: Request): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0]?.trim() || undefined : undefined;
}

export function canaryOverrideMiddleware(opts: CanaryOverrideOptions): MiddlewareHandler {
  return async (c, next) => {
    const headerValue = c.req.header("x-canary-override");
    if (!headerValue) {
      await next();
      return;
    }
    const ip = clientIp(c.req.raw);
    if (!ip || !isInternalIp(ip, opts.internalCidrs)) {
      await next();
      return;
    }
    const m = headerValue.match(OVERRIDE_PATTERN);
    if (!m) {
      await next();
      return;
    }
    c.set("canary-override", {
      target: m[1] as "stable" | "candidate",
      version: m[2]!,
    } satisfies CanaryOverride);
    await next();
  };
}
