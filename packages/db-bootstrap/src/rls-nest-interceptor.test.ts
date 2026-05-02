import { describe, expect, it } from "vitest";
import { of, lastValueFrom } from "rxjs";

import {
  RlsContextInterceptor,
  claimsToRlsContext,
  decodeBitmapHex,
} from "./rls-nest-interceptor.js";
import { getCurrentRlsContext } from "./rls-context-storage.js";

describe("decodeBitmapHex", () => {
  it("짝수 길이 hex → Uint8Array", () => {
    expect(Array.from(decodeBitmapHex("01ff"))).toEqual([0x01, 0xff]);
  });
  it("0x prefix 허용", () => {
    expect(Array.from(decodeBitmapHex("0x01"))).toEqual([0x01]);
  });
  it("홀수 길이 → throw", () => {
    expect(() => decodeBitmapHex("abc")).toThrow();
  });
});

describe("claimsToRlsContext", () => {
  it("null claims → 모두 null", () => {
    const ctx = claimsToRlsContext(null);
    expect(ctx.userId).toBeNull();
    expect(ctx.bitmapMask).toBeNull();
  });
  it("sub + tenantId + bitmap → context 정상", () => {
    const ctx = claimsToRlsContext({
      sub: "alice",
      tenantId: "acme",
      bitmap: { mask_hex: "01" },
    });
    expect(ctx.userId).toBe("alice");
    expect(ctx.tenantId).toBe("acme");
    expect(ctx.bitmapMask).toEqual(new Uint8Array([0x01]));
    expect(ctx.role).toBeNull();
  });
  it("role='admin' 인식", () => {
    const ctx = claimsToRlsContext({ sub: "adm", role: "admin" });
    expect(ctx.role).toBe("admin");
  });
  it("잘못된 bitmap hex → null (default deny)", () => {
    const ctx = claimsToRlsContext({ sub: "x", bitmap: { mask_hex: "zz" } });
    expect(ctx.bitmapMask).toBeNull();
  });
});

describe("RlsContextInterceptor", () => {
  it("request.user → AsyncLocalStorage bind 후 handle 결과 반환", async () => {
    const interceptor = new RlsContextInterceptor();
    let observed: ReturnType<typeof getCurrentRlsContext> | null = null;
    const execCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: "alice", tenantId: "acme" } }),
      }),
    } as never;
    const next = {
      handle: () => {
        observed = getCurrentRlsContext();
        return of("OK");
      },
    } as never;
    const result = await lastValueFrom(interceptor.intercept(execCtx, next));
    expect(result).toBe("OK");
    expect(observed!.userId).toBe("alice");
    expect(observed!.tenantId).toBe("acme");
  });

  it("claims 없으면 default (null) context", async () => {
    const interceptor = new RlsContextInterceptor();
    let observed: ReturnType<typeof getCurrentRlsContext> | null = null;
    const execCtx = { switchToHttp: () => ({ getRequest: () => ({}) }) } as never;
    const next = {
      handle: () => {
        observed = getCurrentRlsContext();
        return of("OK");
      },
    } as never;
    await lastValueFrom(interceptor.intercept(execCtx, next));
    expect(observed!.userId).toBeNull();
  });

  it("claimsAccessor 옵션 override", async () => {
    const interceptor = new RlsContextInterceptor({
      claimsAccessor: () => ({ sub: "bob" }),
    });
    let observed: ReturnType<typeof getCurrentRlsContext> | null = null;
    const execCtx = { switchToHttp: () => ({ getRequest: () => ({}) }) } as never;
    const next = {
      handle: () => {
        observed = getCurrentRlsContext();
        return of("OK");
      },
    } as never;
    await lastValueFrom(interceptor.intercept(execCtx, next));
    expect(observed!.userId).toBe("bob");
  });
});
