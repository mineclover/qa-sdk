// @def.boundary sim-metrics-collector
// @def.doc sim-erp-pm-design

import { Hono } from "hono";

export function createHealthRoutes() {
  const r = new Hono();
  r.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "sim-metrics-collector",
      role: "exporter",
      ownedPrefixes: [],
      ts: new Date().toISOString(),
    }),
  );
  return r;
}
