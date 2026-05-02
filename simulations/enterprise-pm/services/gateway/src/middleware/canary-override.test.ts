// @def.boundary sim-gateway
// @def.doc canary-routing-decision

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { canaryOverrideMiddleware } from "./canary-override.js";
import { parseCidrList } from "../lib/internal-network.js";

function buildApp() {
  const app = new Hono();
  app.use("*", canaryOverrideMiddleware({ internalCidrs: parseCidrList("172.16.0.0/12") }));
  app.get("/echo", (c) => c.json({ override: c.get("canary-override") ?? null }));
  return app;
}

const fire = (h: Record<string, string>) =>
  buildApp().fetch(new Request("http://t/echo", { headers: h }));

describe("canaryOverrideMiddleware (spec §3.4)", () => {
  it("internal IP + valid header → context set", async () => {
    const r = await fire({
      "x-canary-override": "candidate:v4-candidate",
      "x-forwarded-for": "172.17.0.5",
    });
    expect(await r.json()).toEqual({
      override: { target: "candidate", version: "v4-candidate" },
    });
  });

  it("external IP / malformed / missing XFF → silent ignore (200, override null)", async () => {
    for (const h of [
      { "x-canary-override": "candidate:v4-candidate", "x-forwarded-for": "8.8.8.8" },
      { "x-canary-override": "garbage", "x-forwarded-for": "172.17.0.5" },
      { "x-canary-override": "candidate:v4-candidate" },
    ]) {
      const r = await fire(h);
      expect(r.status).toBe(200);
      expect(((await r.json()) as { override: unknown }).override).toBeNull();
    }
  });

  it("multi-IP XFF leftmost is client (172.17.0.5 trusted)", async () => {
    const r = await fire({
      "x-canary-override": "candidate:v4-candidate",
      "x-forwarded-for": "172.17.0.5, 10.0.0.1",
    });
    expect(((await r.json()) as { override: unknown }).override).not.toBeNull();
  });
});
