import { describe, expect, it } from "vitest";
import {
  auditContextHint,
  auditEntryHint,
  auditFirstFailureHint,
  auditTraceHint,
} from "./operator-handoff.js";

describe("operator-handoff", () => {
  it("builds trace/first-failure/entry/context commands", () => {
    expect(auditTraceHint("root-1", "trace")).toContain(
      "trace: pnpm --filter @qa-sdk/sim-scenarios start -- audit trace --root-span-id root-1",
    );
    expect(auditFirstFailureHint("root-1", "ff")).toContain(
      "ff: pnpm --filter @qa-sdk/sim-scenarios start -- audit first-failure --root-span-id root-1",
    );
    expect(auditEntryHint("span-1", "entry")).toContain(
      "entry: pnpm --filter @qa-sdk/sim-scenarios start -- audit entry --span-id span-1",
    );
    expect(auditContextHint("root-1", "graph-1", "ctx")).toContain(
      "ctx: pnpm --filter @qa-sdk/sim-scenarios start -- audit context --root-span-id root-1 --graph-id graph-1",
    );
  });
});
