// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, vi } from "vitest";
import RedisMock from "ioredis-mock";
import type { Redis } from "ioredis";
import { BitmapInvalidationSubscriber } from "./subscriber.js";
import { BitmapLruCache } from "./lru-cache.js";
import { INVALIDATION_CHANNEL, serializeMessage } from "./message.js";
import type { VersionedBitmap } from "permission-engine";

const sampleBm = (id: string): VersionedBitmap => ({
  prefix: "sim.bitmap",
  v: "uv1",
  mask: new Uint8Array([0x01]),
  issuedAt: "2026-04-22T00:00:00Z",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  issuer: "x",
  signature: id,
});

function silentLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe("BitmapInvalidationSubscriber", () => {
  it("scope=user 메시지 수신 → cache.invalidateUser 호출", async () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.set("user-1", "sim.bitmap", "uv1", sampleBm("a"));
    cache.set("user-2", "sim.bitmap", "uv1", sampleBm("b"));

    const redis = new RedisMock() as unknown as Redis;
    const sub = new BitmapInvalidationSubscriber({
      redis: (redis as RedisMock).duplicate() as unknown as Redis,
      cache,
      logger: silentLogger(),
    });
    await sub.start();

    await redis.publish(
      INVALIDATION_CHANNEL,
      serializeMessage({
        scope: "user",
        target: "user-1",
        reason: "permission_change",
        issuedAt: "2026-04-22T00:00:00.000Z",
        publisher: "test",
      }),
    );
    await new Promise((r) => setTimeout(r, 100));

    expect(cache.get("user-1", "sim.bitmap", "uv1")).toBeUndefined();
    expect(cache.get("user-2", "sim.bitmap", "uv1")?.signature).toBe("b");
    await sub.stop();
  });

  it("scope=role + affectedUserIds → invalidateUsers", async () => {
    const cache = new BitmapLruCache({ max: 100 });
    for (const id of ["u1", "u2", "u3", "u4"]) {
      cache.set(id, "sim.bitmap", "uv1", sampleBm(id));
    }
    const redis = new RedisMock() as unknown as Redis;
    const sub = new BitmapInvalidationSubscriber({
      redis: (redis as RedisMock).duplicate() as unknown as Redis,
      cache,
      logger: silentLogger(),
    });
    await sub.start();

    await redis.publish(
      INVALIDATION_CHANNEL,
      serializeMessage({
        scope: "role",
        target: "role-admin",
        reason: "role_redefinition",
        issuedAt: "2026-04-22T00:00:00.000Z",
        publisher: "test",
        affectedUserIds: ["u1", "u3"],
      }),
    );
    await new Promise((r) => setTimeout(r, 100));

    expect(cache.get("u1", "sim.bitmap", "uv1")).toBeUndefined();
    expect(cache.get("u2", "sim.bitmap", "uv1")?.signature).toBe("u2");
    expect(cache.get("u3", "sim.bitmap", "uv1")).toBeUndefined();
    expect(cache.get("u4", "sim.bitmap", "uv1")?.signature).toBe("u4");
    await sub.stop();
  });

  it("scope=prefix → invalidatePrefix 호출", async () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.set("u1", "sim.bitmap", "uv1", sampleBm("a"));
    cache.set("u1", "other", "uv1", sampleBm("b"));
    const redis = new RedisMock() as unknown as Redis;
    const sub = new BitmapInvalidationSubscriber({
      redis: (redis as RedisMock).duplicate() as unknown as Redis,
      cache,
      logger: silentLogger(),
    });
    await sub.start();
    await redis.publish(
      INVALIDATION_CHANNEL,
      serializeMessage({
        scope: "prefix",
        target: "sim.bitmap",
        reason: "prefix_version_bump",
        issuedAt: "2026-04-22T00:00:00.000Z",
        publisher: "test",
      }),
    );
    await new Promise((r) => setTimeout(r, 100));
    expect(cache.get("u1", "sim.bitmap", "uv1")).toBeUndefined();
    expect(cache.get("u1", "other", "uv1")?.signature).toBe("b");
    await sub.stop();
  });

  it("invalid JSON → cache 변경 없음 + warn 로그", async () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.set("u1", "sim.bitmap", "uv1", sampleBm("a"));
    const warnSpy = vi.fn();
    const redis = new RedisMock() as unknown as Redis;
    const sub = new BitmapInvalidationSubscriber({
      redis: (redis as RedisMock).duplicate() as unknown as Redis,
      cache,
      logger: { warn: warnSpy, info: vi.fn(), error: vi.fn() },
    });
    await sub.start();
    await redis.publish(INVALIDATION_CHANNEL, "not-json");
    await new Promise((r) => setTimeout(r, 100));
    expect(cache.get("u1", "sim.bitmap", "uv1")?.signature).toBe("a");
    expect(warnSpy).toHaveBeenCalled();
    await sub.stop();
  });

  it("schema invalid → cache 변경 없음 + warn 로그", async () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.set("u1", "sim.bitmap", "uv1", sampleBm("a"));
    const warnSpy = vi.fn();
    const redis = new RedisMock() as unknown as Redis;
    const sub = new BitmapInvalidationSubscriber({
      redis: (redis as RedisMock).duplicate() as unknown as Redis,
      cache,
      logger: { warn: warnSpy, info: vi.fn(), error: vi.fn() },
    });
    await sub.start();
    await redis.publish(INVALIDATION_CHANNEL, '{"scope":"unknown"}');
    await new Promise((r) => setTimeout(r, 100));
    expect(warnSpy).toHaveBeenCalled();
    await sub.stop();
  });
});
