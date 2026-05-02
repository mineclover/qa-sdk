// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { Controller, Get, Headers, Inject, Param, UseFilters } from "@nestjs/common";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { ResourceDetailBff, type ResourceDetailBffModel } from "./resource-detail.bff.js";

@Controller("bff/resource-requests")
@UseFilters(DomainExceptionFilter)
export class ResourceDetailController {
  constructor(@Inject(ResourceDetailBff) private readonly bff: ResourceDetailBff) {}
  @Get(":id")
  async getDetail(
    @Param("id") id: string,
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ): Promise<ResourceDetailBffModel | { ok: false; reason: "not-found" }> {
    const r = await this.bff.getDetail({
      id,
      traceId: traceId ?? `trace-${id}`,
      correlationId: correlationId ?? traceId ?? `trace-${id}`,
    });
    if (!r) return { ok: false, reason: "not-found" } as const;
    return r;
  }
}
