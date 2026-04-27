// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { Controller, Get, Headers, Inject, Param, UseFilters } from "@nestjs/common";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { BudgetDetailBff, type BudgetDetailBffModel } from "./budget-detail.bff.js";

@Controller("bff/budget-requests")
@UseFilters(DomainExceptionFilter)
export class BudgetDetailController {
  constructor(@Inject(BudgetDetailBff) private readonly bff: BudgetDetailBff) {}

  @Get(":id")
  async getDetail(
    @Param("id") id: string,
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ): Promise<BudgetDetailBffModel | { ok: false; reason: "not-found" }> {
    const result = await this.bff.getDetail({
      id,
      traceId: traceId ?? `trace-${id}`,
      correlationId: correlationId ?? traceId ?? `trace-${id}`,
    });
    if (!result) return { ok: false, reason: "not-found" } as const;
    return result;
  }
}
