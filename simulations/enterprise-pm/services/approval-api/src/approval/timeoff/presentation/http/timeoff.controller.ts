// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { Body, Controller, Get, Inject, Param, Post, Put, UseFilters } from '@nestjs/common';
import { z } from 'zod';
import { DomainExceptionFilter } from '@qa-sdk/sim-domain-slice-kit';
import { TimeOffUseCase } from '../../application/use-cases/timeoff.use-case.js';
import { TimeOffReadModelQuery } from '../../application/queries/timeoff-read-model.query.js';
import { TimeOffNotFoundException } from '../../domain/timeoff.exceptions.js';

const createSchema = z.object({
  requesterId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().min(1),
});
const statusSchema = z.object({
  status: z.enum(['draft', 'submitted', 'in_review', 'approved', 'rejected', 'revision_requested']),
});

@Controller('time-off-requests')
@UseFilters(DomainExceptionFilter)
export class TimeOffController {
  constructor(
    @Inject(TimeOffUseCase) private readonly useCase: TimeOffUseCase,
    @Inject(TimeOffReadModelQuery) private readonly readModel: TimeOffReadModelQuery,
  ) {}

  @Post()
  async create(@Body() body: unknown) {
    const parsed = createSchema.parse(body);
    const id = `tof_${parsed.requesterId}_${Date.now().toString(36)}`;
    const r = await this.useCase.create({ id, ...parsed });
    return this.readModel.findDetail(r.id);
  }
  @Get(':id')
  async get(@Param('id') id: string) {
    const r = await this.readModel.findDetail(id);
    if (!r) throw new TimeOffNotFoundException(id);
    return r;
  }
  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: unknown) {
    const { status } = statusSchema.parse(body);
    await this.useCase.updateStatus({ id, status });
    return this.readModel.findDetail(id);
  }
}
