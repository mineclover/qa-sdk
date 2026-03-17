import { describe, it, expect } from "vitest";
import {
  validateResource,
  canonicalizeResource,
  isValidResource,
  parseResource,
  validateResourceForType,
} from "permission-engine";

describe("validateResource", () => {
  it("유효한 resource", () => {
    expect(validateResource("admin/teams")).toEqual([]);
    expect(validateResource("billing/invoices")).toEqual([]);
    expect(validateResource("admin/teams/members")).toEqual([]);
    expect(validateResource("a")).toEqual([]);
    expect(validateResource("admin-panel/user_mgmt")).toEqual([]);
  });

  it(":param 세그먼트 허용", () => {
    expect(validateResource("admin/teams/:id")).toEqual([]);
    expect(validateResource("admin/teams/:teamId/members")).toEqual([]);
  });

  it("빈 문자열 거부", () => {
    const errors = validateResource("");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].rule).toBe("non-empty");
  });

  it("leading slash 거부", () => {
    const errors = validateResource("/admin/teams");
    expect(errors.some(e => e.rule === "no-leading-slash")).toBe(true);
  });

  it("trailing slash 거부", () => {
    const errors = validateResource("admin/teams/");
    expect(errors.some(e => e.rule === "no-trailing-slash")).toBe(true);
  });

  it("query string 거부", () => {
    const errors = validateResource("admin/teams?id=1");
    expect(errors.some(e => e.rule === "no-query")).toBe(true);
  });

  it("fragment 거부", () => {
    const errors = validateResource("admin/teams#tab");
    expect(errors.some(e => e.rule === "no-fragment")).toBe(true);
  });

  it("공백 거부", () => {
    const errors = validateResource("admin/teams list");
    expect(errors.some(e => e.rule === "no-whitespace")).toBe(true);
  });

  it("대문자 거부", () => {
    const errors = validateResource("Admin/Teams");
    expect(errors.some(e => e.rule === "lowercase")).toBe(true);
  });

  it("연속 슬래시 거부", () => {
    const errors = validateResource("admin//teams");
    expect(errors.some(e => e.rule === "no-double-slash")).toBe(true);
  });

  it("depth 제한 (기본 4)", () => {
    expect(validateResource("a/b/c/d")).toEqual([]); // depth 4 OK
    const errors = validateResource("a/b/c/d/e");
    expect(errors.some(e => e.rule === "max-depth")).toBe(true);
  });

  it("depth 제한 커스텀", () => {
    expect(validateResource("a/b/c", { maxDepth: 2 })).not.toEqual([]);
    expect(validateResource("a/b", { maxDepth: 2 })).toEqual([]);
  });

  it(":param 금지 옵션", () => {
    const errors = validateResource("admin/:id", { allowParams: false });
    expect(errors.some(e => e.rule === "no-params")).toBe(true);
  });

  it("잘못된 :param 형식", () => {
    const errors = validateResource("admin/:123bad");
    expect(errors.some(e => e.rule === "param-format")).toBe(true);
  });

  it("허용되지 않는 문자", () => {
    const errors = validateResource("admin/teams@v2");
    expect(errors.some(e => e.rule === "segment-chars")).toBe(true);
  });
});

describe("canonicalizeResource", () => {
  it("유효한 resource 그대로 반환", () => {
    expect(canonicalizeResource("admin/teams")).toBe("admin/teams");
  });

  it("앞뒤 공백 trim", () => {
    expect(canonicalizeResource("  admin/teams  ")).toBe("admin/teams");
  });

  it("유효하지 않으면 throw", () => {
    expect(() => canonicalizeResource("/admin/teams")).toThrow("Invalid resource");
    expect(() => canonicalizeResource("Admin/Teams")).toThrow("Invalid resource");
  });
});

describe("isValidResource", () => {
  it("유효 → true", () => {
    expect(isValidResource("admin/teams")).toBe(true);
  });
  it("무효 → false", () => {
    expect(isValidResource("/admin")).toBe(false);
    expect(isValidResource("")).toBe(false);
  });
});

describe("parseResource", () => {
  it("기본 파싱", () => {
    const parsed = parseResource("admin/teams/members");
    expect(parsed.raw).toBe("admin/teams/members");
    expect(parsed.segments).toEqual(["admin", "teams", "members"]);
    expect(parsed.depth).toBe(3);
    expect(parsed.hasParams).toBe(false);
    expect(parsed.paramNames).toEqual([]);
  });

  it(":param 파싱", () => {
    const parsed = parseResource("admin/teams/:teamId/members");
    expect(parsed.hasParams).toBe(true);
    expect(parsed.paramNames).toEqual(["teamId"]);
  });
});

describe("validateResourceForType", () => {
  it("page — :param 금지", () => {
    const errors = validateResourceForType("admin/:id", "page");
    expect(errors.some(e => e.rule === "no-params")).toBe(true);
  });

  it("page — depth 3 이하", () => {
    expect(validateResourceForType("a/b/c", "page")).toEqual([]);
    const errors = validateResourceForType("a/b/c/d", "page");
    expect(errors.some(e => e.rule === "max-depth")).toBe(true);
  });

  it("api — :param 허용, depth 4", () => {
    expect(validateResourceForType("admin/teams/:id", "api")).toEqual([]);
    expect(validateResourceForType("a/b/c/d", "api")).toEqual([]);
  });

  it("action — :param 금지", () => {
    const errors = validateResourceForType("admin/:id", "action");
    expect(errors.some(e => e.rule === "no-params")).toBe(true);
  });

  it("미등록 type — 기본 검증", () => {
    expect(validateResourceForType("admin/teams", "custom")).toEqual([]);
  });
});
