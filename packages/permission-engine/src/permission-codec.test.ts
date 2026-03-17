import { describe, it, expect } from "vitest";
import { PermissionCodec, type CodecDims } from "./permission-codec.js";

const DIMS: CodecDims = {
  services: ["shop/payment", "cms/auth"],
  types: ["api", "page", "action"],
  resources: ["admin/teams", "admin/users", "billing/invoices"],
  actions: ["GET", "POST", "PUT", "DELETE", "view", "edit"],
};

function codec(): PermissionCodec {
  return new PermissionCodec("v1", DIMS);
}

describe("PermissionCodec", () => {
  it("size = product of all dims", () => {
    const c = codec();
    expect(c.size).toBe(2 * 3 * 3 * 6); // 108
  });

  // ── Tier 1 ↔ Tier 2 ─────────────────────────────────────────────────────

  describe("encode / decode", () => {
    it("text → integer → text 라운드트립", () => {
      const c = codec();
      const text = "shop/payment.api.admin/teams.GET";
      const addr = c.encode(text);
      expect(typeof addr).toBe("number");
      expect(addr).toBeGreaterThanOrEqual(0);
      expect(addr).toBeLessThan(c.size);

      const decoded = c.decodeToText(addr);
      expect(decoded).toBe(text);
    });

    it("encodeRaw 동일 결과", () => {
      const c = codec();
      const addr1 = c.encode("cms/auth.page.billing/invoices.view");
      const addr2 = c.encodeRaw("cms/auth", "page", "billing/invoices", "view");
      expect(addr1).toBe(addr2);
    });

    it("decode 구조체 반환", () => {
      const c = codec();
      const addr = c.encodeRaw("shop/payment", "api", "admin/users", "DELETE");
      const d = c.decode(addr);
      expect(d.service).toBe("shop/payment");
      expect(d.type).toBe("api");
      expect(d.resource).toBe("admin/users");
      expect(d.action).toBe("DELETE");
      expect(d.address).toBe(addr);
    });

    it("다른 address → 다른 text", () => {
      const c = codec();
      const a1 = c.encode("shop/payment.api.admin/teams.GET");
      const a2 = c.encode("shop/payment.api.admin/teams.POST");
      expect(a1).not.toBe(a2);
    });

    it("알 수 없는 파트 → throw", () => {
      const c = codec();
      expect(() => c.encode("unknown/svc.api.admin/teams.GET")).toThrow("Unknown service");
      expect(() => c.encodeRaw("shop/payment", "grpc", "admin/teams", "GET")).toThrow("Unknown type");
      expect(() => c.encodeRaw("shop/payment", "api", "nonexistent", "GET")).toThrow("Unknown resource");
      expect(() => c.encodeRaw("shop/payment", "api", "admin/teams", "PATCH")).toThrow("Unknown action");
    });
  });

  // ── Tier 2 직렬화 ────────────────────────────────────────────────────────

  describe("serialize / parse", () => {
    it("perm:v1:N 형식", () => {
      const c = codec();
      const addr = c.encodeRaw("shop/payment", "api", "admin/teams", "GET");
      const s = c.serialize(addr);
      expect(s).toMatch(/^perm:v1:\d+$/);

      const parsed = c.parse(s);
      expect(parsed).toBe(addr);
    });

    it("schema:address (버전 없는 단축 형태) 파싱", () => {
      const c = codec();
      const addr = 42;
      expect(c.parse(`perm:${addr}`)).toBe(addr);
    });

    it("범위 밖 address → throw", () => {
      const c = codec();
      expect(() => c.parse("perm:v1:999")).toThrow("out of range");
      expect(() => c.parse("perm:v1:-1")).toThrow("out of range");
    });
  });

  // ── Tier 3: bitmask 헬퍼 ──────────────────────────────────────────────

  describe("bitmask 연산", () => {
    it("createMask → grantTo → check", () => {
      const c = codec();
      const mask = c.createMask();
      expect(mask.length).toBe(Math.ceil(108 / 8)); // 14 bytes

      c.grantTo(mask, "shop/payment.api.admin/teams.GET");
      expect(c.check(mask, "shop/payment.api.admin/teams.GET")).toBe(true);
      expect(c.check(mask, "shop/payment.api.admin/teams.POST")).toBe(false);
    });

    it("grantRaw / checkRaw", () => {
      const c = codec();
      const mask = c.createMask();
      c.grantRaw(mask, "cms/auth", "page", "admin/users", "view");
      expect(c.checkRaw(mask, "cms/auth", "page", "admin/users", "view")).toBe(true);
      expect(c.checkRaw(mask, "cms/auth", "page", "admin/users", "edit")).toBe(false);
    });

    it("revokeFrom", () => {
      const c = codec();
      const mask = c.createMask();
      c.grantTo(mask, "shop/payment.api.admin/teams.GET");
      expect(c.countGrants(mask)).toBe(1);

      c.revokeFrom(mask, "shop/payment.api.admin/teams.GET");
      expect(c.countGrants(mask)).toBe(0);
    });

    it("listGrants — 부여된 text 목록", () => {
      const c = codec();
      const mask = c.createMask();
      c.grantTo(mask, "shop/payment.api.admin/teams.GET");
      c.grantTo(mask, "cms/auth.page.billing/invoices.view");

      const list = c.listGrants(mask);
      expect(list).toHaveLength(2);
      expect(list).toContain("shop/payment.api.admin/teams.GET");
      expect(list).toContain("cms/auth.page.billing/invoices.view");
    });

    it("listGrantsDecoded — 구조체 목록", () => {
      const c = codec();
      const mask = c.createMask();
      c.grantTo(mask, "shop/payment.api.admin/teams.DELETE");

      const list = c.listGrantsDecoded(mask);
      expect(list).toHaveLength(1);
      expect(list[0].service).toBe("shop/payment");
      expect(list[0].action).toBe("DELETE");
    });
  });

  // ── 전체 3-tier 플로우 ─────────────────────────────────────────────────

  describe("3-tier 라운드트립", () => {
    it("text → integer → serialize → parse → decode → text", () => {
      const c = codec();
      const original = "cms/auth.action.admin/users.edit";

      // Tier 1 → Tier 2
      const addr = c.encode(original);

      // Tier 2 직렬화
      const serialized = c.serialize(addr);
      expect(serialized).toBe(`perm:v1:${addr}`);

      // Tier 2 역직렬화
      const parsed = c.parse(serialized);
      expect(parsed).toBe(addr);

      // Tier 2 → Tier 1
      const restored = c.decodeToText(parsed);
      expect(restored).toBe(original);
    });

    it("text → bitmask → check → listGrants 라운드트립", () => {
      const c = codec();
      const mask = c.createMask();

      // Tier 1 → Tier 3
      const perms = [
        "shop/payment.api.admin/teams.GET",
        "shop/payment.api.admin/teams.POST",
        "cms/auth.page.admin/users.view",
      ];
      for (const p of perms) c.grantTo(mask, p);

      // Tier 3 → Tier 1
      const listed = c.listGrants(mask);
      expect(listed.sort()).toEqual(perms.sort());

      // Tier 3 크기 확인
      expect(mask.length).toBe(14); // 108 slots → 14 bytes
      expect(c.countGrants(mask)).toBe(3);
    });
  });
});
