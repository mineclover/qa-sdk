// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { MarginalDensityService } from "./density.service.js";

/**
 * GET /density?catalog=sim&prefix=sim.bitmap&version=uv1
 * §5 §3.1 endpoint 시그니처 정확 매칭.
 */
@Controller("density")
export class DensityController {
  constructor(private readonly svc: MarginalDensityService) {}

  @Get()
  async density(
    @Query("catalog") catalog: string,
    @Query("prefix") prefix: string,
    @Query("version") version: string,
  ) {
    if (!catalog || !prefix || !version) {
      throw new BadRequestException({
        error: "missing_query_params",
        required: ["catalog", "prefix", "version"],
      });
    }
    return this.svc.compute({ catalog, prefix, version });
  }
}
