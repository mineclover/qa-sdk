// @def.boundary decision-service-spec
// @def.doc decision-service-spec

import { Module } from "@nestjs/common";
import { LinksController } from "./links.controller.js";
import { LinksService } from "./links.service.js";

@Module({
  controllers: [LinksController],
  providers: [LinksService],
  exports: [LinksService],
})
export class LinksModule {}
