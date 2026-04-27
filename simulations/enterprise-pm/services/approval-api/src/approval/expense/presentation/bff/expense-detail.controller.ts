// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { Controller, Get, Headers, Inject, Param, UseFilters } from "@nestjs/common";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { ExpenseDetailBff, type ExpenseDetailBffModel } from "./expense-detail.bff.js";

@Controller("bff/expense-reports")
@UseFilters(DomainExceptionFilter)
export class ExpenseDetailController {
  constructor(@Inject(ExpenseDetailBff) private readonly bff: ExpenseDetailBff) {}

  @Get(":id")
  async getDetail(
    @Param("id") id: string,
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ): Promise<ExpenseDetailBffModel | { ok: false; reason: "not-found" }> {
    const r = await this.bff.getDetail({
      id,
      traceId: traceId ?? `trace-${id}`,
      correlationId: correlationId ?? traceId ?? `trace-${id}`,
    });
    if (!r) return { ok: false, reason: "not-found" } as const;
    return r;
  }
}
