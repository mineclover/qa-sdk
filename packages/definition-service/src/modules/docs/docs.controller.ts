// @def.doc definition-service

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Optional,
  Param,
  Patch,
  Post,
  Query,
  NotFoundException,
} from "@nestjs/common";
import type { DocMetadataUpdate } from "../../core/interfaces.js";
import type { AxisRegistry } from "../../core/axis-registry.js";
import { AXIS_REGISTRY } from "../../core/tokens.js";
import { DocsService } from "./docs.service.js";

@Controller("docs")
export class DocsController {
  constructor(
    @Inject(DocsService) private readonly docs: DocsService,
    @Optional() @Inject(AXIS_REGISTRY) private readonly axisRegistry?: AxisRegistry,
  ) {}

  @Get()
  list(
    @Query("type") type?: string,
    @Query("knowledge-kind") knowledgeKind?: string,
    @Query("level") level?: string,
    @Query("scope") scope?: string,
    @Query("aspect") aspect?: string,
    @Query("depth") depth?: string,
    @Query("lifecycle") lifecycle?: string,
    @Query("layer") layer?: string,
    @Query("svc") svc?: string,
    @Query("tag") tag?: string,
    @Query("address") address?: string,
    @Query("q") q?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("sort") sort?: string,
  ) {
    const result = this.docs.listPaginated({
      type, knowledgeKind, level, scope, aspect, depth, lifecycle, layer, svc, tag, address, q,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      sort: sort as "doc_id" | "synced_at" | "synced_at_desc" | undefined,
    });
    return result;
  }

  @Get("by-file")
  byFile(@Query("path") filePath?: string) {
    if (!filePath) throw new BadRequestException("path query 필수");
    return this.docs.resolveByFile(filePath);
  }

  @Get("by-address/:address")
  getByAddress(@Param("address") address: string) {
    const doc = this.docs.getByAddress(address);
    if (!doc) throw new NotFoundException(`주소 ${address} 문서 없음`);
    return doc;
  }

  @Get("by-address/:address/incoming-links")
  getIncomingLinksByAddress(@Param("address") address: string) {
    const doc = this.docs.getByAddress(address);
    if (!doc) throw new NotFoundException(`주소 ${address} 문서 없음`);
    return { address, docId: doc.docId, links: this.docs.getIncomingLinks(doc.docId) };
  }

  @Get("by-address/:address/outgoing-links")
  getOutgoingLinksByAddress(@Param("address") address: string) {
    const doc = this.docs.getByAddress(address);
    if (!doc) throw new NotFoundException(`주소 ${address} 문서 없음`);
    return { address, docId: doc.docId, links: this.docs.getOutgoingLinks(doc.docId) };
  }

  @Get(":docId")
  get(@Param("docId") docId: string) {
    const doc = this.docs.get(docId);
    if (!doc) throw new NotFoundException(`문서 ${docId} 없음`);
    return doc;
  }

  @Get(":docId/body")
  getBody(@Param("docId") docId: string) {
    const body = this.docs.getBody(docId);
    if (!body) throw new NotFoundException(`문서 ${docId} 없음`);
    return body;
  }

  @Patch(":docId")
  updateMetadata(@Param("docId") docId: string, @Body() body: DocMetadataUpdate) {
    if (this.axisRegistry) {
      const errors = this.axisRegistry.validateMetadata(body);
      if (errors.length > 0) {
        throw new BadRequestException(errors.join("; "));
      }
    }
    const result = this.docs.updateMetadata(docId, body);
    if (!result) throw new NotFoundException(`문서 ${docId} 없음`);
    return result;
  }

  // ── 계층 구조 ─────────────────────────────────────────

  @Get(":docId/children")
  getChildren(@Param("docId") docId: string) {
    return { docId, children: this.docs.getChildren(docId) };
  }

  @Get(":docId/parent")
  getParent(@Param("docId") docId: string) {
    return { docId, parent: this.docs.getParent(docId) };
  }

  @Get(":docId/incoming-links")
  getIncomingLinks(@Param("docId") docId: string) {
    return { docId, links: this.docs.getIncomingLinks(docId) };
  }

  @Get(":docId/synthetic-incoming-links")
  getSyntheticIncomingLinks(@Param("docId") docId: string) {
    return { docId, links: this.docs.getSyntheticIncomingLinks(docId) };
  }

  @Get(":docId/outgoing-links")
  getOutgoingLinks(@Param("docId") docId: string) {
    return { docId, links: this.docs.getOutgoingLinks(docId) };
  }

  @Get(":docId/feedback-requests")
  getFeedbackRequests(@Param("docId") docId: string, @Query("limit") limit?: string) {
    return {
      docId,
      items: this.docs.getFeedbackRequests(docId, limit ? Number(limit) : undefined),
    };
  }

  @Get(":docId/boundary")
  getBoundary(@Param("docId") docId: string, @Query("level") level?: string) {
    const result = this.docs.getBoundary(
      docId,
      level === "purpose" ? "purpose" : "overview",
    );
    if (!result) throw new NotFoundException(`문서 ${docId} 없음`);
    return result;
  }

  @Get("by-address/:address/boundary")
  getBoundaryByAddress(@Param("address") address: string, @Query("level") level?: string) {
    const doc = this.docs.getByAddress(address);
    if (!doc) throw new NotFoundException(`주소 ${address} 문서 없음`);
    const result = this.docs.getBoundary(
      doc.docId,
      level === "purpose" ? "purpose" : "overview",
    );
    if (!result) throw new NotFoundException(`주소 ${address} 문서 없음`);
    return result;
  }

  // ── 단일 link/tag 원자적 추가/삭제 ────────────────────

  @Post(":docId/links")
  addLink(@Param("docId") docId: string, @Body() body: { target: string; type: string }) {
    if (!body.target || !body.type) throw new BadRequestException("target, type 필수");
    const result = this.docs.addLink(docId, body.target, body.type);
    if (!result) throw new NotFoundException(`문서 ${docId} 없음`);
    return result;
  }

  @Delete(":docId/links/:targetId/:linkType")
  removeLink(
    @Param("docId") docId: string,
    @Param("targetId") targetId: string,
    @Param("linkType") linkType: string,
  ) {
    const result = this.docs.removeLink(docId, targetId, linkType);
    if (!result) throw new NotFoundException(`문서 ${docId} 없음`);
    return result;
  }

  @Post(":docId/tags/:tag")
  addTag(@Param("docId") docId: string, @Param("tag") tag: string) {
    const result = this.docs.addTag(docId, tag);
    if (!result) throw new NotFoundException(`문서 ${docId} 없음`);
    return result;
  }

  @Delete(":docId/tags/:tag")
  removeTag(@Param("docId") docId: string, @Param("tag") tag: string) {
    const result = this.docs.removeTag(docId, tag);
    if (!result) throw new NotFoundException(`문서 ${docId} 없음`);
    return result;
  }

  // ── 이력 ──────────────────────────────────────────────

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
