// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query } from "@nestjs/common";
import { z } from "zod";
import { DocumentService } from "./document.service.js";

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  ownerId: z.string().min(1),
});

@Controller("documents")
export class DocumentController {
  constructor(private readonly svc: DocumentService) {}

  @Post()
  async create(@Body() body: unknown) {
    return this.svc.create(createSchema.parse(body));
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const d = await this.svc.find(id);
    if (!d) throw new NotFoundException(`Document not found: ${id}`);
    return d;
  }

  @Get()
  async list(@Query("projectId") projectId: string) {
    if (!projectId) throw new NotFoundException("projectId query required");
    return this.svc.listByProject(projectId);
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: unknown) {
    return this.svc.update(id, createSchema.partial().parse(body));
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.svc.delete(id);
    return { status: "deleted" };
  }
}
