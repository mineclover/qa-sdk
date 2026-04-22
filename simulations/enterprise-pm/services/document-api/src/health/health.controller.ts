// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import { Controller, Get } from "@nestjs/common";

const SERVICE_NAME = "sim-document-api";
const OWNED_PREFIXES = ["sim.doc", "sim.comment", "sim.attachment"] as const;

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return {
      status: "ok",
      service: SERVICE_NAME,
      ownedPrefixes: OWNED_PREFIXES,
      role: "producer",
      ts: new Date().toISOString(),
    };
  }
}
