// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { context, propagation } from '@opentelemetry/api';
import { buildHttpHeader, buildVersionTag, type VersionTag } from 'sim-identifier-grammar';

// grammar #4 HTTP header builder — SSOT. raw "x-service-version" 문자열 사용 금지.
const X_SERVICE_VERSION_HEADER = buildHttpHeader({
  kind: 'header',
  domain: 'service',
  attr: 'version',
});

export interface ProxyArgs {
  /** downstream base URL (예: "http://sim-pm-api:4500"). */
  targetBaseUrl: string;
  /** gateway path + query 그대로 (예: "/projects/abc"). */
  sourcePath: string;
  /** incoming Web Request — body/headers 포함. */
  request: Request;
  timeoutMs: number;
  /** 라우팅 결정으로부터 받은 target version. 있으면 x-service-version inject (grammar #4). */
  targetVersion?: VersionTag;
}

/**
 * downstream으로 reverse proxy. 본 함수는 fetch에 100% 위임 (no fallback):
 *   - method / body / headers 그대로 전달
 *   - W3C traceparent를 OTel propagation으로 inject
 *   - AbortSignal.timeout으로 timeout — 초과 시 504 응답
 *   - downstream 응답 status/headers/body 그대로 반환
 *   - targetVersion이 주어지면 grammar #4 builder로 x-service-version 헤더 stamp
 *
 * 인입 요청의 host / connection / content-length 등 hop-by-hop 헤더는 fetch가 자동 관리.
 */
export async function proxyRequest(args: ProxyArgs): Promise<Response> {
  const target = new URL(args.sourcePath, args.targetBaseUrl).toString();
  const headers = new Headers();
  args.request.headers.forEach((v, k) => headers.set(k, v));

  // 라우팅 결정에서 결정된 target version stamp (spec 02 §3.1).
  if (args.targetVersion) {
    headers.set(X_SERVICE_VERSION_HEADER, buildVersionTag(args.targetVersion));
  }

  // OTel context의 active span에서 traceparent 자동 inject
  propagation.inject(context.active(), headers, {
    set: (h, key, val) => (h as Headers).set(key, val),
  });

  // body 변환 — GET/HEAD는 body 금지
  let body: ArrayBuffer | undefined;
  if (args.request.method !== 'GET' && args.request.method !== 'HEAD') {
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
    if (name === 'AbortError' || name === 'TimeoutError') {
      return Response.json(
        { error: 'upstream_timeout', target, timeoutMs: args.timeoutMs },
        { status: 504 },
      );
    }
    return Response.json(
      { error: 'upstream_unavailable', target, message: (err as Error).message },
      { status: 502 },
    );
  }
}
