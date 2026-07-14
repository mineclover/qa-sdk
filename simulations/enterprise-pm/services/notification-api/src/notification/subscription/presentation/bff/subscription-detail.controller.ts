// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { Controller, Get, Headers, Inject, Param, UseFilters } from '@nestjs/common';
import { DomainExceptionFilter } from '@qa-sdk/sim-domain-slice-kit';
import {
  SubscriptionDetailBff,
  type SubscriptionDetailBffModel,
} from './subscription-detail.bff.js';

@Controller('bff/subscriptions')
@UseFilters(DomainExceptionFilter)
export class SubscriptionDetailController {
  constructor(@Inject(SubscriptionDetailBff) private readonly bff: SubscriptionDetailBff) {}

  @Get(':userId/:eventType')
  async getDetail(
    @Param('userId') userId: string,
    @Param('eventType') eventType: string,
    @Headers('x-trace-id') traceId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<SubscriptionDetailBffModel | { ok: false; reason: 'not-found' }> {
    const trc = traceId ?? `trace-${userId}:${eventType}`;
    const result = await this.bff.getDetail({
      userId,
      eventType,
      traceId: trc,
      correlationId: correlationId ?? trc,
    });
    if (!result) return { ok: false, reason: 'not-found' } as const;
    return result;
  }
}
