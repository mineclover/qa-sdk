// @def.boundary sim-audit-browser-api
// @def.doc sim-erp-pm-design

import { Controller, Get } from "@nestjs/common";
import { trace } from "@opentelemetry/api";

const SERVICE_NAME = "sim-audit-browser-api";

@Controller()
export class HealthController {
  @Get("health")
  health() {
    const tracer = trace.getTracer(SERVICE_NAME);
    const otelStatus = tracer.constructor.name === "NoopTracer" ? "noop" : "ok";
    return {
      status: "ok",
      service: SERVICE_NAME,
      ownedPrefixes: [] as string[], // view-only — own 없음
      role: "read-aggregate",
      reads: ["audit-recorder-store"] as const,
      otelStatus,

      ts: new Date().toISOString(),
    };
  }
}
