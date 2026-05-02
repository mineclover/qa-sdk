// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * permission-view-cache.test.ts — PermissionViewCache 시나리오 검증
 *
 * ── 시나리오 ──────────────────────────────────────────────────────────────
 *
 * S1. 캐시 기본 동작 — miss → loadMask → hit → 즉시 반환
 * S2. 점진적 패치 — grant/revoke 1건 → 재생성 없이 반영
 * S3. 무효화 — 키/차원/전체 3단계
 * S4. Singleflight — 동시 요청 시 loadMask 1회
 * S5. LRU — maxSize 초과 시 오래된 항목 제거
 * S6. 고트래픽 시뮬레이션 — 100 유저 × 100 요청 + 중간 권한 변경
 */

import { describe, it, expect, vi } from "vitest";
import { PermissionCodec } from "./permission-codec.js";
import { PermissionViewCache } from "./permission-view-cache.js";

// ── 공통 픽스처 ──────────────────────────────────────────────────────────────

const DIMS = {
  services:  ["shop/payment", "cms/auth", "analytics/event"],
  types:     ["api", "page", "action"],
  resources: ["admin/teams", "billing/invoices", "users/profile", "dashboard"],
  actions:   ["GET", "POST", "PUT", "DELETE"],
};

function createCodec() {
  return new PermissionCodec("v1", DIMS);
}

/** 테스트용 mask 생성기. 지정된 권한만 부여. */
function buildMask(
  codec: PermissionCodec,
  grants: [string, string, string, string][],
): Uint8Array {
  const mask = codec.createMask();
  for (const [svc, type, res, act] of grants) {
    codec.grantRaw(mask, svc, type, res, act);
  }
  return mask;
}

// ═════════════════════════════════════════════════════════════════════════════
//  S1. 캐시 기본 동작
// ═════════════════════════════════════════════════════════════════════════════

describe("S1. 캐시 기본 동작", () => {
  it("miss → loadMask → createView → hit → 즉시 반환", async () => {
    const codec = createCodec();
    const mask = buildMask(codec, [
      ["shop/payment", "api", "admin/teams", "GET"],
    ]);

    const loadMask = vi.fn().mockResolvedValue(mask);
    const cache = new PermissionViewCache({ codec, loadMask });

    // miss
    const view1 = await cache.get("user-1");
    expect(loadMask).toHaveBeenCalledTimes(1);
    expect(view1.check("shop/payment", "api", "admin/teams", "GET")).toBe(true);

    // hit — loadMask 재호출 없음
    const view2 = await cache.get("user-1");
    expect(loadMask).toHaveBeenCalledTimes(1);
    expect(view2).toBe(view1); // 같은 인스턴스

    expect(cache.stats.hits).toBe(1);
    expect(cache.stats.misses).toBe(1);
  });

  it("peek — 비동기 로드 없이 동기 확인", async () => {
    const codec = createCodec();
    const mask = buildMask(codec, [["shop/payment", "api", "admin/teams", "GET"]]);
    const cache = new PermissionViewCache({ codec, loadMask: async () => mask });

    expect(cache.peek("user-1")).toBeUndefined();
    await cache.get("user-1");
    expect(cache.peek("user-1")).toBeDefined();
  });

  it("다른 키 → 독립 로드", async () => {
    const codec = createCodec();
    const loadMask = vi.fn().mockResolvedValue(codec.createMask());
    const cache = new PermissionViewCache({ codec, loadMask });

    await cache.get("user-1");
    await cache.get("user-2");
    expect(loadMask).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  S2. 점진적 패치
// ═════════════════════════════════════════════════════════════════════════════

describe("S2. 점진적 패치", () => {
  it("applyGrant → check 즉시 반영 (재생성 없음)", async () => {
    const codec = createCodec();
    const mask = buildMask(codec, [
      ["shop/payment", "api", "admin/teams", "GET"],
    ]);
    const cache = new PermissionViewCache({ codec, loadMask: async () => mask });

    const view = await cache.get("user-1");
    expect(view.check("shop/payment", "api", "admin/teams", "POST")).toBe(false);

    // 패치
    cache.applyGrant("user-1", "shop/payment", "api", "admin/teams", "POST");

    // 재생성 없이 반영
    expect(view.check("shop/payment", "api", "admin/teams", "POST")).toBe(true);
    expect(view.size).toBe(2);
    expect(cache.stats.patches).toBe(1);
  });

  it("applyRevoke → check 즉시 반영", async () => {
    const codec = createCodec();
    const mask = buildMask(codec, [
      ["shop/payment", "api", "admin/teams", "GET"],
      ["shop/payment", "api", "admin/teams", "POST"],
    ]);
    const cache = new PermissionViewCache({ codec, loadMask: async () => mask });

    const view = await cache.get("user-1");
    expect(view.size).toBe(2);

    cache.applyRevoke("user-1", "shop/payment", "api", "admin/teams", "POST");
    expect(view.check("shop/payment", "api", "admin/teams", "POST")).toBe(false);
    expect(view.size).toBe(1);
  });

  it("캐시에 없는 키 → false 반환", async () => {
    const codec = createCodec();
    const cache = new PermissionViewCache({ codec, loadMask: async () => codec.createMask() });

    expect(cache.applyGrant("unknown", "shop/payment", "api", "admin/teams", "GET")).toBe(false);
  });

  it("패치 후 filter 결과도 정확", async () => {
    const codec = createCodec();
    const mask = buildMask(codec, [
      ["shop/payment", "api", "admin/teams", "GET"],
    ]);
    const cache = new PermissionViewCache({ codec, loadMask: async () => mask });

    const view = await cache.get("user-1");
    cache.applyGrant("user-1", "cms/auth", "page", "dashboard", "GET");

    // filter로 확인
    const services = view.distinctServices();
    expect(services.toSorted()).toEqual(["cms/auth", "shop/payment"]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  S3. 무효화
// ═════════════════════════════════════════════════════════════════════════════

describe("S3. 무효화", () => {
  it("invalidate(key) → 다음 get에서 loadMask 재호출", async () => {
    const codec = createCodec();
    const loadMask = vi.fn().mockResolvedValue(codec.createMask());
    const cache = new PermissionViewCache({ codec, loadMask });

    await cache.get("user-1");
    expect(loadMask).toHaveBeenCalledTimes(1);

    cache.invalidate("user-1");
    expect(cache.size).toBe(0);

    await cache.get("user-1");
    expect(loadMask).toHaveBeenCalledTimes(2); // 재호출
  });

  it("invalidateAll()", async () => {
    const codec = createCodec();
    const cache = new PermissionViewCache({ codec, loadMask: async () => codec.createMask() });

    await cache.get("user-1");
    await cache.get("user-2");
    await cache.get("user-3");
    expect(cache.size).toBe(3);

    const count = cache.invalidateAll();
    expect(count).toBe(3);
    expect(cache.size).toBe(0);
  });

  it("invalidateByDim — 특정 resource 가진 view만 폐기", async () => {
    const codec = createCodec();

    // user-1: admin/teams 권한 있음
    const mask1 = buildMask(codec, [["shop/payment", "api", "admin/teams", "GET"]]);
    // user-2: dashboard 권한만
    const mask2 = buildMask(codec, [["cms/auth", "page", "dashboard", "GET"]]);

    let callCount = 0;
    const loadMask = vi.fn().mockImplementation(async (key: string) => {
      callCount++;
      return key === "user-1" ? mask1 : mask2;
    });

    const cache = new PermissionViewCache({ codec, loadMask });
    await cache.get("user-1");
    await cache.get("user-2");

    // admin/teams 리소스 변경 → user-1만 무효화
    const invalidated = cache.invalidateByDim("resource", "admin/teams");
    expect(invalidated).toEqual(["user-1"]);
    expect(cache.size).toBe(1); // user-2만 남음

    expect(cache.peek("user-1")).toBeUndefined();
    expect(cache.peek("user-2")).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  S4. Singleflight
// ═════════════════════════════════════════════════════════════════════════════

describe("S4. Singleflight", () => {
  it("동시 get(same key) → loadMask 1회만", async () => {
    const codec = createCodec();
    let loadCount = 0;
    const loadMask = vi.fn().mockImplementation(async () => {
      loadCount++;
      // 약간의 지연 시뮬레이션
      await new Promise(r => setTimeout(r, 10));
      return codec.createMask();
    });

    const cache = new PermissionViewCache({ codec, loadMask });

    // 동시 3개 요청
    const [v1, v2, v3] = await Promise.all([
      cache.get("user-1"),
      cache.get("user-1"),
      cache.get("user-1"),
    ]);

    expect(loadMask).toHaveBeenCalledTimes(1);
    expect(v1).toBe(v3); // 모두 같은 인스턴스
  });

  it("동시 get(different keys) → 각각 독립", async () => {
    const codec = createCodec();
    const loadMask = vi.fn().mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 5));
      return codec.createMask();
    });

    const cache = new PermissionViewCache({ codec, loadMask });
    await Promise.all([cache.get("a"), cache.get("b"), cache.get("c")]);
    expect(loadMask).toHaveBeenCalledTimes(3);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  S5. LRU
// ═════════════════════════════════════════════════════════════════════════════

describe("S5. LRU 캐시 크기 제한", () => {
  it("maxSize 초과 → 오래된 항목 제거", async () => {
    const codec = createCodec();
    const cache = new PermissionViewCache({
      codec,
      loadMask: async () => codec.createMask(),
      maxSize: 3,
    });

    await cache.get("a");
    await cache.get("b");
    await cache.get("c");
    expect(cache.size).toBe(3);

    // d 추가 → a(가장 오래된) 제거
    await cache.get("d");
    expect(cache.size).toBe(3);
    expect(cache.peek("a")).toBeUndefined(); // 제거됨
    expect(cache.peek("d")).toBeDefined();
  });

  it("접근한 항목은 LRU에서 연장", async () => {
    const codec = createCodec();
    const cache = new PermissionViewCache({
      codec,
      loadMask: async () => codec.createMask(),
      maxSize: 3,
    });

    await cache.get("a");
    await cache.get("b");
    await cache.get("c");

    // a를 다시 접근 → LRU 갱신
    await cache.get("a");

    // d 추가 → b(가장 오래된) 제거 (a는 방금 접근해서 생존)
    await cache.get("d");
    expect(cache.peek("a")).toBeDefined();
    expect(cache.peek("b")).toBeUndefined(); // b 제거됨
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  S6. 고트래픽 시뮬레이션
// ═════════════════════════════════════════════════════════════════════════════

describe("S6. 고트래픽 시뮬레이션", () => {
  it("100 유저 × 100 요청 + 중간 권한 변경 → 정확성 + 성능", async () => {
    const codec = createCodec();
    const NUM_USERS = 100;
    const REQUESTS_PER_USER = 100;

    // 각 유저별 mask 생성 (유저 i는 i번째 resource에 GET 권한)
    const masks = new Map<string, Uint8Array>();
    for (let i = 0; i < NUM_USERS; i++) {
      const resIdx = i % DIMS.resources.length;
      masks.set(`user-${i}`, buildMask(codec, [
        ["shop/payment", "api", DIMS.resources[resIdx], "GET"],
      ]));
    }

    const cache = new PermissionViewCache({
      codec,
      loadMask: async (key) => masks.get(key) ?? codec.createMask(),
      maxSize: 200,
    });

    // Phase 1: 대량 읽기
    const start = performance.now();
    const promises: Promise<boolean>[] = [];

    for (let req = 0; req < REQUESTS_PER_USER; req++) {
      for (let u = 0; u < NUM_USERS; u++) {
        const userId = `user-${u}`;
        const resIdx = u % DIMS.resources.length;
        promises.push(
          cache.get(userId).then(view =>
            view.check("shop/payment", "api", DIMS.resources[resIdx], "GET")
          )
        );
      }
    }

    const results = await Promise.all(promises);
    const readMs = performance.now() - start;

    // 모든 check가 true
    expect(results.every(r => r === true)).toBe(true);

    // Phase 2: 중간 권한 변경 (10 유저의 POST 추가)
    for (let u = 0; u < 10; u++) {
      const resIdx = u % DIMS.resources.length;
      cache.applyGrant(`user-${u}`, "shop/payment", "api", DIMS.resources[resIdx], "POST");
    }

    // Phase 3: 변경 후 확인
    for (let u = 0; u < 10; u++) {
      const view = await cache.get(`user-${u}`);
      const resIdx = u % DIMS.resources.length;
      expect(view.check("shop/payment", "api", DIMS.resources[resIdx], "POST")).toBe(true);
      expect(view.check("shop/payment", "api", DIMS.resources[resIdx], "GET")).toBe(true);
    }

    // 변경되지 않은 유저는 POST 없음
    const view50 = await cache.get("user-50");
    const res50 = DIMS.resources[50 % DIMS.resources.length];
    expect(view50.check("shop/payment", "api", res50, "POST")).toBe(false);

    const stats = cache.stats;
    console.log(`\n=== S6 고트래픽 시뮬레이션 ===`);
    console.log(`유저: ${NUM_USERS}, 요청: ${NUM_USERS * REQUESTS_PER_USER}`);
    console.log(`총 소요: ${readMs.toFixed(1)}ms`);
    console.log(`cache hits: ${stats.hits}, misses: ${stats.misses}`);
    console.log(`hitRate: ${(stats.hitRate * 100).toFixed(1)}%`);
    console.log(`patches: ${stats.patches}`);
    console.log(`ops/s: ${Math.round(NUM_USERS * REQUESTS_PER_USER / readMs * 1000).toLocaleString()}`);
  });
});
