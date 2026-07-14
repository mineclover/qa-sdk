// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { Controller, Get, Headers, Inject, Param, UseFilters } from '@nestjs/common';
import { DomainExceptionFilter } from '@qa-sdk/sim-domain-slice-kit';
import { TimeOffDetailBff, type TimeOffDetailBffModel } from './timeoff-detail.bff.js';

@Controller('bff/time-off-requests')
@UseFilters(DomainExceptionFilter)
export class TimeOffDetailController {
  constructor(@Inject(TimeOffDetailBff) private readonly bff: TimeOffDetailBff) {}
  @Get(':id')
  async getDetail(
    @Param('id') id: string,
    @Headers('x-trace-id') traceId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<TimeOffDetailBffModel | { ok: false; reason: 'not-found' }> {
    const r = await this.bff.getDetail({
      id,
      traceId: traceId ?? `trace-${id}`,
      correlationId: correlationId ?? traceId ?? `trace-${id}`,
    });
    if (!r) return { ok: false, reason: 'not-found' } as const;
    return r;
  }
}
