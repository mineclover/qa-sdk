// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
