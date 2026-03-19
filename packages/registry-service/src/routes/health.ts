import { Hono } from "hono";

export function createHealthRoutes() {
  const routes = new Hono();

  routes.get("/health", (c) =>
    c.json({ ok: true, service: "registry-service" }),
  );

  routes.get("/health/live", (c) => c.json({ ok: true }));

  return routes;
}
