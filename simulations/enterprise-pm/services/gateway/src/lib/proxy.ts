// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { context, propagation } from "@opentelemetry/api";

export interface ProxyArgs {
  /** downstream base URL (예: "http://sim-pm-api:4500"). */
  targetBaseUrl: string;
  /** gateway path + query 그대로 (예: "/projects/abc"). */
  sourcePath: string;
  /** incoming Web Request — body/headers 포함. */
  request: Request;
  timeoutMs: number;
}

/**
 * downstream으로 reverse proxy. 본 함수는 fetch에 100% 위임 (no fallback):
 *   - method / body / headers 그대로 전달
 *   - W3C traceparent를 OTel propagation으로 inject
 *   - AbortSignal.timeout으로 timeout — 초과 시 504 응답
 *   - downstream 응답 status/headers/body 그대로 반환
 *
 * 인입 요청의 host / connection / content-length 등 hop-by-hop 헤더는 fetch가 자동 관리.
 */
export async function proxyRequest(args: ProxyArgs): Promise<Response> {
  const target = new URL(args.sourcePath, args.targetBaseUrl).toString();
  const headers = new Headers();
  args.request.headers.forEach((v, k) => headers.set(k, v));

  // OTel context의 active span에서 traceparent 자동 inject
  propagation.inject(context.active(), headers, {
    set: (h, key, val) => (h as Headers).set(key, val),
  });

  // body 변환 — GET/HEAD는 body 금지
  let body: BodyInit | undefined;
  if (args.request.method !== "GET" && args.request.method !== "HEAD") {
    body = await args.request.clone().arrayBuffer();
  }

  const signal = AbortSignal.timeout(args.timeoutMs);

  try {
    const downstream = await fetch(target, {
      method: args.request.method,
      headers,
      body,
      signal,
    });
    const resHeaders = new Headers(downstream.headers);
    return new Response(downstream.body, {
      status: downstream.status,
      statusText: downstream.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    const name = (err as Error).name;
    if (name === "AbortError" || name === "TimeoutError") {
      return Response.json(
        { error: "upstream_timeout", target, timeoutMs: args.timeoutMs },
        { status: 504 },
      );
    }
    return Response.json(
      { error: "upstream_unavailable", target, message: (err as Error).message },
      { status: 502 },
    );
  }
}
