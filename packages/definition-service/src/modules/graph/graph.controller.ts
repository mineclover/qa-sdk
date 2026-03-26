import { Controller, Get, Inject, Param, NotFoundException } from "@nestjs/common";
import { GraphService } from "./graph.service.js";

@Controller("graph")
export class GraphController {
  constructor(@Inject(GraphService) private readonly graph: GraphService) {}

  @Get(":docId/impact")
  async impact(@Param("docId") docId: string) {
    const result = await this.graph.impact(docId);
    if (!result) throw new NotFoundException(`문서 ${docId} 없음`);
    return result;
  }

  @Get(":docId/concerns")
  async concerns(@Param("docId") docId: string) {
    const result = await this.graph.concerns(docId);
    if (!result) throw new NotFoundException(`문서 ${docId} 없음`);
    return result;
  }
}
