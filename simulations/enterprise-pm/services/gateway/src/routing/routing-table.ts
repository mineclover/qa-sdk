// @def.boundary sim-gateway
// @def.doc canary-routing-decision
// spec 02 §3.2 RoutingTable in-memory store.

import { z } from "zod";

const UpstreamPairSchema = z.object({
  version: z.string().regex(/^v[1-9][0-9]*(-candidate|-retired)?$/),
  upstream: z.string().url(),
});

export const RouteEntrySchema = z.object({
  revision: z.number().int().nonnegative(),
  stable: UpstreamPairSchema,
  candidate: UpstreamPairSchema.nullable(),
  weight: z.number().int().min(0).max(100),
  stickyKey: z.literal("user_id"),
});

export type RouteEntry = z.infer<typeof RouteEntrySchema>;
export interface RoutingTable {
  routes: Record<string, RouteEntry>;
}
export interface UpsertResult {
  applied: boolean;
  reason?: "stale-revision";
}

export class InMemoryRoutingStore {
  private readonly routes = new Map<string, RouteEntry>();

  upsertRoute(serviceName: string, entry: RouteEntry): UpsertResult {
    const validated = RouteEntrySchema.parse(entry);
    const existing = this.routes.get(serviceName);
    if (existing && validated.revision <= existing.revision) {
      return { applied: false, reason: "stale-revision" };
    }
    this.routes.set(serviceName, validated);
    return { applied: true };
  }

  getRoute(serviceName: string): RouteEntry | undefined {
    return this.routes.get(serviceName);
  }

  dump(): RoutingTable {
    const snapshot: Record<string, RouteEntry> = {};
    for (const [k, v] of this.routes) {
      snapshot[k] = {
        ...v,
        stable: { ...v.stable },
        candidate: v.candidate ? { ...v.candidate } : null,
      };
    }
    return { routes: snapshot };
  }
}
