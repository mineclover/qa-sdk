// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

import { describe, expect, it, vi } from "vitest";
import { AuditExplorerService } from "./audit-explorer.service.js";
import type { AuditEntry, AuditRecorder } from "permission-engine";

const sampleEntries: AuditEntry[] = [
  {
    kind: "execution",
    spanId: "exec-1",
    traceId: "t1",
    parentSpanId: null,
    rootSpanId: "exec-1",
    depth: 0,
    apiId: "api-x",
    actorUserId: "u",
    actorTenantId: null,
    targetKind: "resource",
    targetId: "r1",
    outcome: "allow",
    startedAt: "2026-04-22T00:00:00Z",
    endedAt: "2026-04-22T00:00:01Z",
    metadata: null,
  },
  {
    kind: "check",
    spanId: "chk-1",
    traceId: "t1",
    parentSpanId: "exec-1",
    rootSpanId: "exec-1",
    depth: 1,
    pass: "bitmap",
    outcome: "allow",
    address: null,
    unionKind: null,
    denyReason: null,
    startedAt: "2026-04-22T00:00:00Z",
    endedAt: "2026-04-22T00:00:00Z",
    metadata: null,
  },
];

function makeMockRecorder(): AuditRecorder {
  return {
    listByRoot: vi.fn(async () => sampleEntries),
    firstFailure: vi.fn(async () => null),
    get: vi.fn(async (id: string) =>
      sampleEntries.find((e) => e.spanId === id) ?? null,
    ),
    startExecution: vi.fn(async () => sampleEntries[0] as never),
    finishExecution: vi.fn(async () => sampleEntries[0] as never),
    recordCheck: vi.fn(async () => sampleEntries[1] as never),
  };
}

describe("AuditExplorerService", () => {
  it("listTrace — listByRoot 위임", async () => {
    const rec = makeMockRecorder();
    const svc = new AuditExplorerService(rec);
    const result = await svc.listTrace("exec-1");
    expect(result).toHaveLength(2);
    expect(rec.listByRoot).toHaveBeenCalledWith("exec-1");
  });

  it("findFirstFailure — firstFailure 위임", async () => {
    const rec = makeMockRecorder();
    const svc = new AuditExplorerService(rec);
    const result = await svc.findFirstFailure("exec-1");
    expect(result).toBeNull();
  });

  it("getEntry — get 위임", async () => {
    const rec = makeMockRecorder();
    const svc = new AuditExplorerService(rec);
    const got = await svc.getEntry("chk-1");
    expect(got?.spanId).toBe("chk-1");
  });

  it("getEntry(미존재) → null", async () => {
    const rec = makeMockRecorder();
    const svc = new AuditExplorerService(rec);
    expect(await svc.getEntry("missing")).toBeNull();
  });
});
