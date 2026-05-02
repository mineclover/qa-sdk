// @def.boundary sim-gateway
// @def.doc canary-routing-decision

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { createAdminRoutingRoute } from "./admin-routing.js";
import { InMemoryRoutingStore, type RouteEntry } from "../routing/routing-table.js";
import { parseCidrList } from "../lib/internal-network.js";

function makeApp() {
  const store = new InMemoryRoutingStore();
  const app = new Hono();
  app.route(
    "/",
    createAdminRoutingRoute({
      store,
      internalCidrs: parseCidrList("172.16.0.0/12"),
    }),
  );
  return { app, store };
}

const ENTRY: RouteEntry = {
  revision: 1,
  stable: { version: "v3", upstream: "http://sim-approval-api-v1:4500" },
  candidate: null,
  weight: 0,
  stickyKey: "user_id",
};

const post = (app: Hono, ip: string, body: unknown) =>
  app.fetch(
    new Request("http://gw/admin/routing", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
const get = (app: Hono, ip: string) =>
  app.fetch(new Request("http://gw/admin/routing", { headers: { "x-forwarded-for": ip } }));

describe("POST /admin/routing", () => {
  it("internal + valid → 200 applied=['sim-approval-api']", async () => {
    const { app, store } = makeApp();
    const res = await post(app, "172.17.0.5", { services: { "sim-approval-api": ENTRY } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applied: ["sim-approval-api"], skipped: [] });
    expect(store.getRoute("sim-approval-api")?.revision).toBe(1);
  });

  it("external IP → 404 silent (no commit)", async () => {
    const { app, store } = makeApp();
    const res = await post(app, "8.8.8.8", { services: { "sim-approval-api": ENTRY } });
    expect(res.status).toBe(404);
    expect(store.getRoute("sim-approval-api")).toBeUndefined();
  });

  it("stale revision → applied=[] + skipped 'stale-revision'", async () => {
    const { app, store } = makeApp();
    store.upsertRoute("sim-approval-api", { ...ENTRY, revision: 5 });
    const res = await post(app, "172.17.0.5", {
      services: { "sim-approval-api": { ...ENTRY, revision: 4 } },
    });
    const body = (await res.json()) as {
      applied: string[];
      skipped: Array<{ service: string; reason: string }>;
    };
    expect(body.applied).toEqual([]);
    expect(body.skipped).toEqual([{ service: "sim-approval-api", reason: "stale-revision" }]);
    expect(store.getRoute("sim-approval-api")?.revision).toBe(5);
  });

  it("malformed payload → 400 (no partial commit)", async () => {
    const { app, store } = makeApp();
    const res = await post(app, "172.17.0.5", {
      services: { "sim-approval-api": ENTRY, "sim-pm-api": { ...ENTRY, weight: 200 } },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_payload");
    expect(store.getRoute("sim-approval-api")).toBeUndefined();
  });
});

describe("GET /admin/routing", () => {
  it("internal → 200 snapshot; external → 404", async () => {
    const { app, store } = makeApp();
    store.upsertRoute("sim-approval-api", ENTRY);
    expect(
      ((await (await get(app, "172.17.0.5")).json()) as { routes: Record<string, RouteEntry> })
        .routes["sim-approval-api"],
    ).toEqual(ENTRY);
    expect((await get(app, "8.8.8.8")).status).toBe(404);
  });
});
