// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

import { describe, expect, it, vi } from "vitest";
import { AuditExplorerController } from "./audit-explorer.controller.js";
import { AuditExplorerService } from "./audit-explorer.service.js";
import type { AuditRecorder } from "permission-engine";

function makeMockRecorder(
  overrides: Partial<AuditRecorder> = {},
): AuditRecorder {
  return {
    listByRoot: vi.fn(async () => []),
    firstFailure: vi.fn(async () => null),
    get: vi.fn(async () => null),
    startExecution: vi.fn(async () => ({}) as never),
    finishExecution: vi.fn(async () => ({}) as never),
    recordCheck: vi.fn(async () => ({}) as never),
    ...overrides,
  };
}

describe("AuditExplorerController", () => {
  it("GET /audit/trace/:id — count + entries 응답", async () => {
    const rec = makeMockRecorder({
      listByRoot: vi.fn(async () => [
        {
          kind: "execution",
          spanId: "x",
          traceId: "t",
          parentSpanId: null,
          rootSpanId: "x",
          depth: 0,
          apiId: "api",
          actorUserId: "u",
          actorTenantId: null,
          targetKind: "r",
          targetId: "r1",
          outcome: "allow",
          startedAt: "2026-04-22T00:00:00Z",
          endedAt: null,
          metadata: null,
        } as never,
      ]),
    });
    const svc = new AuditExplorerService(rec);
    const ctrl = new AuditExplorerController(svc);
    const result = await ctrl.trace("x");
    expect(result.count).toBe(1);
    expect(result.rootSpanId).toBe("x");
  });

  it("GET /audit/entry/:id (미존재) → NotFoundException", async () => {
    const rec = makeMockRecorder({ get: vi.fn(async () => null) });
    const svc = new AuditExplorerService(rec);
    const ctrl = new AuditExplorerController(svc);
    try {
      await ctrl.entry("nope");
      throw new Error("should have thrown");
    } catch (err) {
      // NestJS NotFoundException.response.error === "not_found"
      const response = (err as { response?: { error?: string } }).response;
      expect(response?.error).toBe("not_found");
    }
  });
});
