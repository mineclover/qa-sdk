import { Controller, Get, Inject, Param, Query, NotFoundException } from "@nestjs/common";
import { DocsService } from "./docs.service.js";

@Controller("docs")
export class DocsController {
  constructor(@Inject(DocsService) private readonly docs: DocsService) {}

  @Get()
  list(
    @Query("scope") scope?: string,
    @Query("aspect") aspect?: string,
    @Query("lifecycle") lifecycle?: string,
  ) {
    const docs = this.docs.list({ scope, aspect, lifecycle });
    return { docs, total: docs.length };
  }

  @Get(":docId")
  get(@Param("docId") docId: string) {
    const doc = this.docs.get(docId);
    if (!doc) throw new NotFoundException(`문서 ${docId} 없음`);
    return doc;
  }

  @Get(":docId/history")
  history(@Param("docId") docId: string, @Query("limit") limit?: string) {
    const history = this.docs.getHistory(docId, limit ? Number(limit) : undefined);
    return { docId, history, total: history.length };
  }

  @Get(":docId/history/:version")
  version(@Param("docId") docId: string, @Param("version") version: string) {
    const record = this.docs.getVersion(docId, Number(version));
    if (!record) throw new NotFoundException(`문서 ${docId} v${version} 없음`);
    return record;
  }
}
