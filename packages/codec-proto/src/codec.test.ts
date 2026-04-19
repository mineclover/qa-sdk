// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { describe, expect, it } from "vitest";
import type { TransmissionEnvelope } from "@qa-sdk/core";
import { decodeEnvelope, encodeEnvelope } from "./codec.js";

describe("codec-proto", () => {
  it("TransmissionEnvelope를 손실 없이 round-trip한다", () => {
    const envelope: TransmissionEnvelope = {
      transmission_id: "tx-1",
      sent_at: "2026-04-07T00:00:00.000Z",
      owner: { owner_type: "tenant", owner_id: "tenant-1" },
      source: { service_name: "svc", sdk_name: "@qa-sdk/sdk", sdk_version: "0.1.0" },
      runtime: {
        platform: "node",
        device_ref: "m2",
        os_version: "macOS",
        app_version: "1.2.3",
      },
      build: {
        env: "dev",
        build_ref: "abc123",
        release_version: "2026.04.07",
      },
      infra_context: { service: "service:v1:42" },
      entry_snapshot: "snap-demo-v1",
      records: [
        {
          log_id: "log-1",
          timestamp: "2026-04-07T00:00:00.000Z",
          record_kind: "metric",
          trace_id: "trace-1",
          span_id: "span-1",
          parent_span_id: "parent-1",
          event_key: "demo.metric",
          event_version: "v1",
          span_name: "metric span",
          start_time: "2026-04-07T00:00:00.000Z",
          end_time: "2026-04-07T00:00:01.000Z",
          status_code: "ok",
          payload_format: "json",
          payload_encoding: "raw",
          payload_masking_applied: true,
          payload_masked_fields: ["email"],
          payload: { ok: true, count: 0 },
          qa_session_id: "session-1",
          address_context: { endpoint: "endpoint:v1:10" },
          metric_type: "gauge",
          metric_name: "latency",
          metric_value: 0,
          metric_unit: "ms",
          metric_labels: { method: "GET" },
          metric_buckets: [1, 2, 3],
          metric_quantiles: [0.5, 0.95],
          actor_id: "actor-1",
          user_id: "user-1",
          user_attributes: { tier: "pro" },
        },
      ],
    };

    const decoded = decodeEnvelope(encodeEnvelope(envelope));
    expect(decoded).toEqual(envelope);
  });
});
