// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import { Controller, Get } from "@nestjs/common";
import { trace } from "@opentelemetry/api";

const SERVICE_NAME = "sim-reporting-api";
const OWNED_PREFIXES = ["sim.report", "sim.metric"] as const;

@Controller()
export class HealthController {
  @Get("health")
  health() {
    const tracer = trace.getTracer(SERVICE_NAME);
    const otelStatus = tracer.constructor.name === "NoopTracer" ? "noop" : "ok";
    return {
      status: "ok",
      service: SERVICE_NAME,
      ownedPrefixes: OWNED_PREFIXES,
      role: "read-aggregate",
      otelStatus,

      ts: new Date().toISOString(),
    };
  }
}
