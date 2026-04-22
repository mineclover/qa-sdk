// @def.boundary sim-pm-api
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * OtelAuditRecorder wrap smoke — pm-api가 AccessChecker를 사용할 때
 * active span에서 trace_id/span_id를 자동 주입하는지 검증.
 *
 * AccessChecker 실 도입은 Plan 11b 이후. 본 파일은 wrapper 단독 동작 회귀만 수행.
 */

import { describe, expect, it, vi } from "vitest";
import { OtelAuditRecorder } from "permission-engine";

describe("PM AccessChecker — OtelAuditRecorder 부착 검증", () => {
  it("wrapper가 random ID 자동 생성 (active span 없을 때)", async () => {
    const baseAudit = {
      startExecution: vi.fn(async (args) => args),
      finishExecution: vi.fn(async () => ({}) as never),
      recordCheck: vi.fn(async (args) => args),
      get: vi.fn(),
      listByRoot: vi.fn(),
      firstFailure: vi.fn(),
    } as never;
    const wrapped = new OtelAuditRecorder(baseAudit);

    await wrapped.startExecution({
      apiId: "test-api",
      actorUserId: "u1",
      targetKind: "resource",
      targetId: "r1",
    } as never);

    expect(baseAudit.startExecution).toHaveBeenCalledTimes(1);
    const args = (
      baseAudit.startExecution as unknown as {
        mock: { calls: unknown[][] };
      }
    ).mock.calls[0][0] as { spanId: string; traceId: string };
    expect(args.spanId).toMatch(/^[0-9a-f]{16}$/); // 8 byte hex
    expect(args.traceId).toMatch(/^[0-9a-f]{32}$/); // 16 byte hex
  });
});
