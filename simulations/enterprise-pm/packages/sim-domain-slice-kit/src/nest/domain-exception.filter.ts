// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

import { ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import { mapDomainErrorToHttp } from '../error-mapping.js';

/**
 * 컨트롤러에서 던져진 도메인 예외를 표준 HTTP 응답으로 변환한다.
 *
 * - traceId 는 request 의 `x-trace-id` 헤더 또는 request.traceId 속성에서 추출
 * - 미존재 시 빈 문자열 (호출자가 TransactionScopeProvider 로 미리 채우기 권장)
 *
 * NestJS 의 @Catch() 인자에 클래스를 넘기지 않으면 모든 throw 를 캐치하므로,
 * Nest 내장 HttpException 은 별도 필터에서 먼저 처리하도록 등록 순서를 두어야
 * 한다 (서비스 부트스트랩에서 결정).
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      traceId?: string;
    }>();
    const response = ctx.getResponse<{
      status: (code: number) => { send: (body: unknown) => void };
    }>();

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
  const header = request.headers?.['x-trace-id'];
  if (typeof header === 'string') return header;
  if (Array.isArray(header) && header[0]) return header[0];
  return '';
}
