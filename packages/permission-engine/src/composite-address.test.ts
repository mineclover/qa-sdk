/**
 * composite-address.test.ts — 차원 그룹 압축 + 부분 바인딩 검증.
 *
 * 전체 경로:
 *   namespace > name > env > device > region > shard > id > action
 *
 * 그룹 A (서비스 ref):  [namespace, name]          → svc:v1:N
 * 그룹 B (디바이스):     [device]                   → 단일 차원 (1-based)
 * 그룹 C (로케이션):     [region, shard]            → loc:v1:N
 * 그룹 D (퍼미션):       [id, action]               → perm:v1:N
 *
 * 최종 조합:
 *   [svc(N), device(M), loc(N), perm(N)]  → 하나의 통합 주소
 *
 * 핵심: prefix별 axis spec이 있으면
 *   - 부분 좌표 [1,2,*,5,*,*,*,*] 상태에서 prefix 값으로 * 을 채움
 *   - partialQueryBase로 고정 부분 미리 계산
 *   - 나머지 차원만 런타임에 resolve → 최종 주소 O(1)
 */

import { describe, it, expect } from "vitest";
import {
  WeightedIndex,
  calcWeights,
  partialQueryBase,
  calcAddressRanges,
  expandRanges,
  containsAddress,
  createLabelRegistry,
  PrefixCodec,
} from "weighted-index";

// ═══════════════════════════════════════════════════════════════════════════
//  1. 기본 검증: partialQueryBase로 부분 바인딩
// ═══════════════════════════════════════════════════════════════════════════

describe("부분 바인딩: partialQueryBase", () => {
  // namespace(3) > name(5) > env(4) > device(2) > region(3) > shard(4) > id(100) > action(6)
  const shape = [3, 5, 4, 2, 3, 4, 100, 6];
  const wi = new WeightedIndex(shape);
  const weights = calcWeights(shape);

  it("전체 좌표 encode = partialQueryBase 전부 고정과 동일", () => {
    const coords = [1, 3, 2, 1, 2, 3, 42, 4] as const;
    const full = wi.encode([...coords]);
    const partial = partialQueryBase(weights, [...coords]);
    expect(full).toBe(partial);
  });

  it("앞 4개 고정 [1,2,*,1] → base + 나머지 계산", () => {
    // namespace=1, name=2, env=*(free), device=1
    const fixed: (number | null)[] = [1, 2, null, 1, null, null, null, null];
    const base = partialQueryBase(weights, fixed);

    // env=3, region=1, shard=2, id=50, action=3 으로 나머지 채움
    const remaining: (number | null)[] = [null, null, 3, null, 1, 2, 50, 3];
    const rest = partialQueryBase(weights, remaining);

    const total = base + rest;
    const direct = wi.encode([1, 2, 3, 1, 1, 2, 50, 3]);
    expect(total).toBe(direct);
  });

  it("prefix 고정 + suffix 고정 = 전체 주소", () => {
    // 서비스 ref 고정: namespace=2, name=4
    const svcBase = partialQueryBase(weights, [2, 4, null, null, null, null, null, null]);

    // 디바이스 고정: device=2
    const deviceBase = partialQueryBase(weights, [null, null, null, 2, null, null, null, null]);

    // 로케이션 고정: region=3, shard=1
    const locBase = partialQueryBase(weights, [null, null, null, null, 3, 1, null, null]);

    // 퍼미션: id=10, action=5
    const permBase = partialQueryBase(weights, [null, null, null, null, null, null, 10, 5]);

    // env는 SDK가 주입: env=2
    const envBase = partialQueryBase(weights, [null, null, 2, null, null, null, null, null]);

    const composed = svcBase + deviceBase + locBase + permBase + envBase;
    const direct = wi.encode([2, 4, 2, 2, 3, 1, 10, 5]);
    expect(composed).toBe(direct);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  2. 그룹별 prefix 인코딩 + 조합
// ═══════════════════════════════════════════════════════════════════════════

describe("차원 그룹별 prefix 압축 + 통합", () => {
  // ── 그룹별 독립 인코딩 ──
  const svcIndex = new WeightedIndex([3, 5]);        // namespace × name
  const locIndex = new WeightedIndex([3, 4]);         // region × shard
  const permIndex = new WeightedIndex([100, 6]);      // id × action

  // ── 통합 인덱스: [svc, device, loc, perm] ──
  // 각 그룹의 결과를 하나의 통합 차원으로 취급
  const compositeIndex = new WeightedIndex([
    svcIndex.size,    // 15
    2,                // device (단일 차원)
    locIndex.size,    // 12
    permIndex.size,   // 600
  ]);

  it("각 그룹 독립 인코딩", () => {
    const svc = svcIndex.encode([2, 4]);     // namespace=2, name=4
    const loc = locIndex.encode([3, 1]);     // region=3, shard=1
    const perm = permIndex.encode([10, 5]);  // id=10, action=5

    expect(svc).toBeGreaterThanOrEqual(0);
    expect(svc).toBeLessThan(15);
    expect(loc).toBeLessThan(12);
    expect(perm).toBeLessThan(600);
  });

  it("그룹 결과 → 통합 인덱스 → 단일 주소", () => {
    const svc = svcIndex.encode([2, 4]);
    const device = 2;  // 1-based
    const loc = locIndex.encode([3, 1]);
    const perm = permIndex.encode([10, 5]);

    // 통합: 각 그룹 결과를 1-based 좌표로 변환 (+1)
    const finalAddr = compositeIndex.encode([svc + 1, device, loc + 1, perm + 1]);

    // 역방향 디코딩
    const [svcIdx, deviceIdx, locIdx, permIdx] = compositeIndex.decode(finalAddr);
    expect(svcIndex.decode(svcIdx - 1)).toEqual([2, 4]);
    expect(deviceIdx).toBe(2);
    expect(locIndex.decode(locIdx - 1)).toEqual([3, 1]);
    expect(permIndex.decode(permIdx - 1)).toEqual([10, 5]);
  });

  it("통합 주소 크기", () => {
    // 15 × 2 × 12 × 600 = 216,000 slots
    expect(compositeIndex.size).toBe(216_000);
    // bitmask: 216000 / 8 = 27,000 bytes = 27KB
    // 실제로는 sparse하므로 entry_flag 패턴이 적합
  });

  it("부분 바인딩: svc+device 고정 → loc+perm 와일드카드", () => {
    const svc = svcIndex.encode([2, 4]);
    const device = 2;

    // svc+device 고정, loc+perm = 전체
    const ranges = calcAddressRanges(
      [...compositeIndex.shape],
      [`${svc + 1}`, `${device}`, null, null],
    );

    // loc(12) × perm(600) = 7,200개 주소가 매칭
    const expanded = expandRanges(ranges);
    expect(expanded.length).toBe(12 * 600);

    // 특정 주소가 범위 안에 있는지 확인
    const loc = locIndex.encode([1, 1]);
    const perm = permIndex.encode([1, 1]);
    const target = compositeIndex.encode([svc + 1, device, loc + 1, perm + 1]);
    expect(containsAddress(target, ranges)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  3. PrefixCodec으로 라벨 기반 조합
// ═══════════════════════════════════════════════════════════════════════════

describe("PrefixCodec 기반 다단계 인코딩", () => {
  const labels = createLabelRegistry({
    namespace: [{ version: "v1", ids: ["shop", "cms", "infra"] }],
    name:      [{ version: "v1", ids: ["payment", "auth", "gateway", "portal", "monitor"] }],
    env:       [{ version: "v1", ids: ["dev", "stage", "prod", "test"] }],
    device:    [{ version: "v1", ids: ["web", "mobile"] }],
    region:    [{ version: "v1", ids: ["asia", "us-east", "eu-west"] }],
    shard:     [{ version: "v1", ids: ["s0", "s1", "s2", "s3"] }],
    resource:  [{ version: "v1", ids: Array.from({ length: 20 }, (_, i) => `res-${i}`) }],
    action:    [{ version: "v1", ids: ["GET", "POST", "PUT", "DELETE", "view", "edit"] }],
  });

  const codec = new PrefixCodec(labels, {
    svc:  { labels: ["namespace", "name"], versions: [{ version: "v1", labelVersions: { namespace: "v1", name: "v1" } }] },
    loc:  { labels: ["region", "shard"],   versions: [{ version: "v1", labelVersions: { region: "v1", shard: "v1" } }] },
    perm: { labels: ["resource", "action"],versions: [{ version: "v1", labelVersions: { resource: "v1", action: "v1" } }] },
    full: { labels: ["namespace", "name", "env", "device", "region", "shard", "resource", "action"],
            versions: [{ version: "v1", labelVersions: {
              namespace: "v1", name: "v1", env: "v1", device: "v1",
              region: "v1", shard: "v1", resource: "v1", action: "v1",
            } }],
    },
  });

  it("개별 prefix 인코딩", () => {
    const svc = codec.encodeFromIds("svc", { namespace: "shop", name: "payment" });
    expect(svc.prefix).toBe("svc");
    expect(svc.id).toBeGreaterThanOrEqual(0);

    const loc = codec.encodeFromIds("loc", { region: "asia", shard: "s2" });
    expect(loc.prefix).toBe("loc");

    const perm = codec.encodeFromIds("perm", { resource: "res-5", action: "POST" });
    expect(perm.prefix).toBe("perm");
  });

  it("full prefix = 전체 경로 1D 압축", () => {
    const full = codec.encodeFromIds("full", {
      namespace: "shop", name: "payment",
      env: "prod", device: "web",
      region: "asia", shard: "s2",
      resource: "res-5", action: "POST",
    });

    // 디코딩
    const decoded = codec.decodeToIds(full);
    expect(decoded.namespace).toBe("shop");
    expect(decoded.name).toBe("payment");
    expect(decoded.env).toBe("prod");
    expect(decoded.device).toBe("web");
    expect(decoded.region).toBe("asia");
    expect(decoded.shard).toBe("s2");
    expect(decoded.resource).toBe("res-5");
    expect(decoded.action).toBe("POST");
  });

  it("full 주소 크기", () => {
    const shape = codec.getShape("full");
    // 3 × 5 × 4 × 2 × 3 × 4 × 20 × 6 = 172,800
    expect(shape.reduce((a, b) => a * b, 1)).toBe(172_800);
  });

  it("prefix 별 shape으로 axis spec 확인", () => {
    expect(codec.getShape("svc")).toEqual([3, 5]);
    expect(codec.getShape("loc")).toEqual([3, 4]);
    expect(codec.getShape("perm")).toEqual([20, 6]);
    expect(codec.getShape("full")).toEqual([3, 5, 4, 2, 3, 4, 20, 6]);
  });

  it("부분 바인딩: svc 고정 → full에서 범위 쿼리", () => {
    const fullShape = codec.getShape("full");
    const fullWi = codec.getIndex("full");

    // shop/payment, env=*, device=*, region=*, shard=*, resource=*, action=*
    const nsIdx = labels.getIndex("namespace", "v1", "shop");
    const nameIdx = labels.getIndex("name", "v1", "payment");

    const ranges = calcAddressRanges(fullShape, [
      `${nsIdx}`, `${nameIdx}`, null, null, null, null, null, null,
    ]);

    // 4 × 2 × 3 × 4 × 20 × 6 = 11,520 주소
    const count = expandRanges(ranges).length;
    expect(count).toBe(4 * 2 * 3 * 4 * 20 * 6);
  });

  it("SDK 패턴: env+device를 SDK가 주입 → 나머지만 사용자 입력", () => {
    const fullWi = codec.getIndex("full");
    const weights = calcWeights([...fullWi.shape]);

    // SDK가 부트 시 고정하는 컨텍스트
    const sdkContext = {
      namespace: "shop",
      name: "payment",
      env: "prod",
      device: "web",
    };
    const sdkBase = partialQueryBase(weights, [
      labels.getIndex("namespace", "v1", sdkContext.namespace),
      labels.getIndex("name", "v1", sdkContext.name),
      labels.getIndex("env", "v1", sdkContext.env),
      labels.getIndex("device", "v1", sdkContext.device),
      null, null, null, null,
    ]);

    // 런타임에 사용자가 입력하는 나머지
    const userInput = {
      region: "asia",
      shard: "s2",
      resource: "res-5",
      action: "POST",
    };
    const userPart = partialQueryBase(weights, [
      null, null, null, null,
      labels.getIndex("region", "v1", userInput.region),
      labels.getIndex("shard", "v1", userInput.shard),
      labels.getIndex("resource", "v1", userInput.resource),
      labels.getIndex("action", "v1", userInput.action),
    ]);

    // 합산 = 전체 주소
    const composed = sdkBase + userPart;

    // 직접 인코딩한 것과 동일한지
    const direct = codec.encodeFromIds("full", {
      ...sdkContext, ...userInput,
    });
    expect(composed).toBe(direct.id);
  });
});
