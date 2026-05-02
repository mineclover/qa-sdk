// @def.boundary decision-service-spec
// @def.doc decision-service-spec

import { Body, Controller, Delete, Get, Inject, Param, Post, NotFoundException } from "@nestjs/common";
import { LinksService, type FlowLinkType } from "./links.service.js";

@Controller("links")
export class LinksController {
  constructor(@Inject(LinksService) private readonly links: LinksService) {}

  /** 의사결정 → 문서 연결 등록 */
  @Post()
  async link(@Body() body: { instanceId: string; docId: string; linkType: FlowLinkType }) {
    return this.links.link(body.instanceId, body.docId, body.linkType);
  }

  /** 의사결정이 만든 문서 목록 */
  @Get("instance/:instanceId")
  findByInstance(@Param("instanceId") instanceId: string) {
    return { links: this.links.findByInstance(instanceId) };
  }

  /** 문서에 연결된 의사결정 목록 */
  @Get("doc/:docId")
  findByDoc(@Param("docId") docId: string) {
    return { links: this.links.findByDoc(docId) };
  }

  /** 연결 삭제 */
  @Delete(":instanceId/:docId/:linkType")
  unlink(
    @Param("instanceId") instanceId: string,
    @Param("docId") docId: string,
    @Param("linkType") linkType: FlowLinkType,
  ) {
    const deleted = this.links.unlink(instanceId, docId, linkType);
    if (!deleted) throw new NotFoundException("연결 없음");
    return { ok: true };
  }
}
