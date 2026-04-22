// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, vi } from "vitest";
import RedisMock from "ioredis-mock";
import type { Redis } from "ioredis";
import { BitmapCacheService } from "./cache-service.js";

function silentLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe("BitmapCacheService", () => {
  it("publisher만 활성화 — subscriber undefined", () => {
    const redis = new RedisMock() as unknown as Redis;
    const svc = new BitmapCacheService({
      publisherRedis: redis,
      publisherName: "p",
      cache: { max: 100 },
      logger: silentLogger(),
    });
    expect(svc.publisher).toBeDefined();
    expect(svc.subscriber).toBeUndefined();
  });

  it("subscriber만 활성화 — publisher undefined", async () => {
    const redis = new RedisMock() as unknown as Redis;
    const svc = new BitmapCacheService({
      subscriberRedis: (redis as RedisMock).duplicate() as unknown as Redis,
      publisherName: "s",
      cache: { max: 100 },
      logger: silentLogger(),
    });
    expect(svc.publisher).toBeUndefined();
    expect(svc.subscriber).toBeDefined();
    await svc.start();
    await svc.stop();
  });

  it("둘 다 활성화 — publish → subscribe 통합 round-trip", async () => {
    const pubRedis = new RedisMock() as unknown as Redis;
    const subRedis = (pubRedis as RedisMock).duplicate() as unknown as Redis;
    const svc = new BitmapCacheService({
      publisherRedis: pubRedis,
      subscriberRedis: subRedis,
      publisherName: "test",
      cache: { max: 100 },
      logger: silentLogger(),
    });
    svc.cache.set("u1", "sim.bitmap", "uv1", {
      prefix: "sim.bitmap",
      v: "uv1",
      mask: new Uint8Array([0x01]),
      issuedAt: "2026-04-22T00:00:00Z",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      issuer: "x",
      signature: "s",
    });
    await svc.start();
    await svc.publisher!.publishUserChange("u1", "permission_change");
    await new Promise((r) => setTimeout(r, 100));
    expect(svc.cache.get("u1", "sim.bitmap", "uv1")).toBeUndefined();
    await svc.stop();
  });
});
