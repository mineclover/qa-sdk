// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * 통합 테스트 — 실 Redis 인스턴스에서 publish ↔ subscribe e2e.
 *
 * 활성화 경로:
 *   - SIM_REDIS_URL 환경 변수 (sim-redis 컨테이너 사용)
 * 미설정 시 skip.
 */

import { describe, expect, it, vi } from "vitest";
import Redis from "ioredis";
import { BitmapCacheService } from "./cache-service.js";
import type { VersionedBitmap } from "permission-engine";

const SKIP = !process.env.SIM_REDIS_URL;

function silentLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const sampleBm = (id: string): VersionedBitmap => ({
  prefix: "sim.bitmap",
  v: "uv1",
  mask: new Uint8Array([0x01]),
  issuedAt: "2026-04-22T00:00:00Z",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  issuer: "x",
  signature: id,
});

describe.skipIf(SKIP)("sim-bitmap-cache integration — 실 Redis", () => {
  const redisUrl = process.env.SIM_REDIS_URL!;

  it(
    "publish → subscribe → cache flush (실 Redis)",
    async () => {
      const pubClient = new Redis(redisUrl);
      const subClient = new Redis(redisUrl);
      const pub = new BitmapCacheService({
        publisherRedis: pubClient,
        publisherName: "test",
        cache: { max: 100 },
        logger: silentLogger(),
      });
      const sub = new BitmapCacheService({
        subscriberRedis: subClient,
        publisherName: "test",
        cache: { max: 100 },
        logger: silentLogger(),
      });
      await sub.start();
      sub.cache.set("u1", "sim.bitmap", "uv1", sampleBm("a"));
      expect(sub.cache.get("u1", "sim.bitmap", "uv1")?.signature).toBe("a");
      await pub.publisher!.publishUserChange("u1", "permission_change");
      await new Promise((r) => setTimeout(r, 200));
      expect(sub.cache.get("u1", "sim.bitmap", "uv1")).toBeUndefined();
      await sub.stop();
      await pubClient.quit();
      await subClient.quit();
    },
    30_000,
  );

  it(
    "scope=role + affectedUserIds 통합 e2e",
    async () => {
      const pubClient = new Redis(redisUrl);
      const subClient = new Redis(redisUrl);
      const pub = new BitmapCacheService({
        publisherRedis: pubClient,
        publisherName: "test",
        cache: { max: 100 },
        logger: silentLogger(),
      });
      const sub = new BitmapCacheService({
        subscriberRedis: subClient,
        publisherName: "test",
        cache: { max: 100 },
        logger: silentLogger(),
      });
      await sub.start();
      for (const id of ["a", "b", "c"]) {
        sub.cache.set(id, "sim.bitmap", "uv1", sampleBm(id));
      }
      await pub.publisher!.publishRoleChange("role-x", "role_redefinition", [
        "a",
        "c",
      ]);
      await new Promise((r) => setTimeout(r, 200));
      expect(sub.cache.get("a", "sim.bitmap", "uv1")).toBeUndefined();
      expect(sub.cache.get("b", "sim.bitmap", "uv1")?.signature).toBe("b");
      expect(sub.cache.get("c", "sim.bitmap", "uv1")).toBeUndefined();
      await sub.stop();
      await pubClient.quit();
      await subClient.quit();
    },
    30_000,
  );
});
