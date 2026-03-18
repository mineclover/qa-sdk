import { describe, it, expect } from "vitest";
import { PermissionCodec, PermissionView } from "./permission-codec.js";
import { hasBit, popcount } from "weighted-index";

const DIMS = {
  services:  ["shop/payment", "cms/auth", "analytics/event"],
  types:     ["api", "page", "action"],
  resources: ["admin/teams", "billing/invoices", "users/profile", "dashboard"],
  actions:   ["GET", "POST", "PUT", "DELETE"],
};

function createCodec() {
  return new PermissionCodec("v1", DIMS);
}

// ═════════════════════════════════════════════════════════════════════════════
//  기본 encode / decode (기존 API 호환)
// ═════════════════════════════════════════════════════════════════════════════

describe("기본 encode / decode", () => {
  const codec = createCodec();

  it("encode → decode 라운드트립", () => {
    const addr = codec.encodeRaw("shop/payment", "api", "admin/teams", "GET");
    const decoded = codec.decode(addr);
    expect(decoded.service).toBe("shop/payment");
    expect(decoded.type).toBe("api");
    expect(decoded.resource).toBe("admin/teams");
    expect(decoded.action).toBe("GET");
  });

  it("size = 3×3×4×4 = 144", () => {
    expect(codec.size).toBe(144);
  });

  it("mask grant/check", () => {
    const mask = codec.createMask();
    codec.grantRaw(mask, "shop/payment", "api", "admin/teams", "GET");
    expect(codec.checkRaw(mask, "shop/payment", "api", "admin/teams", "GET")).toBe(true);
    expect(codec.checkRaw(mask, "shop/payment", "api", "admin/teams", "POST")).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  BitIndex 최적화 API
// ═════════════════════════════════════════════════════════════════════════════

describe("BitIndex 최적화 — bitIndex / bridge", () => {
  const codec = createCodec();

  it("bitIndex shape이 WeightedIndex shape과 동일", () => {
    expect([...codec.bitIndex.shape]).toEqual([...codec.index.shape]);
  });

  it("bridge 양방향 변환 전수 검증", () => {
    for (let i = 0; i < codec.size; i++) {
      const biPacked = codec.bridge.toBit(i);
      expect(codec.bridge.toWeighted(biPacked)).toBe(i);
    }
  });
});

describe("toBitMaskSet / toUint8Mask 변환", () => {
  const codec = createCodec();

  it("Uint8Array → BitMaskSet → Uint8Array 왕복 보존", () => {
    const mask = codec.createMask();
    codec.grantRaw(mask, "shop/payment", "api", "admin/teams", "GET");
    codec.grantRaw(mask, "cms/auth", "page", "users/profile", "DELETE");
    codec.grantRaw(mask, "analytics/event", "action", "dashboard", "POST");

    const bitSet = codec.toBitMaskSet(mask);
    expect(bitSet.size).toBe(3);

    const restored = codec.toUint8Mask(bitSet);
    expect(popcount(restored)).toBe(3);

    // 원본 mask와 동일한 bit 위치
    for (let i = 0; i < codec.size; i++) {
      expect(hasBit(restored, i)).toBe(hasBit(mask, i));
    }
  });

  it("전체 부여 → 변환 → 동일 개수", () => {
    const mask = codec.createMask();
    for (let i = 0; i < codec.size; i++) {
      const { service, type, resource, action } = codec.decode(i);
      codec.grantRaw(mask, service, type, resource, action);
    }

    const bitSet = codec.toBitMaskSet(mask);
    expect(bitSet.size).toBe(codec.size);

    const restored = codec.toUint8Mask(bitSet);
    expect(popcount(restored)).toBe(codec.size);
  });
});

describe("toBitMaskSet → extractDim 필터", () => {
  const codec = createCodec();

  it("BitMaskSet에서 service별 필터", () => {
    const mask = codec.createMask();
    // shop/payment의 모든 권한 부여
    for (const type of DIMS.types) {
      for (const res of DIMS.resources) {
        for (const act of DIMS.actions) {
          codec.grantRaw(mask, "shop/payment", type, res, act);
        }
      }
    }
    // cms/auth의 일부만 부여
    codec.grantRaw(mask, "cms/auth", "api", "users/profile", "GET");

    const bitSet = codec.toBitMaskSet(mask);

    // service dim은 index 0, "shop/payment"의 1-based index는 1
    const shopPerms = bitSet.filterByDim(0, 1);
    expect(shopPerms).toHaveLength(3 * 4 * 4); // types × resources × actions = 48

    // cms/auth는 1-based index 2
    const cmsPerms = bitSet.filterByDim(0, 2);
    expect(cmsPerms).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  filterGrants — 차원 조건 필터
// ═════════════════════════════════════════════════════════════════════════════

describe("filterGrants — 차원 조건 필터", () => {
  const codec = createCodec();

  it("service 단일 조건", () => {
    const mask = codec.createMask();
    // 전체 부여
    for (let i = 0; i < codec.size; i++) {
      const { service, type, resource, action } = codec.decode(i);
      codec.grantRaw(mask, service, type, resource, action);
    }

    const results = codec.filterGrants(mask, { service: "shop/payment" });
    expect(results).toHaveLength(48); // 3 types × 4 resources × 4 actions
    for (const r of results) {
      expect(r.service).toBe("shop/payment");
    }
  });

  it("service + type 복합 조건", () => {
    const mask = codec.createMask();
    for (let i = 0; i < codec.size; i++) {
      const { service, type, resource, action } = codec.decode(i);
      codec.grantRaw(mask, service, type, resource, action);
    }

    const results = codec.filterGrants(mask, { service: "shop/payment", type: "api" });
    expect(results).toHaveLength(16); // 4 resources × 4 actions
    for (const r of results) {
      expect(r.service).toBe("shop/payment");
      expect(r.type).toBe("api");
    }
  });

  it("부분 부여에서 필터", () => {
    const mask = codec.createMask();
    codec.grantRaw(mask, "shop/payment", "api", "admin/teams", "GET");
    codec.grantRaw(mask, "shop/payment", "api", "admin/teams", "POST");
    codec.grantRaw(mask, "cms/auth", "api", "users/profile", "GET");

    // shop/payment만 필터
    const shopResults = codec.filterGrants(mask, { service: "shop/payment" });
    expect(shopResults).toHaveLength(2);

    // action=GET만 필터
    const getResults = codec.filterGrants(mask, { action: "GET" });
    expect(getResults).toHaveLength(2); // shop GET + cms GET

    // shop/payment + GET
    const shopGet = codec.filterGrants(mask, { service: "shop/payment", action: "GET" });
    expect(shopGet).toHaveLength(1);
    expect(shopGet[0].resource).toBe("admin/teams");
  });

  it("조건 없음 → listGrantsDecoded와 동일", () => {
    const mask = codec.createMask();
    codec.grantRaw(mask, "shop/payment", "api", "admin/teams", "GET");
    codec.grantRaw(mask, "cms/auth", "page", "dashboard", "DELETE");

    const all = codec.filterGrants(mask, {});
    const list = codec.listGrantsDecoded(mask);

    expect(all).toHaveLength(list.length);
    // 같은 주소 집합
    const allAddrs = new Set(all.map(d => d.address));
    const listAddrs = new Set(list.map(d => d.address));
    expect(allAddrs).toEqual(listAddrs);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  PermissionView — 캐시 레이어
// ═════════════════════════════════════════════════════════════════════════════

describe("PermissionView — 캐시된 필터 뷰", () => {
  const codec = createCodec();
  const mask = codec.createMask();

  // shop/payment의 api 전체 + cms/auth의 page 일부
  for (const res of DIMS.resources) {
    for (const act of DIMS.actions) {
      codec.grantRaw(mask, "shop/payment", "api", res, act);
    }
  }
  codec.grantRaw(mask, "cms/auth", "page", "dashboard", "GET");
  codec.grantRaw(mask, "cms/auth", "page", "users/profile", "POST");

  const view = codec.createView(mask);

  it("size = 부여된 수", () => {
    expect(view.size).toBe(4 * 4 + 2); // 16 + 2 = 18
  });

  it("check — O(1) 확인", () => {
    expect(view.check("shop/payment", "api", "admin/teams", "GET")).toBe(true);
    expect(view.check("shop/payment", "api", "admin/teams", "DELETE")).toBe(true);
    expect(view.check("cms/auth", "page", "dashboard", "GET")).toBe(true);
    expect(view.check("cms/auth", "page", "dashboard", "POST")).toBe(false);
    expect(view.check("analytics/event", "action", "dashboard", "GET")).toBe(false);
  });

  it("filterByService", () => {
    const shop = view.filterByService("shop/payment");
    expect(shop).toHaveLength(16);
    for (const r of shop) expect(r.service).toBe("shop/payment");

    const cms = view.filterByService("cms/auth");
    expect(cms).toHaveLength(2);
  });

  it("filterByType", () => {
    const api = view.filterByType("api");
    expect(api).toHaveLength(16);

    const page = view.filterByType("page");
    expect(page).toHaveLength(2);

    const action = view.filterByType("action");
    expect(action).toHaveLength(0);
  });

  it("filterByAction", () => {
    const gets = view.filterByAction("GET");
    // shop 4 resources × GET + cms 1 dashboard GET = 5
    expect(gets).toHaveLength(5);
  });

  it("filter — 복합 조건", () => {
    const results = view.filter({ service: "shop/payment", type: "api", action: "GET" });
    expect(results).toHaveLength(4); // 4 resources
    for (const r of results) {
      expect(r.service).toBe("shop/payment");
      expect(r.type).toBe("api");
      expect(r.action).toBe("GET");
    }
  });

  it("filter({}) → listAll과 동일", () => {
    const all = view.filter({});
    const listAll = view.listAll();
    expect(all).toHaveLength(listAll.length);
  });

  it("distinctServices", () => {
    expect(view.distinctServices().sort()).toEqual(["cms/auth", "shop/payment"]);
  });

  it("distinctTypes", () => {
    expect(view.distinctTypes().sort()).toEqual(["api", "page"]);
  });

  it("distinctActions", () => {
    expect(view.distinctActions().sort()).toEqual(["DELETE", "GET", "POST", "PUT"]);
  });

  it("distinctResources", () => {
    const resources = view.distinctResources().sort();
    expect(resources).toContain("admin/teams");
    expect(resources).toContain("dashboard");
    expect(resources).toContain("users/profile");
  });

  it("filterGrants 결과와 동일 (정합성)", () => {
    const fromFilter = codec.filterGrants(mask, { service: "shop/payment" });
    const fromView = view.filterByService("shop/payment");

    const filterAddrs = new Set(fromFilter.map(d => d.address));
    const viewAddrs = new Set(fromView.map(d => d.address));
    expect(filterAddrs).toEqual(viewAddrs);
  });
});
