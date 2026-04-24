import { describe, expect, it } from "vitest";
import {
  summarizeAuditEntryView,
  summarizeAuditFirstFailureView,
  summarizeAuditTraceView,
} from "./audit-trace.js";

describe("audit-trace", () => {
  it("summarizes trace view", () => {
    expect(
      summarizeAuditTraceView({
        rootSpanId: "root-1",
        count: 3,
        entries: [
          { kind: "execution", outcome: "deny" },
          { kind: "check", outcome: "deny" },
        ],
      }),
    ).toContain("denyChecks=1");
  });

  it("summarizes first failure view", () => {
    expect(
      summarizeAuditFirstFailureView({
        rootSpanId: "root-1",
        firstFailure: {
          spanId: "sp-1",
          kind: "check",
          outcome: "deny",
          denyReason: "not_owner",
        },
      }),
    ).toContain("denyReason=not_owner");
  });

  it("summarizes entry view", () => {
    expect(
      summarizeAuditEntryView({
        spanId: "sp-1",
        kind: "check",
        outcome: "allow",
      }),
    ).toContain("span=sp-1");
  });
});
