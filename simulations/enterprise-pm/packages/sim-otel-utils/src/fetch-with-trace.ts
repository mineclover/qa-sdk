// @def.boundary sim-otel-utils
// @def.doc authorization-ontology-bitmap-pipeline

import { context, propagation } from "@opentelemetry/api";

export interface FetchWithTraceOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * fetchWithTracePropagation — native fetch에 W3C traceparent 자동 주입.
 *
 * - active OTel context가 있으면 traceparent + tracestate 헤더 자동 부착
 * - 없으면 inject가 noop (외부 호출이 새 trace 시작)
 * - timeoutMs 지정 시 AbortSignal.timeout — 초과 시 AbortError throw (caller가 처리)
 *
 * NestJS / Hono / CLI 어디서든 사용 가능.
 */
export async function fetchWithTracePropagation(
  url: string | URL,
  options: FetchWithTraceOptions = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  propagation.inject(context.active(), headers, {
    set: (h, key, val) => (h as Headers).set(key, val),
  });

  const init: RequestInit = {
    ...options,
    headers,
  };
  if (options.timeoutMs !== undefined) {
    init.signal = AbortSignal.timeout(options.timeoutMs);
  }
  return fetch(url, init);
}
