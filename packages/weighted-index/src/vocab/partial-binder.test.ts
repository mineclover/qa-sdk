// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * partial-binder.test.ts — 차원 부분 바인딩 테스트.
 *
 * 시나리오: G-SHOP 마이크로서비스 환경에서
 * SDK가 서비스 컨텍스트(namespace/name/env/device)를 부트 시 고정하고,
 * 런타임에 리전/샤드/리소스/액션만 받아 주소를 계산한다.
 */

import { describe, it, expect } from "vitest";
import { createLabelRegistry } from "./label-registry.js";
import { PrefixCodec } from "./prefix-registry.js";
import { createBinder } from "./partial-binder.js";

// ── 공통 설정 ────────────────────────────────────────────────────────────────

const labels = createLabelRegistry({
  namespace: [{ version: "v1", ids: ["shop", "cms", "infra"] }],
  name:      [{ version: "v1", ids: ["payment", "auth", "gateway", "portal", "monitor"] }],
  env:       [{ version: "v1", ids: ["dev", "stage", "prod"] }],
  device:    [{ version: "v1", ids: ["web", "mobile"] }],
  region:    [{ version: "v1", ids: ["asia", "us-east", "eu-west"] }],
  shard:     [{ version: "v1", ids: ["s0", "s1", "s2", "s3"] }],
  resource:  [{ version: "v1", ids: ["products", "orders", "payments", "users", "config"] }],
  action:    [{ version: "v1", ids: ["GET", "POST", "PUT", "DELETE"] }],
});

const codec = new PrefixCodec(labels, {
  svc:  { labels: ["namespace", "name"],
          versions: [{ version: "v1", labelVersions: { namespace: "v1", name: "v1" } }] },
  loc:  { labels: ["region", "shard"],
          versions: [{ version: "v1", labelVersions: { region: "v1", shard: "v1" } }] },
  perm: { labels: ["resource", "action"],
          versions: [{ version: "v1", labelVersions: { resource: "v1", action: "v1" } }] },
  full: { labels: ["namespace", "name", "env", "device", "region", "shard", "resource", "action"],
          versions: [{ version: "v1", labelVersions: {
            namespace: "v1", name: "v1", env: "v1", device: "v1",
            region: "v1", shard: "v1", resource: "v1", action: "v1",
          } }],
  },
});

// ═══════════════════════════════════════════════════════════════════════════
//  1. 기본 bind → resolve
// ═══════════════════════════════════════════════════════════════════════════

describe("createBinder 기본", () => {
  it("고정 라벨 + 자유 라벨 분리", () => {
    const binder = createBinder(codec, "full", {
      namespace: "shop", name: "payment",
    });

    expect(binder.bound).toEqual({ namespace: "shop", name: "payment" });
    expect(binder.free).toEqual(["env", "device", "region", "shard", "resource", "action"]);
    expect(binder.prefix).toBe("full");
  });

  it("resolve = encodeFromIds와 동일 결과", () => {
    const binder = createBinder(codec, "full", {
      namespace: "shop", name: "payment", env: "prod", device: "web",
    });

    const vi = binder.resolve({
      region: "asia", shard: "s2", resource: "orders", action: "GET",
    });

    const direct = codec.encodeFromIds("full", {
      namespace: "shop", name: "payment", env: "prod", device: "web",
      region: "asia", shard: "s2", resource: "orders", action: "GET",
    });

    expect(vi.id).toBe(direct.id);
    expect(vi.prefix).toBe("full");
    expect(vi.v).toBe("v1");
  });

  it("resolveId = resolve().id", () => {
    const binder = createBinder(codec, "full", {
      namespace: "shop", name: "payment", env: "prod", device: "web",
    });

    const id = binder.resolveId({
      region: "asia", shard: "s2", resource: "orders", action: "GET",
    });
    const vi = binder.resolve({
      region: "asia", shard: "s2", resource: "orders", action: "GET",
    });
    expect(id).toBe(vi.id);
  });

  it("자유 라벨 누락 시 throw", () => {
    const binder = createBinder(codec, "full", {
      namespace: "shop", name: "payment", env: "prod", device: "web",
    });

    expect(() => binder.resolve({ region: "asia" })).toThrow("Missing label");
  });

  it("알 수 없는 고정 라벨 → throw", () => {
    expect(() => createBinder(codec, "full", { unknown: "x" })).toThrow("Unknown label");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  2. 체이닝: 점진적 바인딩
// ═══════════════════════════════════════════════════════════════════════════

describe("체이닝 bind", () => {
  it("2단계 바인딩 → 동일 결과", () => {
    const step1 = createBinder(codec, "full", {
      namespace: "shop", name: "payment",
    });
    expect(step1.free).toEqual(["env", "device", "region", "shard", "resource", "action"]);

    const step2 = step1.bind({ env: "prod", device: "web" });
    expect(step2.free).toEqual(["region", "shard", "resource", "action"]);

    const id = step2.resolveId({
      region: "asia", shard: "s2", resource: "orders", action: "GET",
    });

    const direct = codec.encodeFromIds("full", {
      namespace: "shop", name: "payment", env: "prod", device: "web",
      region: "asia", shard: "s2", resource: "orders", action: "GET",
    });
    expect(id).toBe(direct.id);
  });

  it("3단계 바인딩", () => {
    const step1 = createBinder(codec, "full", { namespace: "shop", name: "payment" });
    const step2 = step1.bind({ env: "prod", device: "web" });
    const step3 = step2.bind({ region: "asia", shard: "s2" });

    expect(step3.free).toEqual(["resource", "action"]);

    const id = step3.resolveId({ resource: "config", action: "DELETE" });

    const direct = codec.encodeFromIds("full", {
      namespace: "shop", name: "payment", env: "prod", device: "web",
      region: "asia", shard: "s2", resource: "config", action: "DELETE",
    });
    expect(id).toBe(direct.id);
  });

  it("전체 바인딩 → free 없음 → resolve({})로 확정", () => {
    const full = createBinder(codec, "full", {
      namespace: "shop", name: "payment", env: "prod", device: "web",
      region: "asia", shard: "s2", resource: "orders", action: "GET",
    });
    expect(full.free).toEqual([]);
    expect(full.resolveId({})).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  3. 실전 시나리오: SDK 컨텍스트 패턴
// ═══════════════════════════════════════════════════════════════════════════

describe("시나리오: SDK 컨텍스트 패턴", () => {
  it("SDK 부트 → 서비스+환경 고정 → 런타임에 리소스/액션만", () => {
    const sdk = createBinder(codec, "full", {
      namespace: "shop", name: "payment", env: "prod", device: "web",
    });

    function checkPermission(region: string, shard: string, resource: string, action: string): number {
      return sdk.resolveId({ region, shard, resource, action });
    }

    const addr1 = checkPermission("asia", "s0", "products", "GET");
    const addr2 = checkPermission("asia", "s0", "products", "POST");
    const addr3 = checkPermission("us-east", "s1", "payments", "DELETE");

    expect(addr1).not.toBe(addr2);
    expect(addr2).not.toBe(addr3);
    expect(checkPermission("asia", "s0", "products", "GET")).toBe(addr1);

    const decoded = codec.decodeToIds({ prefix: "full", v: "v1", id: addr3 });
    expect(decoded.namespace).toBe("shop");
    expect(decoded.name).toBe("payment");
    expect(decoded.env).toBe("prod");
    expect(decoded.region).toBe("us-east");
    expect(decoded.resource).toBe("payments");
    expect(decoded.action).toBe("DELETE");
  });

  it("멀티 서비스: 같은 codec, 다른 binder", () => {
    const paymentSDK = createBinder(codec, "full", {
      namespace: "shop", name: "payment", env: "prod", device: "web",
    });
    const authSDK = createBinder(codec, "full", {
      namespace: "shop", name: "auth", env: "prod", device: "web",
    });

    const remaining = { region: "asia", shard: "s0", resource: "users", action: "GET" };
    expect(paymentSDK.resolveId(remaining)).not.toBe(authSDK.resolveId(remaining));
  });

  it("prefix별 binder: svc, loc, perm 독립 사용", () => {
    const svcBinder = createBinder(codec, "svc", { namespace: "shop" });
    expect(svcBinder.free).toEqual(["name"]);
    expect(svcBinder.resolveId({ name: "payment" }))
      .toBe(codec.encodeFromIds("svc", { namespace: "shop", name: "payment" }).id);

    const permBinder = createBinder(codec, "perm", { resource: "orders" });
    expect(permBinder.free).toEqual(["action"]);
    expect(permBinder.resolveId({ action: "POST" }))
      .toBe(codec.encodeFromIds("perm", { resource: "orders", action: "POST" }).id);
  });
});
