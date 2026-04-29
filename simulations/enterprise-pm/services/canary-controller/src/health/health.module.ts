// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
