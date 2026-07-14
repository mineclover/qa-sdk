// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import { Body, Controller, Get, Inject, Post, Query, UseFilters } from '@nestjs/common';
import { z } from 'zod';
import { DomainExceptionFilter } from '@qa-sdk/sim-domain-slice-kit';

import { MetricReadModelQuery } from '../../application/queries/metric-read-model.query.js';
import { MetricAdminPort } from '../../application/ports/metric-admin.port.js';
import type { DailyMetricReadModel } from '../../domain/metric.types.js';

const recordSchema = z.object({
  metricKey: z.string().min(1),
  date: z.string().min(1),
  value: z.number().finite(),
  dimensions: z.string().min(1),
});

@Controller()
@UseFilters(DomainExceptionFilter)
export class MetricController {
  constructor(
    @Inject(MetricReadModelQuery) private readonly readModel: MetricReadModelQuery,
    @Inject(MetricAdminPort) private readonly admin: MetricAdminPort,
  ) {}

  @Post('metrics')
  async record(@Body() body: unknown): Promise<DailyMetricReadModel> {
    const parsed = recordSchema.parse(body);
    return this.admin.record(parsed);
  }

  @Get('metrics')
  async list(
    @Query('metricKey') metricKey: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ): Promise<DailyMetricReadModel[]> {
    return this.readModel.listByKey(metricKey, fromDate, toDate);
  }

  @Get('metrics/keys')
  async listKeys(): Promise<string[]> {
    return this.readModel.listKeys();
  }
}
