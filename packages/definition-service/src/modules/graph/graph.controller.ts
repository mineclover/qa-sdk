import { Controller, Get, Post, Inject, Param, NotFoundException, Query } from "@nestjs/common";
import { GraphService } from "./graph.service.js";

@Controller("graph")
export class GraphController {
  constructor(@Inject(GraphService) private readonly graph: GraphService) {}

  @Get(":docId/impact")
  impact(@Param("docId") docId: string) {
    const result = this.graph.impact(docId);
    if (!result) throw new NotFoundException(`문서 ${docId} 없음`);
    return result;
  }

  @Get("by-address/:address/impact")
  impactByAddress(@Param("address") address: string) {
    const result = this.graph.impactByAddress(address);
    if (!result) throw new NotFoundException(`주소 ${address} 문서 없음`);
    return result;
  }

  @Get(":docId/concerns")
  concerns(@Param("docId") docId: string) {
    const result = this.graph.concerns(docId);
    if (!result) throw new NotFoundException(`문서 ${docId} 없음`);
    return result;
  }

  @Get(":docId/boundary-context")
  boundaryContext(
    @Param("docId") docId: string,
    @Query("level") level?: string,
    @Query("mode") mode?: string,
  ) {
    const result = this.graph.boundaryContext(
      docId,
      level === "purpose" ? "purpose" : "overview",
      mode === "direct" ? "direct" : "transitive",
    );
    if (!result) throw new NotFoundException(`문서 ${docId} 없음`);
    return result;
  }

  @Get("by-address/:address/boundary-context")
  boundaryContextByAddress(
    @Param("address") address: string,
    @Query("level") level?: string,
    @Query("mode") mode?: string,
  ) {
    const result = this.graph.boundaryContextByAddress(
      address,
      level === "purpose" ? "purpose" : "overview",
      mode === "direct" ? "direct" : "transitive",
    );
    if (!result) throw new NotFoundException(`주소 ${address} 문서 없음`);
    return result;
  }

  /** 그래프 검증 — 깨진 링크, 순환 참조, 고아 문서 */
  @Post("validate")
  validate() {
    return this.graph.validate();
  }
}
