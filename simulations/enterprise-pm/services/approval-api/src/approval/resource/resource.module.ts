import { Module } from "@nestjs/common";
import { ResourceService } from "./resource.service.js";
import { ResourceController } from "./resource.controller.js";

@Module({
  providers: [ResourceService],
  controllers: [ResourceController],
  exports: [ResourceService],
})
export class ResourceModule {}
