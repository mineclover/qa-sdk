// @def.boundary registry-system
// @def.doc registry-system

import { Controller, Get, Inject, Query, UseFilters } from "@nestjs/common";
import { ServiceExceptionFilter } from "./service.exception-filter.js";
import { ServiceHealthService } from "./service-health.service.js";

@UseFilters(new ServiceExceptionFilter())
@Controller("api/health/services")
export class ServiceHealthController {
  constructor(@Inject(ServiceHealthService) private readonly serviceHealth: ServiceHealthService) {}

  @Get()
  getSummary(
    @Query("catalog") catalogId?: string,
    @Query("env") envName?: string,
    @Query("namespace") namespace?: string,
    @Query("region") region?: string,
  ) {
    return this.serviceHealth.getSummary({
      catalogId: catalogId ?? "demo",
      envName: envName ?? "dev",
      namespace: namespace ?? "shop",
      region: region ?? "asia",
    });
  }
}
