// @def.boundary sim-gateway
// @def.doc canary-routing-decision
// spec 02 §3.2 — controller가 push, gateway가 권위. 외부 접근은 404 silent.

import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import { type InMemoryRoutingStore, RouteEntrySchema } from "../routing/routing-table.js";
import { isInternalIp, type Cidr } from "../lib/internal-network.js";

const RoutingPushSchema = z.object({
  services: z.record(z.string().min(1), RouteEntrySchema),
});

export interface CreateAdminRoutingOptions {
  store: InMemoryRoutingStore;
  internalCidrs: Cidr[];
}

function clientIp(req: Request): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0]?.trim() || undefined : undefined;
}

export function createAdminRoutingRoute(opts: CreateAdminRoutingOptions) {
  const r = new Hono();
  const guard: MiddlewareHandler = async (c, next) => {
    const ip = clientIp(c.req.raw);
    if (!ip || !isInternalIp(ip, opts.internalCidrs)) {
      return c.json({ error: "not_found" }, 404);
    }
    await next();
  };
  r.use("/admin/routing", guard);
  r.use("/admin/routing/*", guard);

  r.get("/admin/routing", (c) => c.json(opts.store.dump()));

  r.post("/admin/routing", async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json(
        { error: "invalid_payload", issues: [{ message: "non-JSON body" }] },
        400,
      );
    }
    const parsed = RoutingPushSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "invalid_payload", issues: parsed.error.issues }, 400);
    }
    // 모든 entry zod 검증 통과 후 store에 commit (atomic-per-request).
    const applied: string[] = [];
    const skipped: Array<{ service: string; reason: string }> = [];
    for (const [name, entry] of Object.entries(parsed.data.services)) {
      const result = opts.store.upsertRoute(name, entry);
      if (result.applied) applied.push(name);
      else skipped.push({ service: name, reason: result.reason ?? "unknown" });
    }
    return c.json({ applied, skipped });
  });

  return r;
}
