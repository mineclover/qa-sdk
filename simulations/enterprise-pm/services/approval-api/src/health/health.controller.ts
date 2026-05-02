// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { Controller, Get } from "@nestjs/common";
import { trace } from "@opentelemetry/api";

const SERVICE_NAME = "sim-approval-api";
const OWNED_PREFIXES = ["sim.budget", "sim.resource", "sim.timeoff", "sim.expense"] as const;

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
      otelStatus,

      ts: new Date().toISOString(),
    };
  }
}
