// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

import { Hono } from "hono";

export function createHealthRoutes() {
  const r = new Hono();
  r.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "sim-gateway",
      role: "edge-router",
      ownedPrefixes: [],
      ts: new Date().toISOString(),
    }),
  );
  return r;
}
