// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { Controller, Get } from "@nestjs/common";

const SERVICE_NAME = "sim-approval-api";
const OWNED_PREFIXES = ["sim.budget", "sim.resource", "sim.timeoff", "sim.expense"] as const;

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
