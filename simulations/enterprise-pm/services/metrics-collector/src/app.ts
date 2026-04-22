// @def.boundary sim-metrics-collector
// @def.doc sim-erp-pm-design

import { Hono } from "hono";
import type { Registry } from "prom-client";
import { createHealthRoutes } from "./routes/health.js";
import { createMetricsRoutes } from "./routes/metrics.js";

export interface AppDeps {
  registry: Registry;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  app.route("/", createHealthRoutes());
  app.route("/", createMetricsRoutes({ registry: deps.registry }));
  return app;
}
