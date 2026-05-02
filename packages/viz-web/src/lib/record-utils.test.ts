// @def.boundary viz-system-root
// @def.doc viz-system-root

import { describe, it, expect } from "vitest";
import type { StoredRecord } from "@qa-sdk/core";
import { mergeAndSortRecords } from "./record-utils.js";

function makeRecord(opts: { logId: string; timestamp: Date | string; eventKey?: string; traceId?: string }): StoredRecord {
  return {
    logId: opts.logId,
    traceId: opts.traceId ?? "trc_test",
    spanId: `spn_${opts.logId}`,
    timestamp: opts.timestamp instanceof Date ? opts.timestamp : new Date(opts.timestamp),
    recordKind: "log",
    eventKey: opts.eventKey ?? "test_event",
    eventVersion: "001",
    payloadFormat: "json",
    payloadEncoding: "raw",
    payloadMaskingApplied: false,
    payloadMaskedFields: [],
    payload: {},
    createdAt: new Date(),
  } as StoredRecord;
}

const T1 = new Date("2024-01-01T00:00:01.000Z");
const T2 = new Date("2024-01-01T00:00:02.000Z");
const T3 = new Date("2024-01-01T00:00:03.000Z");

describe("mergeAndSortRecords", () => {
  it("returns empty array when both inputs are empty", () => {
    expect(mergeAndSortRecords([], [])).toEqual([]);
  });

  it("returns sorted records when there is no overlap", () => {
    const a = [makeRecord({ logId: "a1", timestamp: T3 })];
    const b = [makeRecord({ logId: "b1", timestamp: T1 }), makeRecord({ logId: "b2", timestamp: T2 })];
    const result = mergeAndSortRecords(a, b);
    expect(result.map((r) => r.logId)).toEqual(["b1", "b2", "a1"]);
  });

  it("deduplicates by logId, keeping the first-array (server history) copy", () => {
    const fromServer = makeRecord({ logId: "dup", timestamp: T1, eventKey: "from_server" });
    const fromWs    = makeRecord({ logId: "dup", timestamp: T1, eventKey: "from_ws" });
    const result = mergeAndSortRecords([fromServer], [fromWs]);
    expect(result).toHaveLength(1);
    expect(result[0].eventKey).toBe("from_server");
  });

  it("merges and deduplicates when arrays share some logIds", () => {
    const a = [
      makeRecord({ logId: "shared", timestamp: T1 }),
      makeRecord({ logId: "only_a",  timestamp: T3 }),
    ];
    const b = [
      makeRecord({ logId: "shared", timestamp: T1 }),
      makeRecord({ logId: "only_b",  timestamp: T2 }),
    ];
    const result = mergeAndSortRecords(a, b);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.logId)).toEqual(["shared", "only_b", "only_a"]);
  });

  it("sorts correctly when timestamps are ISO strings (WS JSON.parse delivers strings, not Dates)", () => {
    // WS records come through JSON.parse, so Date is serialized as string at runtime
    const a = makeRecord({ logId: "a1", timestamp: T3 });
    const b = makeRecord({ logId: "b1", timestamp: T1 });
    (a as unknown as Record<string, unknown>).timestamp = T3.toISOString();
    (b as unknown as Record<string, unknown>).timestamp = T1.toISOString();
    const result = mergeAndSortRecords([a], [b]);
    expect(result[0].logId).toBe("b1");
    expect(result[1].logId).toBe("a1");
  });

  it("handles mixed Date and ISO string timestamps", () => {
    const dateRecord   = makeRecord({ logId: "date_record",   timestamp: T2 });
    const stringRecord = makeRecord({ logId: "string_record", timestamp: T1 });
    (stringRecord as unknown as Record<string, unknown>).timestamp = T1.toISOString();
    const result = mergeAndSortRecords([dateRecord], [stringRecord]);
    expect(result[0].logId).toBe("string_record");
    expect(result[1].logId).toBe("date_record");
  });

  it("preserves all records when one array is empty", () => {
    const records = [
      makeRecord({ logId: "r1", timestamp: T2 }),
      makeRecord({ logId: "r2", timestamp: T1 }),
    ];
    expect(mergeAndSortRecords(records, [])).toHaveLength(2);
    expect(mergeAndSortRecords([], records)).toHaveLength(2);
    expect(mergeAndSortRecords(records, [])[0].logId).toBe("r2");
  });
});
