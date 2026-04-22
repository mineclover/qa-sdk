// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Controller, Get } from "@nestjs/common";

const SERVICE_NAME = "sim-auth-api";
const OWNED_PREFIXES = ["sim.user", "sim.role", "sim.dept", "sim.bitmap"] as const;

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
