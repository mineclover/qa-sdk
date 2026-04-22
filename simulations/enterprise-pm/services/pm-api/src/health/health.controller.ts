// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import { Controller, Get } from "@nestjs/common";

const SERVICE_NAME = "sim-pm-api";
const OWNED_PREFIXES = ["sim.project", "sim.task", "sim.member"] as const;

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return {
      status: "ok",
      service: SERVICE_NAME,
      ownedPrefixes: OWNED_PREFIXES,
      ts: new Date().toISOString(),
    };
  }
}
