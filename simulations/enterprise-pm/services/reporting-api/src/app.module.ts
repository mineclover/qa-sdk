// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [HealthModule],
})
export class AppModule {}
