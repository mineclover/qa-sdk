import { describe, expect, it } from "vitest";
import { PROTECTED_TABLES, formatEnforceStatus } from "./enforce.js";

describe("Plan 15e enforce — 순수 유틸", () => {
  it("PROTECTED_TABLES 6건", () => {
    expect(PROTECTED_TABLES).toHaveLength(6);
    expect(PROTECTED_TABLES).toContain("auth.resource_policies");
    expect(PROTECTED_TABLES).toContain("audit.audit_entries");
    expect(PROTECTED_TABLES).toContain("ingest.event_records");
  });
  it("formatEnforceStatus — header + rows", () => {
    const out = formatEnforceStatus([
      { table: "auth.resource_policies", rowSecurityEnabled: true, forced: true },
      { table: "audit.audit_entries",    rowSecurityEnabled: true, forced: false },
    ]);
    expect(out).toContain("RLS enabled");
    expect(out).toContain("auth.resource_policies");
    expect(out).toContain("true");
    expect(out).toContain("false");
  });
});
