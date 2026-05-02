// @def.doc definition-service

import { Module } from "@nestjs/common";
import { TestsController } from "./tests.controller.js";
import { TestsService } from "./tests.service.js";
import { GraphModule } from "../graph/graph.module.js";

@Module({
  imports: [GraphModule],
  controllers: [TestsController],
  providers: [TestsService],
  exports: [TestsService],
})
export class TestsModule {}
