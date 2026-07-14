// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { Body, Controller, Delete, Get, Inject, Param, Post, UseFilters } from '@nestjs/common';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { DomainExceptionFilter } from '@qa-sdk/sim-domain-slice-kit';
import { CommentUseCase } from '../../application/use-cases/comment.use-case.js';
import {
  CommentReadModelQuery,
  type CommentDetailReadModel,
} from '../../application/queries/comment-read-model.query.js';
import { CommentNotFoundException } from '../../domain/index.js';

const createSchema = z.object({
  documentId: z.string().min(1),
  authorId: z.string().min(1),
  body: z.string().min(1),
  parentCommentId: z.string().optional(),
});

interface CommentCommandAccepted {
  readonly id: string;
  readonly status: 'CREATED' | 'DELETED';
}

@Controller()
@UseFilters(DomainExceptionFilter)
export class CommentController {
  constructor(
    @Inject(CommentUseCase) private readonly useCase: CommentUseCase,
    @Inject(CommentReadModelQuery) private readonly readModel: CommentReadModelQuery,
  ) {}

  @Post('comments')
  async create(@Body() body: unknown): Promise<CommentCommandAccepted> {
    const parsed = createSchema.parse(body);
    const id = randomUUID();
    const result = await this.useCase.create({
      id,
      documentId: parsed.documentId,
      authorId: parsed.authorId,
      body: parsed.body,
      parentCommentId: parsed.parentCommentId,
    });
    return { id: result.id, status: result.status };
  }

  @Get('comments/:id')
  async get(@Param('id') id: string): Promise<CommentDetailReadModel> {
    const detail = await this.readModel.findDetail(id);
    if (!detail) throw new CommentNotFoundException(id);
    return detail;
  }

  @Get('documents/:docId/comments')
  async listForDocument(@Param('docId') docId: string): Promise<CommentDetailReadModel[]> {
    return this.readModel.listByDocument(docId);
  }

  @Get('comments/:parentId/replies')
  async listReplies(@Param('parentId') parentId: string): Promise<CommentDetailReadModel[]> {
    return this.readModel.listReplies(parentId);
  }

  @Delete('comments/:id')
  async remove(@Param('id') id: string): Promise<CommentCommandAccepted> {
    const result = await this.useCase.delete({ id });
    return { id: result.id, status: result.status };
  }
}
