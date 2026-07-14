// @def.boundary sim-reporting-api
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
  UseFilters,
} from '@nestjs/common';
import { z } from 'zod';
import { DomainExceptionFilter } from '@qa-sdk/sim-domain-slice-kit';

import { ReportReadModelQuery } from '../../application/queries/report-read-model.query.js';
import { ReportAdminPort } from '../../application/ports/report-admin.port.js';
import { ReportNotFoundException } from '../../domain/index.js';
import type { ReportReadModel, ReportSummaryReadModel } from '../../domain/report.types.js';

const createSchema = z.object({
  name: z.string().min(1),
  queryDefinition: z.string().min(1),
  createdBy: z.string().min(1),
});

const updateSchema = createSchema.partial();

/**
 * Report HTTP controller — 기존 /reports 라우트를 read-model 슬라이스 형태로
 * 보존한다. 도메인 예외는 DomainExceptionFilter 가 표준 응답으로 변환.
 */
@Controller('reports')
@UseFilters(DomainExceptionFilter)
export class ReportController {
  constructor(
    @Inject(ReportReadModelQuery) private readonly readModel: ReportReadModelQuery,
    @Inject(ReportAdminPort) private readonly admin: ReportAdminPort,
  ) {}

  @Post()
  async create(@Body() body: unknown): Promise<ReportReadModel> {
    const parsed = createSchema.parse(body);
    return this.admin.create(parsed);
  }

  @Get()
  async list(): Promise<ReportSummaryReadModel[]> {
    return this.readModel.listAll();
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<ReportReadModel> {
    const detail = await this.readModel.findDetail(id);
    if (!detail) throw new ReportNotFoundException(id);
    return detail;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: unknown): Promise<ReportReadModel> {
    const parsed = updateSchema.parse(body);
    return this.admin.update({ id, ...parsed });
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ status: 'deleted' }> {
    await this.admin.delete({ id });
    return { status: 'deleted' };
  }
}
