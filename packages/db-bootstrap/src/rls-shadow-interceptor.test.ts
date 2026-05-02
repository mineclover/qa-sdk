import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { of, lastValueFrom, throwError as rxThrow } from "rxjs";
import { RlsShadowInterceptor, RLS_SHADOW_META } from "./rls-shadow-interceptor.js";
import { withRlsContext } from "./rls-context-storage.js";

function mockCtx(metaValue: unknown) {
  const handler = (() => {}) as Function;
  Reflect.defineMetadata(RLS_SHADOW_META, metaValue, handler);
  return {
    switchToHttp: () => ({ getRequest: () => ({ requestId: "r-1" }) }),
    getHandler: () => handler,
  } as never;
}

describe("RlsShadowInterceptor", () => {
  it("meta 없으면 패스스루 — recorder 미호출", async () => {
    const rec = { record: vi.fn() };
    const ic = new RlsShadowInterceptor(rec);
    const execCtx = { switchToHttp: () => ({ getRequest: () => ({}) }), getHandler: () => () => {} } as never;
    const result = await lastValueFrom(ic.intercept(execCtx, { handle: () => of("OK") } as never));
    expect(result).toBe("OK");
    expect(rec.record).not.toHaveBeenCalled();
  });

  it("meta 있고 응답 성공 → applicationDecision=allow 기록", async () => {
    const rec = { record: vi.fn() };
    const ic = new RlsShadowInterceptor(rec);
    const ctxMeta = mockCtx({ resourceTable: "auth.resource_policies", operation: "select", requiredBit: 10, ownerField: "user_id_match" });
    await withRlsContext(
      { userId: "alice", tenantId: null, bitmapMask: new Uint8Array([0x00]), role: null },
      () => lastValueFrom(ic.intercept(ctxMeta, { handle: () => of("OK") } as never)),
    );
    expect(rec.record).toHaveBeenCalledTimes(1);
    const call = rec.record.mock.calls[0][0];
    expect(call.applicationDecision).toBe("allow");
    expect(call.rlsPrediction.denyReason).toBe("bitmap_bit_missing");
    expect(call.requestId).toBe("r-1");
  });

  it("응답 에러 → applicationDecision=deny 기록 + 에러 rethrow", async () => {
    const rec = { record: vi.fn() };
    const ic = new RlsShadowInterceptor(rec);
    const ctxMeta = mockCtx({ resourceTable: "t", operation: "select" });
    await expect(
      withRlsContext(
        { userId: "bob", tenantId: null, bitmapMask: null, role: null },
        () => lastValueFrom(ic.intercept(ctxMeta, { handle: () => rxThrow(() => new Error("boom")) } as never)),
      ),
    ).rejects.toThrow("boom");
    expect(rec.record).toHaveBeenCalledTimes(1);
    expect(rec.record.mock.calls[0][0].applicationDecision).toBe("deny");
  });

  it("enabled=false → 패스스루", async () => {
    const rec = { record: vi.fn() };
    const ic = new RlsShadowInterceptor(rec, { enabled: false });
    const ctxMeta = mockCtx({ resourceTable: "t", operation: "select" });
    await lastValueFrom(ic.intercept(ctxMeta, { handle: () => of("OK") } as never));
    expect(rec.record).not.toHaveBeenCalled();
  });
});
