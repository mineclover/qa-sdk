// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseFilters,
} from '@nestjs/common';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { DomainExceptionFilter } from '@qa-sdk/sim-domain-slice-kit';
import { DocumentUseCase } from '../../application/use-cases/document.use-case.js';
import {
  DocumentReadModelQuery,
  type DocumentDetailReadModel,
} from '../../application/queries/document-read-model.query.js';
import { DocumentNotFoundException } from '../../domain/index.js';

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  ownerId: z.string().min(1),
});

const updateSchema = createSchema.partial();

interface DocumentCommandAccepted {
  readonly id: string;
  readonly status: 'CREATED' | 'UPDATED' | 'DELETED';
}

@Controller('documents')
@UseFilters(DomainExceptionFilter)
export class DocumentController {
  constructor(
    @Inject(DocumentUseCase) private readonly useCase: DocumentUseCase,
    @Inject(DocumentReadModelQuery) private readonly readModel: DocumentReadModelQuery,
  ) {}

  @Post()
  async create(@Body() body: unknown): Promise<DocumentCommandAccepted & { id: string }> {
    const parsed = createSchema.parse(body);
    const id = randomUUID();
    const result = await this.useCase.create({
      id,
      projectId: parsed.projectId,
      title: parsed.title,
      ownerId: parsed.ownerId,
    });
    return { id: result.id, status: result.status };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<DocumentDetailReadModel> {
    const detail = await this.readModel.findDetail(id);
    if (!detail) throw new DocumentNotFoundException(id);
    return detail;
  }

  @Get()
  async list(@Query('projectId') projectId: string): Promise<DocumentDetailReadModel[]> {
    if (!projectId || projectId.length === 0) {
      // 기존 컨트롤러 호환: projectId 누락 시 빈 배열 보다는 명시적 에러
      const err = new (class extends Error {
        constructor() {
          super('projectId query required');
        }
      })();
      err.name = 'ValidationError';
      throw err;
    }
    return this.readModel.listByProject(projectId);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: unknown): Promise<DocumentCommandAccepted> {
    const parsed = updateSchema.parse(body);
    const result = await this.useCase.update({
      id,
      projectId: parsed.projectId,
      title: parsed.title,
      ownerId: parsed.ownerId,
    });
    return { id: result.id, status: result.status };
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<DocumentCommandAccepted> {
    const result = await this.useCase.delete({ id });
    return { id: result.id, status: result.status };
  }
}
