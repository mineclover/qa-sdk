import { describe, it, expect, beforeEach } from "vitest";
import { RedisKeyCache } from "./key-cache.adapter.js";

/** ioredis mock — Map 기반 인메모리 구현 */
class RedisMock {
  private store = new Map<string, { value: string; expireAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expireAt && Date.now() > entry.expireAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ...args: unknown[]): Promise<"OK"> {
    let expireAt: number | undefined;
    if (args[0] === "PX" && typeof args[1] === "number") {
      expireAt = Date.now() + args[1];
    }
    this.store.set(key, { value, expireAt });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async exists(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    if (entry.expireAt && Date.now() > entry.expireAt) {
      this.store.delete(key);
      return 0;
    }
    return 1;
  }

  async scan(cursor: string, ..._args: unknown[]): Promise<[string, string[]]> {
    const matchPattern = _args[1] as string;
    const prefix = matchPattern.replace("*", "");
    const keys = [...this.store.keys()].filter((k) => k.startsWith(prefix));
    return ["0", keys];
  }
}

describe("RedisKeyCache", () => {
  let cache: RedisKeyCache<string>;
  let mock: RedisMock;

  beforeEach(() => {
    mock = new RedisMock();
    cache = new RedisKeyCache<string>(mock as never, { prefix: "test:" });
  });

  it("set/get 기본 동작", async () => {
    await cache.set("k1", "v1", 60_000);
    expect(await cache.get("k1")).toBe("v1");
  });

  it("존재하지 않는 키 → undefined", async () => {
    expect(await cache.get("missing")).toBeUndefined();
  });

  it("TTL 만료 시 undefined 반환", async () => {
    await cache.set("k1", "v1", 1);
    await new Promise((r) => setTimeout(r, 10));
    expect(await cache.get("k1")).toBeUndefined();
  });

  it("TTL 0 → 영구 캐시", async () => {
    await cache.set("k1", "v1", 0);
    expect(await cache.get("k1")).toBe("v1");
  });

  it("has — 존재 판별", async () => {
    await cache.set("k1", "v1", 60_000);
    expect(await cache.has("k1")).toBe(true);
    expect(await cache.has("missing")).toBe(false);
  });

  it("delete — 단건 삭제", async () => {
    await cache.set("k1", "v1", 60_000);
    expect(await cache.delete("k1")).toBe(true);
    expect(await cache.get("k1")).toBeUndefined();
    expect(await cache.delete("k1")).toBe(false);
  });

  it("clear — prefix 범위 삭제 + 통계 초기화", async () => {
    await cache.set("k1", "v1", 60_000);
    await cache.set("k2", "v2", 60_000);
    await cache.clear();
    expect(await cache.get("k1")).toBeUndefined();
    expect(await cache.get("k2")).toBeUndefined();
    expect(cache.stats().hits).toBe(0);
  });

  it("stats — hit/miss 카운트", async () => {
    await cache.set("k1", "v1", 60_000);
    await cache.get("k1"); // hit
    await cache.get("k1"); // hit
    await cache.get("missing"); // miss
    const s = cache.stats();
    expect(s.hits).toBe(2);
    expect(s.misses).toBe(1);
  });

  it("prefix 네임스페이스 격리", async () => {
    const cache2 = new RedisKeyCache<string>(mock as never, { prefix: "other:" });
    await cache.set("k1", "from-test", 60_000);
    await cache2.set("k1", "from-other", 60_000);
    expect(await cache.get("k1")).toBe("from-test");
    expect(await cache2.get("k1")).toBe("from-other");
  });

  it("JSON parse 실패 → undefined + miss", async () => {
    await mock.set("test:bad", "not-json{{{");
    expect(await cache.get("bad")).toBeUndefined();
    expect(cache.stats().misses).toBe(1);
  });

  it("동일 키 덮어쓰기", async () => {
    await cache.set("k1", "old", 60_000);
    await cache.set("k1", "new", 60_000);
    expect(await cache.get("k1")).toBe("new");
  });

  it("scanSize — prefix 범위 키 수", async () => {
    await cache.set("a", "1", 60_000);
    await cache.set("b", "2", 60_000);
    expect(await cache.scanSize()).toBe(2);
  });
});
