import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { internalIpMiddleware } from "./hono-middleware.js";

function buildApp() {
  const app = new Hono();
  app.use("*", internalIpMiddleware());
  app.get("/admin/ping", (c) => c.json({ ok: true }));
  return app;
}
const fire = (h: Record<string, string>) => buildApp().fetch(new Request("http://t/admin/ping", { headers: h }));

describe("internalIpMiddleware (spec §3)", () => {
  it("internal → 200, external/missing → 404, multi-IP는 leftmost로 분기", async () => {
    const okBody = await (await fire({ "x-forwarded-for": "172.17.0.5" })).json();
    expect(okBody).toEqual({ ok: true });
    for (const xff of ["8.8.8.8", "8.8.8.8, 172.17.0.5"]) {
      expect((await fire({ "x-forwarded-for": xff })).status).toBe(404);
    }
    expect((await fire({ "x-forwarded-for": "172.17.0.5, 10.0.0.1, 8.8.8.8" })).status).toBe(200);
    expect((await fire({})).status).toBe(404);
  });
});
