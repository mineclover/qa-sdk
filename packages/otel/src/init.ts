// @def.boundary observability-system-root
// @def.doc observability-system-root

import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { Resource } from "@opentelemetry/resources";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import type { OtelEnv } from "./env.js";

export interface InitTelemetryOptions {
  /** 서비스 이름 (ATTR_SERVICE_NAME) */
  serviceName: string;
  /** 파싱된 OTel 환경변수 */
  env: OtelEnv;
  /** 추가 리소스 속성 */
  resourceAttributes?: Record<string, string>;
}

let sdk: NodeSDK | null = null;

/**
 * OTel SDK를 초기화한다.
 * OTEL_ENABLED=false이면 no-op으로 동작하며 shutdown 함수만 반환한다.
 *
 * @returns shutdown 함수 — graceful shutdown 시 호출
 */
export function initTelemetry(options: InitTelemetryOptions): () => Promise<void> {
  if (!options.env.OTEL_ENABLED) {
    return async () => {};
  }

  const headers = parseHeaders(options.env.OTEL_EXPORTER_OTLP_HEADERS);

  const traceExporter = new OTLPTraceExporter({
    url: options.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? `${options.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
      : undefined,
    headers,
  });

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: options.serviceName,
    ...options.resourceAttributes,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [new HttpInstrumentation()],
  });

  sdk.start();

  return async () => {
    if (sdk) {
      await sdk.shutdown();
      sdk = null;
    }
  };
}

function parseHeaders(raw?: string): Record<string, string> | undefined {
  if (!raw) return undefined;
  const headers: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const idx = pair.indexOf("=");
    if (idx > 0) {
      headers[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
  }
  return headers;
}
