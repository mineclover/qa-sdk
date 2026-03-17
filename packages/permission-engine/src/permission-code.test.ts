import { describe, it, expect } from "vitest";
import {
  formatPermCode,
  parsePermCode,
  createPermCodeFactory,
} from "./permission-code.js";
import { createServiceContext } from "./service-ref.js";

describe("formatPermCode", () => {
  it("기본 포맷", () => {
    expect(formatPermCode({
      service: "shop/payment",
      type: "api",
      resource: "admin/teams",
      action: "GET",
    })).toBe("shop/payment.api.admin/teams.GET");
  });

  it("page 타입", () => {
    expect(formatPermCode({
      service: "cms/portal",
      type: "page",
      resource: "admin/users",
      action: "view",
    })).toBe("cms/portal.page.admin/users.view");
  });

  it("단일 세그먼트 resource", () => {
    expect(formatPermCode({
      service: "shop/auth",
      type: "api",
      resource: "login",
      action: "POST",
    })).toBe("shop/auth.api.login.POST");
  });

  it("deep resource", () => {
    expect(formatPermCode({
      service: "shop/payment",
      type: "api",
      resource: "admin/teams/members",
      action: "DELETE",
    })).toBe("shop/payment.api.admin/teams/members.DELETE");
  });
});

describe("parsePermCode", () => {
  it("기본 파싱", () => {
    const code = parsePermCode("shop/payment.api.admin/teams.GET");
    expect(code.service).toBe("shop/payment");
    expect(code.type).toBe("api");
    expect(code.resource).toBe("admin/teams");
    expect(code.action).toBe("GET");
  });

  it("deep resource 파싱", () => {
    const code = parsePermCode("shop/payment.api.admin/teams/members.DELETE");
    expect(code.resource).toBe("admin/teams/members");
    expect(code.action).toBe("DELETE");
  });

  it("page 타입 파싱", () => {
    const code = parsePermCode("cms/portal.page.admin/users.view");
    expect(code.service).toBe("cms/portal");
    expect(code.type).toBe("page");
    expect(code.resource).toBe("admin/users");
    expect(code.action).toBe("view");
  });

  it("단일 세그먼트 resource", () => {
    const code = parsePermCode("shop/auth.api.login.POST");
    expect(code.resource).toBe("login");
    expect(code.action).toBe("POST");
  });

  it("format → parse 라운드트립", () => {
    const original = {
      service: "shop/payment",
      type: "api",
      resource: "billing/invoices",
      action: "PATCH",
    };
    const roundtrip = parsePermCode(formatPermCode(original));
    expect(roundtrip).toEqual(original);
  });

  it("잘못된 형식 throw", () => {
    expect(() => parsePermCode("no-dots")).toThrow("형식 필요");
    expect(() => parsePermCode("a.b")).toThrow();
    expect(() => parsePermCode("a.b.c")).toThrow("resource.action 구분");
  });
});

describe("createPermCodeFactory", () => {
  const ctx = createServiceContext({
    namespace: "shop",
    name: "payment",
    env: "prod",
    region: "asia",
  });

  it("PermissionCode 생성 (service 자동 바인딩)", () => {
    const perm = createPermCodeFactory(ctx);
    const code = perm("api", "admin/teams", "GET");
    expect(code.service).toBe("shop/payment");
    expect(code.type).toBe("api");
    expect(code.resource).toBe("admin/teams");
    expect(code.action).toBe("GET");
  });

  it(".format() — 문자열 직접 생성", () => {
    const perm = createPermCodeFactory(ctx);
    expect(perm.format("api", "admin/teams", "GET"))
      .toBe("shop/payment.api.admin/teams.GET");
  });

  it("resource 정규화 적용", () => {
    const perm = createPermCodeFactory(ctx);
    // 앞뒤 공백 → trim
    expect(perm("api", "  admin/teams  ", "GET").resource).toBe("admin/teams");
  });

  it("잘못된 resource → throw", () => {
    const perm = createPermCodeFactory(ctx);
    expect(() => perm("api", "/admin/teams", "GET")).toThrow("Invalid resource");
  });
});
