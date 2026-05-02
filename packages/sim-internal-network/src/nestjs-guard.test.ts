import { describe, it, expect } from "vitest";
import { NotFoundException, type ExecutionContext } from "@nestjs/common";
import { InternalIpGuard } from "./nestjs-guard.js";

function ctx(request: { ip?: string; headers?: Record<string, string> }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}), getNext: () => ({}) }),
    getType: () => "http",
  } as unknown as ExecutionContext;
}

describe("InternalIpGuard (spec §3)", () => {
  const guard = new InternalIpGuard();
  it("internal request.ip → true / external → 404", () => {
    for (const ip of ["172.17.0.5", "127.0.0.1", "::1"]) expect(guard.canActivate(ctx({ ip }))).toBe(true);
    expect(() => guard.canActivate(ctx({ ip: "8.8.8.8" }))).toThrow(NotFoundException);
  });
  it("XFF leftmost로 분기", () => {
    expect(guard.canActivate(ctx({ headers: { "x-forwarded-for": "172.17.0.5, 8.8.8.8" } }))).toBe(true);
    expect(() => guard.canActivate(ctx({ headers: { "x-forwarded-for": "8.8.8.8, 172.17.0.5" } })))
      .toThrow(NotFoundException);
  });
  it("ip 정보 전혀 없으면 404 (정보 누출 방지)", () => {
    expect(() => guard.canActivate(ctx({}))).toThrow(NotFoundException);
  });
});
