// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Delete, Get, NotFoundException, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { CommentService } from "./comment.service.js";

const createSchema = z.object({
  documentId: z.string().min(1),
  authorId: z.string().min(1),
  body: z.string().min(1),
  parentCommentId: z.string().optional(),
});

@Controller()
export class CommentController {
  constructor(private readonly svc: CommentService) {}

  @Post("comments")
  async create(@Body() body: unknown) {
    return this.svc.create(createSchema.parse(body));
  }

  @Get("comments/:id")
  async get(@Param("id") id: string) {
    const c = await this.svc.find(id);
    if (!c) throw new NotFoundException(`Comment not found: ${id}`);
    return c;
  }

  @Get("documents/:docId/comments")
  async listForDocument(@Param("docId") docId: string) {
    return this.svc.listForDocument(docId);
  }

  @Get("comments/:parentId/replies")
  async listReplies(@Param("parentId") parentId: string) {
    return this.svc.listReplies(parentId);
  }

  @Delete("comments/:id")
  async remove(@Param("id") id: string) {
    await this.svc.delete(id);
    return { status: "deleted" };
  }
}
