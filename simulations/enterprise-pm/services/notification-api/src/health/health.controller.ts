// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import { Controller, Get } from "@nestjs/common";

const SERVICE_NAME = "sim-notification-api";
const OWNED_PREFIXES = ["sim.notif", "sim.subscribe"] as const;

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return {
      status: "ok",
      service: SERVICE_NAME,
      ownedPrefixes: OWNED_PREFIXES,
      role: "producer-subscriber",
      ts: new Date().toISOString(),
    };
  }
}
