import { describe, it, expect } from "vitest";
import { DEMO_CATALOG } from "demo-snapshot";
import { encodePrefixByValue, decodePrefix, getPrefixShape } from "demo-snapshot";
import { createDimWireCodec } from "./dim-wire.js";

describe("DimWireCodec", () => {
  const codec = createDimWireCodec(DEMO_CATALOG);

  // ── rbac prefix: role × action × resource (axis 전용, prefix_ref 없음) ────
  describe("rbac (axis-only prefix)", () => {
    it("encodeDims → decodeDims 라운드트립", () => {
      const values = { role: "admin", action: "write", resource: "dashboard" };
      const dims = codec.encodeDims("rbac", values);

      expect(dims.role).toBe(1);       // admin은 첫 번째 → 1-based = 1
      expect(dims.action).toBe(2);     // write는 두 번째 → 1-based = 2
      expect(dims.resource).toBe(1);   // dashboard는 첫 번째 → 1-based = 1

      const decoded = codec.decodeDims("rbac", dims);
      expect(decoded).toEqual(values);
    });

    it("addressToDims → dimsToAddress 라운드트립", () => {
      const address = 5;
      const dims = codec.addressToDims("rbac", address, "v1");
      const restored = codec.dimsToAddress("rbac", dims, "v1");
      expect(restored).toBe(address);
    });

    it("전체 주소 범위 address ↔ dims 라운드트립", () => {
      const { capacity } = getPrefixShape(DEMO_CATALOG, "rbac", "v1");
      for (let addr = 0; addr < capacity; addr++) {
        const dims = codec.addressToDims("rbac", addr, "v1");
        const restored = codec.dimsToAddress("rbac", dims, "v1");
        expect(restored).toBe(addr);
      }
    });

    it("encodeDims ↔ addressToDims 교차 검증", () => {
      // encodePrefixByValue로 1D 주소를 얻고, 그 주소에서 dims 추출
      const values = { role: "viewer", action: "read", resource: "reports" };
      const address = encodePrefixByValue(DEMO_CATALOG, "rbac", "v1", values);

      // dim-wire encodeDims
      const dimsByValue = codec.encodeDims("rbac", values);
      // dim-wire addressToDims
      const dimsByAddr = codec.addressToDims("rbac", address, "v1");

      expect(dimsByValue).toEqual(dimsByAddr);
    });

    it("encodeDims → dimsToAddress = encodePrefixByValue", () => {
      const values = { role: "editor", action: "delete", resource: "users" };
      const dims = codec.encodeDims("rbac", values);
      const addrFromDims = codec.dimsToAddress("rbac", dims, "v1");
      const addrDirect = encodePrefixByValue(DEMO_CATALOG, "rbac", "v1", values);
      expect(addrFromDims).toBe(addrDirect);
    });
  });

  // ── tracking prefix: trackAction × page × userType (axis 전용) ────────────
  describe("tracking (axis-only prefix)", () => {
    it("encodeDims → decodeDims 라운드트립", () => {
      const values = { trackAction: "click", page: "home", userType: "guest" };
      const dims = codec.encodeDims("tracking", values);
      const decoded = codec.decodeDims("tracking", dims);
      expect(decoded).toEqual(values);
    });

    it("addressToDims → dimsToAddress 라운드트립", () => {
      // tracking 최신 버전 사용
      const address = 10;
      const dims = codec.addressToDims("tracking", address);
      const restored = codec.dimsToAddress("tracking", dims);
      expect(restored).toBe(address);
    });
  });

  // ── service prefix: env × region × svc_name × namespace (axis 전용) ───────
  describe("service (4-dim axis-only prefix)", () => {
    it("encodeDims → decodeDims 라운드트립", () => {
      const values = { env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop" };
      const dims = codec.encodeDims("service", values);
      const decoded = codec.decodeDims("service", dims);
      expect(decoded).toEqual(values);
    });

    it("addressToDims와 기존 decodePrefix 결과 일치", () => {
      const address = 0;
      const dims = codec.addressToDims("service", address, "v1");
      const decodedLegacy = decodePrefix(DEMO_CATALOG, "service", "v1", address);

      for (const [label, dp] of Object.entries(decodedLegacy)) {
        expect(dims[label]).toBe(dp.position + 1); // decodePrefix는 0-based, dims는 1-based
      }
    });
  });

  // ── content prefix: 5차원 축 전용 ──────────────────────────────────────────
  describe("content (5-dim axis-only prefix)", () => {
    it("encodeDims → decodeDims 라운드트립", () => {
      const values = { tag: "backend", category: "tech", status: "published", locale: "ko", channel: "web" };
      const dims = codec.encodeDims("content", values);
      const decoded = codec.decodeDims("content", dims);
      expect(decoded).toEqual(values);
    });
  });

  // ── prefix_ref가 포함된 prefix → 에러 ────────────────────────────────────────
  describe("prefix_ref 차원 포함 시 에러", () => {
    it("encodeDims: permission (prefix_ref 포함) → 에러", () => {
      expect(() => {
        codec.encodeDims("permission", { perm_svc: "0", role: "admin" });
      }).toThrow(/prefix_ref/);
    });

    it("decodeDims: permission (prefix_ref 포함) → 에러", () => {
      expect(() => {
        codec.decodeDims("permission", { perm_svc: 1, role: 1 });
      }).toThrow(/prefix_ref/);
    });
  });

  // ── addressToDims/dimsToAddress는 prefix_ref 포함 prefix도 동작 ─────────────
  describe("addressToDims/dimsToAddress with prefix_ref", () => {
    it("permission: address ↔ dims 라운드트립", () => {
      const address = 3;
      const dims = codec.addressToDims("permission", address, "v1");
      const restored = codec.dimsToAddress("permission", dims, "v1");
      expect(restored).toBe(address);
    });
  });

  // ── 에러 케이스 ─────────────────────────────────────────────────────────────
  describe("에러 케이스", () => {
    it("알 수 없는 prefix → 에러", () => {
      expect(() => codec.encodeDims("nonexistent", {})).toThrow(/Unknown prefix/);
    });

    it("잘못된 entry 값 → 에러", () => {
      expect(() => {
        codec.encodeDims("rbac", { role: "superadmin", action: "read", resource: "dashboard" });
      }).toThrow(/Unknown entry/);
    });

    it("누락된 dim → 에러", () => {
      expect(() => {
        codec.encodeDims("rbac", { role: "admin", action: "read" }); // resource 누락
      }).toThrow(/Missing value/);
    });

    it("범위 밖 인덱스 → 에러", () => {
      expect(() => {
        codec.decodeDims("rbac", { role: 999, action: 1, resource: 1 });
      }).toThrow(/out of range/);
    });

    it("0 인덱스 (1-based이므로 무효) → 에러", () => {
      expect(() => {
        codec.decodeDims("rbac", { role: 0, action: 1, resource: 1 });
      }).toThrow(/out of range/);
    });
  });
});
