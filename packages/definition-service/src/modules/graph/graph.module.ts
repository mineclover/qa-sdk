import { Module } from "@nestjs/common";
import { DocsModule } from "../docs/docs.module.js";
import { GraphController } from "./graph.controller.js";
import { GraphService } from "./graph.service.js";

@Module({
  imports: [DocsModule],
  controllers: [GraphController],
  providers: [GraphService],
  exports: [GraphService],
})
export class GraphModule {}
