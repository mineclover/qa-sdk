import { describe, expect, it } from "vitest";
import { predictRlsDecision } from "./rls-shadow-evaluator.js";

describe("predictRlsDecision", () => {
  const baseCtx = { userId: "alice", tenantId: "acme", bitmapMask: new Uint8Array([0x04]), role: null } as const;

  it("admin → allow", () => {
    expect(predictRlsDecision({ ...baseCtx, role: "admin" }, { resourceTable: "x", operation: "select" }).decision).toBe("allow");
  });

  it("userId 없음 → deny user_id_missing", () => {
    const p = predictRlsDecision({ ...baseCtx, userId: null }, { resourceTable: "x", operation: "select" });
    expect(p.decision).toBe("deny");
    expect(p.denyReason).toBe("user_id_missing");
  });

  it("tenantScoped & tenantId 없음 → deny", () => {
    const p = predictRlsDecision({ ...baseCtx, tenantId: null }, { resourceTable: "ingest.x", operation: "select", tenantScoped: true });
    expect(p.denyReason).toBe("tenant_id_missing");
  });

  it("bitmap 필요한데 mask null → deny bitmap_mask_missing", () => {
    const p = predictRlsDecision({ ...baseCtx, bitmapMask: null }, { resourceTable: "auth.rp", operation: "select", requiredBit: 10 });
    expect(p.denyReason).toBe("bitmap_mask_missing");
  });

  it("bitmap 있지만 bit unset → deny bitmap_bit_missing", () => {
    const p = predictRlsDecision(baseCtx, { resourceTable: "auth.rp", operation: "select", requiredBit: 0 });
    // 0x04 에서 bit 0 은 unset
    expect(p.decision).toBe("deny");
    expect(p.denyReason).toBe("bitmap_bit_missing");
  });

  it("bitmap bit set + owner 경계 → unknown", () => {
    const p = predictRlsDecision(baseCtx, { resourceTable: "auth.rp", operation: "select", requiredBit: 2, ownerField: "user_id_match" });
    expect(p.decision).toBe("unknown");
    expect(p.denyReason).toBe("needs_db_resolve");
  });

  it("모든 조건 충족 — owner 경계 없음 → allow", () => {
    const p = predictRlsDecision(baseCtx, { resourceTable: "t", operation: "select", requiredBit: 2, ownerField: "none" });
    expect(p.decision).toBe("allow");
  });
});
