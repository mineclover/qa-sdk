# I-4: Redis 캐시 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redis 기반 L2 캐시 어댑터를 구현하고, decode-service에 통합하며, CLI cache stats/clear 명령을 추가한다.

**Architecture:** RedisKeyCache\<T\>가 기존 KeyCache\<T\> 포트를 ioredis로 구현. decode-service의 DecoderPool이 L1 miss 시 Redis L2를 조회. CLI는 Redis에 직접 연결하여 캐시 관리.

**Tech Stack:** ioredis, TypeScript, Vitest, Hono, zod

---

### Task 1: ioredis 의존성 추가 + RedisKeyCache 구현

**Files:**
- Modify: `packages/store/package.json`
- Create: `packages/store/src/adapters/redis/key-cache.adapter.ts`
- Create: `packages/store/src/adapters/redis/index.ts`
- Modify: `packages/store/src/index.ts`

- [ ] **Step 1: ioredis를 store 패키지에 추가**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/store add ioredis
```

그리고 package.json에서 `dependencies`의 `ioredis`를 `optionalDependencies`로 이동:

`packages/store/package.json`에서 dependencies의 ioredis 항목을 제거하고 optionalDependencies에 추가:

```json
"optionalDependencies": {
  "ioredis": "^5.6.1"
}
```

- [ ] **Step 2: RedisKeyCache 구현**

```typescript
// packages/store/src/adapters/redis/key-cache.adapter.ts

import type { KeyCache, CacheStats } from "@qa-sdk/core";
import type Redis from "ioredis";

/**
 * Redis KeyCache — L2 네트워크 캐시.
 *
 * 모든 키에 prefix를 적용하여 네임스페이스 격리.
 * stats의 hits/misses는 프로세스 로컬 카운터 (InMemoryKeyCache와 동일).
 */
export class RedisKeyCache<T = unknown> implements KeyCache<T> {
  private readonly prefix: string;
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly redis: Redis,
    opts?: { prefix?: string },
  ) {
    this.prefix = opts?.prefix ?? "kc:";
  }

  private _key(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<T | undefined> {
    const raw = await this.redis.get(this._key(key));
    if (raw === null) {
      this.misses++;
      return undefined;
    }
    try {
      this.hits++;
      return JSON.parse(raw) as T;
    } catch {
      // 데이터 손상 방어
      this.misses++;
      this.hits--;
      return undefined;
    }
  }

  async set(key: string, value: T, ttlMs: number): Promise<void> {
    const json = JSON.stringify(value);
    if (ttlMs > 0) {
      await this.redis.set(this._key(key), json, "PX", ttlMs);
    } else {
      await this.redis.set(this._key(key), json);
    }
  }

  async delete(key: string): Promise<boolean> {
    const count = await this.redis.del(this._key(key));
    return count > 0;
  }

  async clear(): Promise<void> {
    const pattern = `${this.prefix}*`;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== "0");
    this.hits = 0;
    this.misses = 0;
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.redis.exists(this._key(key));
    return exists === 1;
  }

  stats(): CacheStats {
    return {
      size: 0, // Redis SCAN 기반 실시간 조회 비용 → 0 반환, 필요 시 scanSize() 호출
      hits: this.hits,
      misses: this.misses,
      evictions: 0, // Redis TTL 만료는 로컬 추적 불가
    };
  }

  /** prefix 범위 키 수 실시간 조회 (비싸므로 stats()에 포함하지 않음) */
  async scanSize(): Promise<number> {
    const pattern = `${this.prefix}*`;
    let cursor = "0";
    let count = 0;
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      count += keys.length;
    } while (cursor !== "0");
    return count;
  }
}
```

- [ ] **Step 3: redis/index.ts 생성**

```typescript
// packages/store/src/adapters/redis/index.ts
export { RedisKeyCache } from "./key-cache.adapter.js";
```

- [ ] **Step 4: store/index.ts에 export 추가**

`packages/store/src/index.ts` 끝에 추가:

```typescript
// ── Redis Adapters ────────────────────────────────────

export { RedisKeyCache } from "./adapters/redis/index.js";
```

- [ ] **Step 5: 빌드 확인**

Run: `pnpm --filter @qa-sdk/store build`
Expected: 성공

- [ ] **Step 6: Commit**

```bash
git add packages/store/package.json packages/store/src/adapters/redis/ packages/store/src/index.ts
git commit -m "feat(store): add RedisKeyCache adapter (ioredis)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: RedisKeyCache 테스트

**Files:**
- Create: `packages/store/src/adapters/redis/key-cache.adapter.test.ts`

- [ ] **Step 1: ioredis mock + 테스트 작성**

```typescript
// packages/store/src/adapters/redis/key-cache.adapter.test.ts

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
    // SET key value PX ttlMs
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
    // 단순화: 한번에 전체 반환
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
    await cache.set("k1", "v1", 1); // 1ms TTL
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
    // 직접 잘못된 JSON 삽입
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
```

- [ ] **Step 2: 테스트 실행**

Run: `pnpm --filter @qa-sdk/store test -- --run redis`
Expected: 12개 테스트 전부 PASS

- [ ] **Step 3: Commit**

```bash
git add packages/store/src/adapters/redis/key-cache.adapter.test.ts
git commit -m "test(store): add RedisKeyCache tests (12 cases, mock-based)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: decode-service env 확장 + Redis 연결

**Files:**
- Modify: `packages/decode-service/src/config/env.ts`
- Modify: `packages/decode-service/src/server.ts`

- [ ] **Step 1: env.ts에 CACHE_DRIVER, REDIS_URL 추가**

`packages/decode-service/src/config/env.ts`에서 envSchema 수정:

```typescript
import { z } from "zod";
import { getServicePort, getServiceDevUrl, emptyStringToUndefined } from "@qa-sdk/core";

const DEFAULT_PORT = getServicePort("decode-service") ?? 3600;

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  /** registry-service URL — startup 시 DecodeMap 자동 fetch */
  REGISTRY_URL: z.preprocess(emptyStringToUndefined, z.string().url().default(getServiceDevUrl("registry-service") ?? "http://localhost:3300")),
  /** 캐시 TTL (밀리초). 기본 60초. */
  CACHE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  /** 캐시 드라이버: memory (기본) 또는 redis */
  CACHE_DRIVER: z.enum(["memory", "redis"]).default("memory"),
  /** Redis URL (CACHE_DRIVER=redis 시 필수) */
  REDIS_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const env = envSchema.parse(source);
  if (env.CACHE_DRIVER === "redis" && !env.REDIS_URL) {
    throw new Error("CACHE_DRIVER=redis requires REDIS_URL");
  }
  return env;
}

export const env = parseEnv(process.env);
```

- [ ] **Step 2: server.ts에 Redis 연결 초기화 추가**

`packages/decode-service/src/server.ts`를 읽고, decode-service 시작 시 CACHE_DRIVER=redis인 경우 Redis 연결을 생성하여 decode routes에 전달하는 로직을 추가. 정확한 수정은 server.ts의 현재 구조에 따라 결정. 핵심 패턴:

```typescript
import type { KeyCache } from "@qa-sdk/core";

let decodeCache: KeyCache | undefined;

if (env.CACHE_DRIVER === "redis" && env.REDIS_URL) {
  const Redis = (await import("ioredis")).default;
  const { RedisKeyCache } = await import("@qa-sdk/store");
  const redis = new Redis(env.REDIS_URL);
  decodeCache = new RedisKeyCache(redis, { prefix: "decode:" });
}
```

- [ ] **Step 3: 빌드 확인**

Run: `pnpm --filter decode-service build`
Expected: 성공

- [ ] **Step 4: Commit**

```bash
git add packages/decode-service/src/config/env.ts packages/decode-service/src/server.ts
git commit -m "feat(decode): add CACHE_DRIVER + REDIS_URL env config

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: decode-service에 Redis L2 캐시 통합

**Files:**
- Modify: `packages/decode-service/src/routes/decode.ts`

- [ ] **Step 1: DecodeDeps에 decodeCache 추가**

`packages/decode-service/src/routes/decode.ts`의 DecodeDeps 인터페이스에 추가:

```typescript
import type { KeyCache } from "@qa-sdk/core";

export interface DecodeDeps {
  pool: DecoderPool;
  /** Redis L2 캐시 (없으면 L1 only) */
  decodeCache?: KeyCache<unknown>;
  /** 캐시 TTL (밀리초) */
  cacheTtlMs?: number;
}
```

- [ ] **Step 2: decode 라우트에 캐시 조회/저장 추가**

POST /decode 핸들러를 수정. 기존:

```typescript
app.post("/decode", async (c) => {
  const body = await c.req.json();
  const req = decodeRequestSchema.parse(body);
  const decoder = resolveDecoder(pool, req.input, req.prefix, req.version);
  const vv = decoder.resolve(req.input);
  const entities = decoder.decode(req.input);
  return c.json({ indexId: vv.indexId, versionId: vv.versionId, value: vv.value, entities });
});
```

수정:

```typescript
app.post("/decode", async (c) => {
  const body = await c.req.json();
  const req = decodeRequestSchema.parse(body);

  // L2 캐시 조회
  const cacheKey = `${req.prefix ?? "auto"}:${req.version ?? "auto"}:${req.input}`;
  if (deps.decodeCache) {
    try {
      const cached = await deps.decodeCache.get(cacheKey);
      if (cached) return c.json(cached);
    } catch {
      // fail-open: 캐시 실패 → decode 진행
    }
  }

  const decoder = resolveDecoder(pool, req.input, req.prefix, req.version);
  const vv = decoder.resolve(req.input);
  const entities = decoder.decode(req.input);
  const result = { indexId: vv.indexId, versionId: vv.versionId, value: vv.value, entities };

  // L2 캐시 저장
  if (deps.decodeCache) {
    try {
      await deps.decodeCache.set(cacheKey, result, deps.cacheTtlMs ?? 60_000);
    } catch {
      // fail-open
    }
  }

  return c.json(result);
});
```

같은 패턴을 /decode/batch, /decode/deep에도 적용. batch는 개별 input별로 캐시.

- [ ] **Step 3: 빌드 확인**

Run: `pnpm --filter decode-service build`
Expected: 성공

- [ ] **Step 4: Commit**

```bash
git add packages/decode-service/src/routes/decode.ts
git commit -m "feat(decode): integrate Redis L2 cache into decode routes (fail-open)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: CLI cache 명령 그룹

**Files:**
- Create: `packages/cli/src/command-groups/cache.commands.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: cache.commands.ts 생성**

```typescript
// packages/cli/src/command-groups/cache.commands.ts

import {
  descriptorsToTree,
  collectCommandUsageSpecs,
  type CommandDescriptor,
  type CommandUsageSpec,
  type CliCommandNode,
} from "../command-spec.js";

const CACHE_COMMAND_DESCRIPTORS: CommandDescriptor[] = [
  {
    id: "cache.stats",
    path: ["cache", "stats"],
    usage: "qa-sdk cache stats                    Redis 캐시 통계 조회",
    handlerKey: "cache.stats",
    options: [
      { flag: "--redis-url", valueHint: "<url>", description: "Redis URL ($REDIS_URL)" },
      { flag: "--prefix", valueHint: "<prefix>", description: "캐시 prefix 필터 (기본: 전체)" },
    ],
  },
  {
    id: "cache.clear",
    path: ["cache", "clear"],
    usage: "qa-sdk cache clear [--prefix <id>]   Redis 캐시 삭제",
    handlerKey: "cache.clear",
    options: [
      { flag: "--redis-url", valueHint: "<url>", description: "Redis URL ($REDIS_URL)" },
      { flag: "--prefix", valueHint: "<id>", description: "특정 prefix만 삭제 (기본: decode:)" },
      { flag: "--all", description: "모든 캐시 prefix 삭제" },
    ],
  },
];

export const CACHE_COMMAND_SPECS: CommandUsageSpec[] = collectCommandUsageSpecs(CACHE_COMMAND_DESCRIPTORS);
export const CACHE_COMMAND_TREE: CliCommandNode = descriptorsToTree(CACHE_COMMAND_DESCRIPTORS);

type RestCommandHandler = (rest: string[]) => Promise<void> | void;

export function createCacheHandlerRegistry(): Record<string, RestCommandHandler> {
  return {
    "cache.stats": async (rest) => {
      const { parseArgs } = await import("node:util");
      const { values } = parseArgs({
        args: rest,
        options: {
          "redis-url": { type: "string" },
          prefix: { type: "string" },
        },
        strict: false,
      });

      const redisUrl = (values["redis-url"] as string) || process.env.REDIS_URL;
      if (!redisUrl) {
        console.log("REDIS_URL이 설정되지 않았습니다. --redis-url 또는 REDIS_URL 환경변수를 지정하세요.");
        return;
      }

      const Redis = (await import("ioredis")).default;
      const { RedisKeyCache } = await import("@qa-sdk/store");
      const redis = new Redis(redisUrl);

      try {
        const prefix = (values.prefix as string) || "decode:";
        const cache = new RedisKeyCache(redis, { prefix });
        const size = await cache.scanSize();
        const info = await redis.info("memory");
        const memMatch = info.match(/used_memory_human:(.+)/);

        console.log(`[캐시 통계] prefix="${prefix}"`);
        console.log(`  키 수: ${size}`);
        console.log(`  Redis 메모리: ${memMatch?.[1]?.trim() ?? "N/A"}`);
      } finally {
        redis.disconnect();
      }
    },

    "cache.clear": async (rest) => {
      const { parseArgs } = await import("node:util");
      const { values } = parseArgs({
        args: rest,
        options: {
          "redis-url": { type: "string" },
          prefix: { type: "string" },
          all: { type: "boolean", default: false },
        },
        strict: false,
      });

      const redisUrl = (values["redis-url"] as string) || process.env.REDIS_URL;
      if (!redisUrl) {
        console.log("REDIS_URL이 설정되지 않았습니다. --redis-url 또는 REDIS_URL 환경변수를 지정하세요.");
        return;
      }

      const Redis = (await import("ioredis")).default;
      const { RedisKeyCache } = await import("@qa-sdk/store");
      const redis = new Redis(redisUrl);

      try {
        const prefixes = values.all
          ? ["decode:", "kc:", "reg:"]
          : [(values.prefix as string) || "decode:"];

        for (const p of prefixes) {
          const cache = new RedisKeyCache(redis, { prefix: p });
          const before = await cache.scanSize();
          await cache.clear();
          console.log(`[캐시 삭제] prefix="${p}" — ${before}건 삭제`);
        }
      } finally {
        redis.disconnect();
      }
    },
  };
}
```

- [ ] **Step 2: CLI index.ts에 cache 명령 그룹 등록**

`packages/cli/src/index.ts`에서 기존 command group import 패턴을 따라 추가:

```typescript
import {
  CACHE_COMMAND_SPECS as CACHE_GROUP_COMMAND_SPECS,
  CACHE_COMMAND_TREE as CACHE_GROUP_COMMAND_TREE,
  createCacheHandlerRegistry,
} from './command-groups/cache.commands.js';
```

그리고 기존 command specs/tree/registry 합성 부분에 cache 그룹 추가. (정확한 위치는 index.ts의 합성 패턴에 따름)

- [ ] **Step 3: 빌드 확인**

Run: `pnpm --filter @qa-sdk/cli build`
Expected: 성공

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/command-groups/cache.commands.ts packages/cli/src/index.ts
git commit -m "feat(cli): add cache stats/clear commands

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: spec.todo.md 업데이트 + 스펙 문서

**Files:**
- Modify: `docs/specs/spec.todo.md`
- Create: `docs/specs/pipeline-system/redis-cache-adapter.spec.md`

- [ ] **Step 1: spec.todo.md에 I-4 완료 반영**

완료 현황 테이블에 I-4 추가:
```markdown
| 데이터 파이프라인 I-4 | Phase 1+2 완료 | RedisKeyCache 12 tests, decode-service 통합, CLI cache 2 commands |
```

잔여 작업의 I-4 행 제거.

- [ ] **Step 2: redis-cache-adapter.spec.md 작성**

스펙 문서를 `docs/specs/pipeline-system/redis-cache-adapter.spec.md`에 작성. 포트 인터페이스, RedisKeyCache 매핑, decode-service 통합 패턴, CLI 명령, 환경변수 포함.

- [ ] **Step 3: Commit**

```bash
git add docs/specs/spec.todo.md docs/specs/pipeline-system/redis-cache-adapter.spec.md
git commit -m "docs: add Redis cache adapter spec, mark I-4 as completed

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
