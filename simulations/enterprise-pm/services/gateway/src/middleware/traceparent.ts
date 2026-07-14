// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import type { MiddlewareHandler } from 'hono';
import { context, propagation, trace, type Span, type Tracer } from '@opentelemetry/api';

const tracer: Tracer = trace.getTracer('sim-gateway');

/**
 * W3C traceparent propagation 미들웨어.
 *
 * §2 bitmap-pipeline은 trace_id로 audit/log/metric 연결을 전제 — 본 미들웨어가
 * cross-service trace 연속성을 보장한다.
 *
 * 동작:
 *   1. incoming 헤더에서 propagation.extract → upstream context 추출
 *   2. upstream context 위에 gateway span 시작 ("gateway <method> <path>")
 *   3. context.with()로 active span 설정 → 다음 핸들러에서 trace.getActiveSpan() 가능
 *   4. 응답 시 x-trace-id header 부착 (Plan 12c)
 *   5. 응답 종료 시 span.end()
 *
 * traceparent 누락/malformed → 신규 root span 생성 (graceful — 외부 클라이언트 호환).
 */
export const traceparent: MiddlewareHandler = async (c, next) => {
  const carrier: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    carrier[key.toLowerCase()] = value;
  });
  const upstreamCtx = propagation.extract(context.active(), carrier);

  const span: Span = tracer.startSpan(
    `gateway ${c.req.method} ${new URL(c.req.url).pathname}`,
    {
      attributes: {
        'http.method': c.req.method,
        'http.target': new URL(c.req.url).pathname,
        'service.name': 'sim-gateway',
      },
    },
    upstreamCtx,
  );

  try {
    await context.with(trace.setSpan(upstreamCtx, span), async () => {
      await next();
      const ctx = span.spanContext();
      if (ctx.traceId) c.header('x-trace-id', ctx.traceId);
      span.setAttribute('http.status_code', c.res.status);
    });
  } catch (err) {
    span.recordException(err as Error);
    throw err;
  } finally {
    span.end();
  }
};
