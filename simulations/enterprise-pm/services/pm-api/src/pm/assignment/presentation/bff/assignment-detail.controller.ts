// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { Controller, Get, Headers, Inject, Param, UseFilters } from "@nestjs/common";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { AssignmentDetailBff, type AssignmentDetailBffModel } from "./assignment-detail.bff.js";

/**
 * Assignment BFF 화면 컨트롤러.
 *
 * - 경로는 /bff/assignments/:id (gateway 가 /bff prefix 로 라우팅).
 * - traceId / correlationId 는 표준 헤더로 받는다.
 */
@Controller("bff/assignments")
@UseFilters(DomainExceptionFilter)
export class AssignmentDetailController {
  constructor(@Inject(AssignmentDetailBff) private readonly bff: AssignmentDetailBff) {}

  @Get(":id")
  async getDetail(
    @Param("id") id: string,
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ): Promise<AssignmentDetailBffModel | { ok: false; reason: "not-found" }> {
    const result = await this.bff.getDetail({
      id,
      traceId: traceId ?? `trace-${id}`,
      correlationId: correlationId ?? traceId ?? `trace-${id}`,
    });
    if (!result) return { ok: false, reason: "not-found" } as const;
    return result;
  }
}
