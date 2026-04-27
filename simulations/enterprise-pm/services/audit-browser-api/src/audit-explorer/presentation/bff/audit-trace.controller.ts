// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import { Controller, Get, Headers, Inject, NotFoundException, Param } from "@nestjs/common";
import { AuditTraceBff } from "./audit-trace.bff.js";

/**
 * Audit Explorer BFF 컨트롤러.
 *
 * 기존 audit-explorer.controller.ts 의 라우트를 동일하게 보존:
 *   - GET /audit/trace/:rootSpanId
 *   - GET /audit/firstFailure/:rootSpanId
 *   - GET /audit/entry/:spanId
 *   - GET /audit/context/:rootSpanId/:graphId
 *
 * 응답 shape 도 동일 (rootSpanId/count/entries, rootSpanId/firstFailure,
 * AuditEntry, rootSpanId/graphId/trace/firstFailure/graphSnapshot/
 * graphRetentionInsight). traceId/correlationId 는 표준 헤더로 받는다.
 */
@Controller("audit")
export class AuditTraceController {
  constructor(@Inject(AuditTraceBff) private readonly bff: AuditTraceBff) {}

  @Get("trace/:rootSpanId")
  async trace(
    @Param("rootSpanId") rootSpanId: string,
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    const result = await this.bff.getTrace({
      rootSpanId,
      traceId: traceId ?? `trace-${rootSpanId}`,
      correlationId: correlationId ?? traceId ?? `trace-${rootSpanId}`,
    });
    return {
      rootSpanId: result.rootSpanId,
      count: result.count,
      entries: result.entries,
    };
  }

  @Get("firstFailure/:rootSpanId")
  async firstFailure(
    @Param("rootSpanId") rootSpanId: string,
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    const result = await this.bff.getFirstFailure({
      rootSpanId,
      traceId: traceId ?? `trace-${rootSpanId}`,
      correlationId: correlationId ?? traceId ?? `trace-${rootSpanId}`,
    });
    return {
      rootSpanId: result.rootSpanId,
      firstFailure: result.firstFailure,
    };
  }

  @Get("entry/:spanId")
  async entry(
    @Param("spanId") spanId: string,
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    const entry = await this.bff.getEntry({
      spanId,
      traceId: traceId ?? `trace-${spanId}`,
      correlationId: correlationId ?? traceId ?? `trace-${spanId}`,
    });
    if (!entry) {
      throw new NotFoundException({ error: "not_found", spanId });
    }
    return entry;
  }

  @Get("context/:rootSpanId/:graphId")
  async context(
    @Param("rootSpanId") rootSpanId: string,
    @Param("graphId") graphId: string,
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    const result = await this.bff.getContext({
      rootSpanId,
      graphId,
      traceId: traceId ?? `trace-${rootSpanId}`,
      correlationId: correlationId ?? traceId ?? `trace-${rootSpanId}`,
    });
    if (!result) {
      throw new NotFoundException({ error: "graph_not_found", graphId });
    }
    return {
      rootSpanId: result.rootSpanId,
      graphId: result.graphId,
      trace: result.trace,
      firstFailure: result.firstFailure,
      graphSnapshot: result.graphSnapshot,
      graphRetentionInsight: result.graphRetentionInsight,
    };
  }
}
