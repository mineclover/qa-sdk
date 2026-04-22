// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { Hono } from "hono";
import { trace } from "@opentelemetry/api";

export function createHealthRoutes() {
  const r = new Hono();
  r.get("/health", (c) => {
    const tracer = trace.getTracer("sim-gateway");
    const otelStatus = tracer.constructor.name === "NoopTracer" ? "noop" : "ok";
    return c.json({
      status: "ok",
      service: "sim-gateway",
      role: "edge-router",
      ownedPrefixes: [],
      otelStatus,
      ts: new Date().toISOString(),
    });
  });
  return r;
}
