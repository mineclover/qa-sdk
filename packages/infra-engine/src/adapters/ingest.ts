// adapters/ingest.ts — IngestAdapter 실구현
import type { IngestAdapter } from "./adapter.js";

export interface IngestAdapterOptions {
  baseUrl: string; // "http://localhost:3200"
  serviceName?: string; // 기본: "infra-engine"
  timeout?: number; // 기본: 5000
}

export function createIngestAdapter(options: IngestAdapterOptions): IngestAdapter {
  const { baseUrl, serviceName = "infra-engine", timeout = 5_000 } = options;

  return {
    async emit(eventKey, payload, addressContext) {
      const now = new Date().toISOString();
      const id = `ie-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const envelope = {
        transmission_id: id,
        sent_at: now,
        owner: { owner_type: "agent", owner_id: serviceName },
        source: { service_name: serviceName, sdk_name: "infra-engine", sdk_version: "1.0.0" },
        runtime: { platform: "node" },
        build: { env: (payload as Record<string, unknown>).env ?? "dev" },
        records: [
          {
            log_id: `${id}-0`,
            timestamp: now,
            record_kind: "log",
            trace_id: `${id}-trace`,
            span_id: `${id}-span`,
            event_key: eventKey,
            event_version: "001",
            payload_format: "json",
            payload_encoding: "raw",
            payload_masking_applied: false,
            payload_masked_fields: [],
            payload,
            // address_context는 optional — 비어있으면 포함하지 않음
            ...(Object.keys(addressContext).length > 0
              ? { address_context: addressContext }
              : {}),
          },
        ],
      };

      try {
        const res = await fetch(`${baseUrl}/v1/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(envelope),
          signal: AbortSignal.timeout(timeout),
        });

        if (res.ok) {
          const data = (await res.json()) as { accepted: boolean; record_count: number };
          return { ok: data.accepted, error: data.accepted ? undefined : "not accepted" };
        }
        return { ok: false, error: `HTTP ${res.status}` };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
