import { Module } from "@nestjs/common";
import { DocsModule } from "../docs/docs.module.js";
import { GraphModule } from "../graph/graph.module.js";
import { DocResolver } from "./doc.resolver.js";

@Module({
  imports: [DocsModule, GraphModule],
  providers: [DocResolver],
})
export class DefinitionGraphQLModule {}
