// @def.boundary decision-service-spec
// @def.doc decision-service-spec

import { Module } from "@nestjs/common";
import { InstancesController } from "./instances.controller.js";
import { InstancesService } from "./instances.service.js";

@Module({
  controllers: [InstancesController],
  providers: [InstancesService],
  exports: [InstancesService],
})
export class InstancesModule {}
