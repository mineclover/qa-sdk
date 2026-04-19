// @def.boundary observability-system-root
// @def.doc observability-system-root

import type { TransmissionEnvelope } from "@qa-sdk/core";
import type { Transport } from "./transport.js";

export interface OtlpTransportOptions {
  /** OTLP Collector URL (e.g. http://localhost:4318) */
  collectorUrl: string;
  headers?: Record<string, string>;
  timeout_ms?: number;
}

/**
 * OTLP Transport — OpenTelemetry Protocol (HTTP/JSON).
 *
 * TransmissionEnvelope를 OTLP ExportLogsServiceRequest로 변환하여
 * 외부 OTLP Collector에 전송한다.
 * ingest-server를 거치지 않고 직접 Collector(Grafana/Datadog/Jaeger 등)로 전달.
 *
 * Content-Type: application/json (OTLP/HTTP JSON)
 */
export class OtlpTransport implements Transport {
  private readonly collectorUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeout_ms: number;

  constructor(options: OtlpTransportOptions) {
    this.collectorUrl = options.collectorUrl.replace(/\/+$/, "");
    this.headers = options.headers ?? {};
    this.timeout_ms = options.timeout_ms ?? 10_000;
  }

  async send(envelope: TransmissionEnvelope): Promise<void> {
    const otlp = mapToOtlpLogs(envelope);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout_ms);

    try {
      const res = await fetch(`${this.collectorUrl}/v1/logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
        body: JSON.stringify(otlp),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`OtlpTransport send failed: ${res.status} ${res.statusText}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async flush(): Promise<void> {}
  async shutdown(): Promise<void> {}
}

// ── OTLP Mapping ──────────────────────────────────────

interface OtlpKeyValue {
  key: string;
  value: { stringValue?: string; intValue?: string; boolValue?: boolean };
}

function strAttr(key: string, value: string | undefined): OtlpKeyValue | null {
  return value ? { key, value: { stringValue: value } } : null;
}

function toHexId(id: string, len: number): string {
  // OTLP requires hex-encoded trace_id (32 chars) and span_id (16 chars)
  // Hash the string ID to the right length
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(len, "0");
  return hex.slice(0, len);
}

/** TransmissionEnvelope → OTLP ExportLogsServiceRequest */
export function mapToOtlpLogs(envelope: TransmissionEnvelope): Record<string, unknown> {
  const resourceAttrs: OtlpKeyValue[] = [
    strAttr("service.name", envelope.source.service_name),
    strAttr("sdk.name", envelope.source.sdk_name),
    strAttr("sdk.version", envelope.source.sdk_version),
    strAttr("host.type", envelope.runtime.platform),
    strAttr("deployment.environment", envelope.build.env),
    strAttr("qa.owner.type", envelope.owner.owner_type),
    strAttr("qa.owner.id", envelope.owner.owner_id),
    strAttr("qa.transmission.id", envelope.transmission_id),
  ].filter((a): a is OtlpKeyValue => a !== null);

  const logRecords = envelope.records.map(record => {
    const attrs: OtlpKeyValue[] = [
      strAttr("event.key", record.event_key),
      strAttr("event.version", record.event_version),
      strAttr("record.kind", record.record_kind),
    ].filter((a): a is OtlpKeyValue => a !== null);

    // address_context → OTLP attributes with qa.address.* prefix
    if (record.address_context) {
      for (const [prefix, serialized] of Object.entries(record.address_context)) {
        attrs.push({ key: `qa.address.${prefix}`, value: { stringValue: serialized } });
      }
    }

    return {
      timeUnixNano: String(new Date(record.timestamp).getTime() * 1_000_000),
      severityNumber: 9, // INFO
      severityText: "INFO",
      body: { stringValue: JSON.stringify(record.payload ?? {}) },
      attributes: attrs,
      traceId: toHexId(record.trace_id, 32),
      spanId: toHexId(record.span_id, 16),
    };
  });

  return {
    resourceLogs: [{
      resource: { attributes: resourceAttrs },
      scopeLogs: [{
        scope: {
          name: envelope.source.sdk_name,
          version: envelope.source.sdk_version,
        },
        logRecords,
      }],
    }],
  };
}
