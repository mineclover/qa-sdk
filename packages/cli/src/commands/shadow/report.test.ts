import { describe, expect, it } from "vitest";
import { formatShadowReport } from "./report.js";

describe("formatShadowReport", () => {
  it("빈 배열 → placeholder", () => {
    expect(formatShadowReport([])).toBe("(no shadow activity)");
  });
  it("정상 렌더링 — header + rows", () => {
    const text = formatShadowReport([
      { resourceTable: "auth.resource_policies", operation: "select", denyReason: "bitmap_bit_missing", divergenceCount: 5, totalCount: 12 },
      { resourceTable: "ingest.event_records",    operation: "insert", denyReason: null,                  divergenceCount: 0, totalCount: 8 },
    ]);
    expect(text).toContain("auth.resource_policies");
    expect(text).toContain("bitmap_bit_missing");
    expect(text).toContain("ingest.event_records");
    expect(text.split("\n").length).toBeGreaterThan(2);
  });
});
