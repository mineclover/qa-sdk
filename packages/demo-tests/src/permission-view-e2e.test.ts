/**
 * permission-view-e2e.test.ts — PermissionView + PermissionViewCache E2E 시나리오
 *
 * permission-engine 내부 단위 테스트에서 검증한 기능을 cross-package 시나리오로 재검증.
 * bit-index의 BitMaskSet/IndexBridge와 조합하여 실제 사용 패턴을 증명한다.
 *
 * ── 시나리오 ──────────────────────────────────────────────────────────────
 *
 * [PV-1] PermissionView: mask → createView → filter/check → 정확성
 * [PV-2] PermissionView 점진적 패치: applyGrant/applyRevoke 후 즉시 반영
 * [PV-3] PermissionViewCache: 캐시 hit/miss + 패치 + 무효화
 * [PV-4] mask API → base64ToUint8 → hasBit → PermissionView 통합 E2E
 * [PV-5] BitMaskSet ↔ PermissionView 교차: 같은 mask에서 동일 결과
 */

import { describe, it, expect, vi } from "vitest";
import {
  PermissionCodec,
  PermissionSet,
  PermissionView,
  PermissionViewCache,
} from "permission-engine";
import {
  hasBit,
  popcount,
  createMask,
  setBit,
} from "weighted-index";
import {
  BitMaskSet,
  BitIndex,
  IndexBridge,
  base64ToUint8,
} from "bit-index";
import {
  DEMO_FEATURES_V2,
  DEMO_ROLES_V2,
  DEMO_KO,
} from "demo-snapshot";

// ── 공통 코덱 ──────────────────────────────────────────────────────────────

const DIMS = {
  services:  DEMO_FEATURES_V2.map(f => f.id),
  types:     ["api", "page"],
  resources: ["default", "admin"],
  actions:   ["access", "manage"],
};

function createTestCodec() {
  return new PermissionCodec("v1", DIMS);
}

function buildTestMask(codec: PermissionCodec, grantedFeatures: string[]): Uint8Array {
  const mask = codec.createMask();
  for (const feat of grantedFeatures) {
    codec.grantRaw(mask, feat, "api", "default", "access");
  }
  return mask;
}

// ═════════════════════════════════════════════════════════════════════════════
//  [PV-1] PermissionView: filter/check 정확성
// ═════════════════════════════════════════════════════════════════════════════

describe("[PV-1] PermissionView — filter/check 정확성", () => {
  const codec = createTestCodec();
  // viewer: product_list + order_list만
  const viewerFeatures = DEMO_FEATURES_V2
    .filter(f => f.grantedRoles.includes("viewer"))
    .map(f => f.id);
  const mask = buildTestMask(codec, viewerFeatures);
  const view = codec.createView(mask);

  it("check: 부여된 feature → true, 미부여 → false", () => {
    for (const f of DEMO_FEATURES_V2) {
      const expected = f.grantedRoles.includes("viewer");
      expect(view.check(f.id, "api", "default", "access")).toBe(expected);
    }
  });

  it("filterByService: 부여된 것만 반환", () => {
    for (const feat of viewerFeatures) {
      const results = view.filterByService(feat);
      expect(results.length).toBeGreaterThan(0);
    }
  });

  it("size = 부여된 수", () => {
    expect(view.size).toBe(viewerFeatures.length);
  });

  it("distinctServices = 부여된 feature 목록", () => {
    expect(view.distinctServices().sort()).toEqual(viewerFeatures.sort());
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [PV-2] 점진적 패치
// ═════════════════════════════════════════════════════════════════════════════

describe("[PV-2] PermissionView 점진적 패치", () => {
  const codec = createTestCodec();
  const mask = buildTestMask(codec, ["product_list"]);
  const view = codec.createView(mask);

  it("applyGrant → 즉시 check 반영 (재생성 없음)", () => {
    expect(view.check("order_list", "api", "default", "access")).toBe(false);
    view.applyGrant("order_list", "api", "default", "access");
    expect(view.check("order_list", "api", "default", "access")).toBe(true);
    expect(view.size).toBe(2);
  });

  it("applyRevoke → 즉시 반영", () => {
    view.applyRevoke("product_list", "api", "default", "access");
    expect(view.check("product_list", "api", "default", "access")).toBe(false);
    expect(view.size).toBe(1);
  });

  it("패치 후 filter 결과도 정확", () => {
    expect(view.distinctServices()).toEqual(["order_list"]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [PV-3] PermissionViewCache
// ═════════════════════════════════════════════════════════════════════════════

describe("[PV-3] PermissionViewCache — 캐시 hit/miss + 패치 + 무효화", () => {
  const codec = createTestCodec();
  const adminMask = buildTestMask(codec, DEMO_FEATURES_V2.map(f => f.id));
  const viewerMask = buildTestMask(codec, ["product_list", "order_list"]);

  it("miss → load → hit → 즉시 반환", async () => {
    const loadMask = vi.fn().mockResolvedValue(adminMask);
    const cache = new PermissionViewCache({ codec, loadMask });

    const v1 = await cache.get("admin");
    expect(loadMask).toHaveBeenCalledTimes(1);
    expect(v1.size).toBe(DEMO_FEATURES_V2.length);

    const v2 = await cache.get("admin");
    expect(loadMask).toHaveBeenCalledTimes(1); // 재호출 없음
    expect(v2).toBe(v1);
  });

  it("applyGrant → 캐시된 view에 즉시 반영", async () => {
    const cache = new PermissionViewCache({
      codec,
      loadMask: async (key) => key === "viewer" ? viewerMask : adminMask,
    });

    const view = await cache.get("viewer");
    expect(view.check("payment_history", "api", "default", "access")).toBe(false);

    cache.applyGrant("viewer", "payment_history", "api", "default", "access");
    expect(view.check("payment_history", "api", "default", "access")).toBe(true);
  });

  it("invalidate → 다음 get에서 재로드", async () => {
    const loadMask = vi.fn().mockResolvedValue(adminMask);
    const cache = new PermissionViewCache({ codec, loadMask });

    await cache.get("user-1");
    cache.invalidate("user-1");
    await cache.get("user-1");
    expect(loadMask).toHaveBeenCalledTimes(2);
  });

  it("invalidateAll → 전체 폐기", async () => {
    const cache = new PermissionViewCache({
      codec,
      loadMask: async () => adminMask,
    });
    await cache.get("a");
    await cache.get("b");
    expect(cache.size).toBe(2);
    cache.invalidateAll();
    expect(cache.size).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [PV-4] mask Base64 → hasBit → PermissionView 통합
// ═════════════════════════════════════════════════════════════════════════════

describe("[PV-4] mask Base64 → hasBit → PermissionView 통합", () => {
  const codec = createTestCodec();
  const grantedFeats = ["product_list", "order_list", "payment_history"];
  const mask = buildTestMask(codec, grantedFeats);

  it("mask → hasBit으로 각 feature 비트 확인", () => {
    for (let i = 0; i < DIMS.services.length; i++) {
      const feat = DIMS.services[i];
      const addr = codec.encodeRaw(feat, "api", "default", "access");
      const expected = grantedFeats.includes(feat);
      expect(hasBit(mask, addr)).toBe(expected);
    }
  });

  it("hasBit 결과 == PermissionView.check 결과", () => {
    const view = codec.createView(mask);

    for (let i = 0; i < DIMS.services.length; i++) {
      const feat = DIMS.services[i];
      const bitResult = hasBit(mask, codec.encodeRaw(feat, "api", "default", "access"));
      const viewResult = view.check(feat, "api", "default", "access");
      expect(bitResult).toBe(viewResult);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [PV-5] BitMaskSet ↔ PermissionView 교차
// ═════════════════════════════════════════════════════════════════════════════

describe("[PV-5] BitMaskSet ↔ PermissionView — 같은 mask, 동일 결과", () => {
  const codec = createTestCodec();
  const grantedFeats = ["product_list", "payment_history", "config_change"];
  const mask = buildTestMask(codec, grantedFeats);

  it("toBitMaskSet → filterByLabel ≡ PermissionView.filter", () => {
    const bitSet = codec.toBitMaskSet(mask);
    const view = codec.createView(mask);

    // BitMaskSet 필터
    const bitFiltered = bitSet.filterByLabel("service", 1); // service dim, index 1 = product_list
    // PermissionView 필터
    const viewFiltered = view.filterByService("product_list");

    // 결과 수 동일
    expect(bitFiltered.length).toBe(viewFiltered.length);
  });

  it("check 결과 동일 (모든 feature)", () => {
    const bitSet = codec.toBitMaskSet(mask);
    const view = codec.createView(mask);

    for (const feat of DIMS.services) {
      const addr = codec.encodeRaw(feat, "api", "default", "access");
      const biPacked = codec.bridge.toBitUnsafe(addr);

      const bitResult = bitSet.checkPacked(biPacked);
      const viewResult = view.check(feat, "api", "default", "access");

      expect(bitResult).toBe(viewResult);
    }
  });
});
