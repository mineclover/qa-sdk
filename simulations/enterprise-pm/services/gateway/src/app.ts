// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

import { Hono } from "hono";
import { requestId } from "./middleware/request-id.js";
import { traceparent } from "./middleware/traceparent.js";
import { createHealthRoutes } from "./routes/health.js";
import { createPlaceholderRoutes } from "./routes/placeholder.js";

export function createApp() {
  const app = new Hono();
  app.use("*", requestId);
  app.use("*", traceparent);
  app.route("/", createHealthRoutes());
  app.route("/", createPlaceholderRoutes());
  return app;
}
