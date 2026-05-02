// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { Controller, Get, Headers, Inject, Param, UseFilters } from "@nestjs/common";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { NotificationDetailBff, type NotificationDetailBffModel } from "./notification-detail.bff.js";

@Controller("bff/notifications")
@UseFilters(DomainExceptionFilter)
export class NotificationDetailController {
  constructor(@Inject(NotificationDetailBff) private readonly bff: NotificationDetailBff) {}

  @Get(":id")
  async getDetail(
    @Param("id") id: string,
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ): Promise<NotificationDetailBffModel | { ok: false; reason: "not-found" }> {
    const result = await this.bff.getDetail({
      id,
      traceId: traceId ?? `trace-${id}`,
      correlationId: correlationId ?? traceId ?? `trace-${id}`,
    });
    if (!result) return { ok: false, reason: "not-found" } as const;
    return result;
  }
}
