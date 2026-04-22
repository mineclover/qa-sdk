// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import { Controller, Get } from "@nestjs/common";

const SERVICE_NAME = "sim-reporting-api";
const OWNED_PREFIXES = ["sim.report", "sim.metric"] as const;

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return {
      status: "ok",
      service: SERVICE_NAME,
      ownedPrefixes: OWNED_PREFIXES,
      role: "read-aggregate",
      ts: new Date().toISOString(),
    };
  }
}
