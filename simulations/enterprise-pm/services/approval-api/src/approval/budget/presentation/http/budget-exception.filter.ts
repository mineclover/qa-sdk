// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { ArgumentsHost, Catch, HttpException, type ExceptionFilter } from "@nestjs/common";
import { mapDomainErrorToHttp } from "@qa-sdk/sim-domain-slice-kit";

/**
 * 슬라이스 로컬 예외 필터.
 *
 * - Nest 내장 HttpException 은 그대로 status + getResponse() 페이로드로 응답.
 * - 그 외는 mapDomainErrorToHttp 로 도메인 예외 매핑 (kit 의 표준).
 *
 * kit 의 DomainExceptionFilter 와 달리 HttpException pass-through 를 보장하므로
 * Guard 가 던지는 UnauthorizedException, controller 의 ForbiddenException 등이
 * 표준 4xx 응답으로 반환된다.
 */
@Catch()
export class BudgetExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      traceId?: string;
    }>();
    const response = ctx.getResponse<{
      status: (code: number) => { send: (body: unknown) => void };
    }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).send(body);
      return;
    }

    const traceId = extractTraceId(request);
    const { status, payload } = mapDomainErrorToHttp(exception, traceId);
    response.status(status).send(payload);
  }
}

function extractTraceId(request: {
  headers?: Record<string, string | string[] | undefined>;
  traceId?: string;
}): string {
  if (request.traceId) return request.traceId;
  const header = request.headers?.["x-trace-id"];
  if (typeof header === "string") return header;
  if (Array.isArray(header) && header[0]) return header[0];
  return "";
}
