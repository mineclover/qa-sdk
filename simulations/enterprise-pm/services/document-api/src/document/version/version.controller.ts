// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Get, NotFoundException, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { VersionService } from "./version.service.js";

const createSchema = z.object({
  contentRef: z.string().min(1),
  authorId: z.string().min(1),
});

@Controller()
export class VersionController {
  constructor(private readonly svc: VersionService) {}

  @Post("documents/:id/versions")
  async create(@Param("id") id: string, @Body() body: unknown) {
    const parsed = createSchema.parse(body);
    return this.svc.create({ documentId: id, contentRef: parsed.contentRef, authorId: parsed.authorId });
  }

  @Get("documents/:id/versions")
  async list(@Param("id") id: string) {
    return this.svc.list(id);
  }

  @Get("documents/:id/versions/:versionNumber")
  async get(@Param("id") id: string, @Param("versionNumber") versionNumber: string) {
    const n = Number(versionNumber);
    const v = await this.svc.find(id, n);
    if (!v) throw new NotFoundException(`Version not found: ${id}/${n}`);
    return v;
  }
}
