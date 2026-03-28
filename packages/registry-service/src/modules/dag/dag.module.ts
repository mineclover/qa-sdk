import { Module } from "@nestjs/common";
import { DagController } from "./dag.controller.js";
import { DagService } from "./dag.service.js";

@Module({
  controllers: [DagController],
  providers: [DagService],
})
export class DagModule {}
