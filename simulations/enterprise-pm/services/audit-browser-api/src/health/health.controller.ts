// @def.boundary sim-audit-browser-api
// @def.doc sim-erp-pm-design

import { Controller, Get } from "@nestjs/common";

const SERVICE_NAME = "sim-audit-browser-api";

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return {
      status: "ok",
      service: SERVICE_NAME,
      ownedPrefixes: [] as string[], // view-only — own 없음
      role: "read-aggregate",
      reads: ["audit-recorder-store"] as const,
      ts: new Date().toISOString(),
    };
  }
}
