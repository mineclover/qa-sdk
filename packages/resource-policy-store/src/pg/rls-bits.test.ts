import { describe, expect, it } from "vitest";
import { RLS_BIT_CATALOG } from "./rls-bits.js";

describe("RLS bit catalog", () => {
  it("모든 값이 정수", () => {
    for (const [name, val] of Object.entries(RLS_BIT_CATALOG)) {
      expect(Number.isInteger(val), `${name}=${val} 정수여야 함`).toBe(true);
      expect(val, `${name} ≥ 0`).toBeGreaterThanOrEqual(0);
    }
  });

  it("bit 값이 모두 유니크", () => {
    const values = Object.values(RLS_BIT_CATALOG);
    expect(new Set(values).size).toBe(values.length);
  });

  it("도메인 범위 규약 준수 — 10s=rp, 20s=audit, 30s=ingest", () => {
    expect(RLS_BIT_CATALOG.RP_READ_BIT).toBeGreaterThanOrEqual(10);
    expect(RLS_BIT_CATALOG.RP_READ_BIT).toBeLessThan(20);
    expect(RLS_BIT_CATALOG.AUDIT_READ_BIT).toBeGreaterThanOrEqual(20);
    expect(RLS_BIT_CATALOG.AUDIT_READ_BIT).toBeLessThan(30);
    expect(RLS_BIT_CATALOG.INGEST_READ_BIT).toBeGreaterThanOrEqual(30);
    expect(RLS_BIT_CATALOG.EVENT_READ_BIT).toBeGreaterThanOrEqual(30);
  });
});
