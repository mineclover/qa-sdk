import { describe, it, expect } from "vitest";
import { enrichAddressContext } from "./enrich-address-context.js";
import type { TransmissionEnvelope, EventRecord } from "@qa-sdk/core";

function makeEnvelope(overrides: Partial<TransmissionEnvelope> = {}): TransmissionEnvelope {
  return {
    transmission_id: "t1",
    sent_at: "2026-01-01T00:00:00Z",
    owner: { owner_type: "workspace", owner_id: "ws1" },
    source: { service_name: "svc", sdk_name: "test", sdk_version: "0.1" },
    runtime: { platform: "node" },
    build: { env: "dev" },
    records: [],
    ...overrides,
  };
}

function makeRecord(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    log_id: "l1",
    timestamp: "2026-01-01T00:00:00Z",
    record_kind: "log",
    trace_id: "tr1",
    span_id: "sp1",
    event_key: "test.event",
    event_version: "001",
    payload_format: "json",
    payload_encoding: "raw",
    payload_masking_applied: false,
    payload_masked_fields: [],
    payload: {},
    ...overrides,
  };
}

describe("enrichAddressContext", () => {
  it("infra_context 없으면 records 그대로 반환", () => {
    const env = makeEnvelope();
    const records = [makeRecord()];
    const result = enrichAddressContext(env, records);
    expect(result).toBe(records);
    expect(result[0].address_context).toBeUndefined();
  });

  it("infra_context만 있으면 참조 공유 (복사 없음)", () => {
    const infra = { "k8s_workload_addr": "k8s_workload_addr:v1:42" };
    const env = makeEnvelope({ infra_context: infra });
    const records = [makeRecord()];

    enrichAddressContext(env, records);

    expect(records[0].address_context).toBe(infra); // 같은 참조
  });

  it("양쪽 다 있으면 record가 override", () => {
    const env = makeEnvelope({
      infra_context: {
        "k8s_workload_addr": "k8s_workload_addr:v1:42",
        "k8s_infra_addr": "k8s_infra_addr:v1:10",
      },
    });
    const records = [
      makeRecord({
        address_context: { "k8s_workload_addr": "k8s_workload_addr:v1:99" },
      }),
    ];

    enrichAddressContext(env, records);

    // record의 값이 우선
    expect(records[0].address_context).toEqual({
      "k8s_workload_addr": "k8s_workload_addr:v1:99",
      "k8s_infra_addr": "k8s_infra_addr:v1:10",
    });
  });

  it("여러 레코드에 대해 개별 처리", () => {
    const env = makeEnvelope({
      infra_context: { "prefix": "prefix:v1:1" },
    });
    const r1 = makeRecord({ log_id: "l1" });
    const r2 = makeRecord({ log_id: "l2", address_context: { "prefix": "prefix:v1:2" } });

    enrichAddressContext(env, [r1, r2]);

    expect(r1.address_context).toEqual({ "prefix": "prefix:v1:1" });
    expect(r2.address_context).toEqual({ "prefix": "prefix:v1:2" }); // override
  });
});
