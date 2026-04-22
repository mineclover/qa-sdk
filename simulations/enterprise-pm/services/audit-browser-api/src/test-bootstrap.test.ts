// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

import { describe, expect, it, vi } from "vitest";
import type { AuditRecorder } from "permission-engine";
import { bootstrapTestAuditBrowserApi } from "./test-bootstrap.js";

describe("bootstrapTestAuditBrowserApi", () => {
  it("외부 recorder 주입 → NestJS app 부팅 + /audit/trace/:id 동작", async () => {
    const sampleEntries = [
      {
        kind: "execution",
        spanId: "exec-1",
        traceId: "t1",
        parentSpanId: null,
        apiId: "api-x",
        actorUserId: "u1",
        outcome: "allow",
        startedAt: "2026-04-22T00:00:00Z",
        finishedAt: "2026-04-22T00:00:01Z",
      },
    ];
    const mockRecorder = {
      listByRoot: vi.fn().mockResolvedValue(sampleEntries),
      firstFailure: vi.fn().mockResolvedValue(null),
      get: vi.fn().mockResolvedValue(sampleEntries[0]),
      startExecution: vi.fn(),
      finishExecution: vi.fn(),
      recordCheck: vi.fn(),
    } as unknown as AuditRecorder;

    const ctx = await bootstrapTestAuditBrowserApi({ recorder: mockRecorder });
    try {
      const fastifyInstance = ctx.app.getHttpAdapter().getInstance() as {
        inject: (opts: { method: string; url: string }) => Promise<{
          statusCode: number;
          payload: string;
        }>;
      };
      const res = await fastifyInstance.inject({
        method: "GET",
        url: "/audit/trace/exec-1",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.count).toBe(1);
      expect(body.entries[0].spanId).toBe("exec-1");
      expect(mockRecorder.listByRoot).toHaveBeenCalledWith("exec-1");
    } finally {
      await ctx.close();
    }
  });

  it("recorder 누락 → throw (no fallback)", async () => {
    await expect(
      bootstrapTestAuditBrowserApi({ recorder: null as never }),
    ).rejects.toThrow(/recorder/);
  });

  it("cleanup — close() 호출 시 app.close() 위임", async () => {
    const mockRecorder = {
      listByRoot: vi.fn(),
      firstFailure: vi.fn(),
      get: vi.fn(),
      startExecution: vi.fn(),
      finishExecution: vi.fn(),
      recordCheck: vi.fn(),
    } as unknown as AuditRecorder;
    const ctx = await bootstrapTestAuditBrowserApi({ recorder: mockRecorder });
    await ctx.close();
    await ctx.close(); // idempotent
  });
});
