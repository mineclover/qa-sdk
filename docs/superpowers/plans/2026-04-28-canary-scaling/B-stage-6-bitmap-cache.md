## 단계 6: bitmap TTL + version-check fallback (이전 평가 #2)

**Spec 참조:** `04-scaling-infra.md` §3

bitmap pub/sub 무효화 메시지가 유실되어도 정합성이 회복되도록 TTL과 version-check를 함께 둔다. 본 단계는 기존 `sim-bitmap-cache` 패키지의 entry 타입·`get` 흐름·subscriber 책임·`/metrics` 노출을 spec 04 §3.1~§3.5에 정렬한다.

### File Structure (단계 6)

| 종류 | 경로 |
|---|---|
| Modify | `simulations/enterprise-pm/packages/sim-bitmap-cache/src/lru-cache.ts` (`BitmapCacheEntry` + grammar #11 key builder 위임) |
| Modify | `simulations/enterprise-pm/packages/sim-bitmap-cache/src/cache-service.ts` (`getBitmap` 3단계 검증 흐름 + catalog/authApi 주입) |
| Modify | `simulations/enterprise-pm/packages/sim-bitmap-cache/src/subscriber.ts` (메시지 수신 → LRU evict 트리거만) |
| Modify | `simulations/enterprise-pm/packages/sim-bitmap-cache/src/index.ts` |
| Create | `simulations/enterprise-pm/packages/sim-bitmap-cache/src/metrics.ts` (`bitmap_cache_lookup_total` counter) |
| Create | `simulations/enterprise-pm/packages/sim-bitmap-cache/src/cache-service.test.ts` (3단계 검증 흐름 단위 테스트) |
| Create | `simulations/enterprise-pm/packages/sim-bitmap-cache/src/version-fallback.test.ts` (pub/sub drop + version bump + TTL 만료 회복) |
| Modify | `simulations/enterprise-pm/packages/sim-bitmap-cache/package.json` (`prom-client` + `@qa-sdk/sim-identifier-grammar` workspace dep) |

### Task 6.1: BitmapCacheEntry 타입 확장 (spec 04 §3.1)

**Files:**
- Modify: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/lru-cache.ts`
- Modify: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/index.ts`
- Modify: `simulations/enterprise-pm/packages/sim-bitmap-cache/package.json`

spec 04 §3.1 인터페이스 그대로. 기존 entry는 `permission-engine`의 `VersionedBitmap`을 LRU value로 직접 사용했으나, §3.1은 cache가 `prefix`/`prefixVersion`/`issuedAt`/`ttlMs`를 *명시적으로* 보유해야 한다고 못박는다(version-check fallthrough를 위함). 추가 필드는 모두 옵셔널 의미(set 인자에서 이미 받고 있거나 default 주입) — 기존 호출자(시뮬 서비스 4종) 무회귀. key 합성은 grammar #11 builder(`buildBitmapCacheKey`, Plan A Task 2.12)에 위임.

- [ ] **Step 6.1.1: 실패 테스트 작성**

`src/cache-service.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { BitmapLruCache, DEFAULT_BITMAP_TTL_MS, type BitmapCacheEntry } from "./lru-cache.js";

const KEY = "bitmap:user:U001:sim.svc.approval:v3";
const entry = (over: Partial<BitmapCacheEntry> = {}): BitmapCacheEntry => ({
  key: KEY, prefix: "sim.svc.approval", prefixVersion: "v3",
  mask: new Uint8Array([0x01, 0x02]), issuedAt: Date.now(), ttlMs: DEFAULT_BITMAP_TTL_MS, ...over,
});

describe("BitmapCacheEntry (spec 04 §3.1)", () => {
  it("default TTL=120_000ms (기본 120000 / 2분)", () => {
    expect(DEFAULT_BITMAP_TTL_MS).toBe(120_000);
  });
  it("setEntry/getEntry 라운드트립 — entry 본문 그대로", () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.setEntry(entry());
    expect(cache.getEntry(KEY)).toEqual(entry());
  });
  it("entry는 prefix/prefixVersion/issuedAt/ttlMs 모두 보유", () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.setEntry(entry());
    const got = cache.getEntry(KEY)!;
    expect(got.prefix).toBe("sim.svc.approval");
    expect(got.prefixVersion).toBe("v3");
    expect(got.ttlMs).toBe(120_000);
  });
});
```

- [ ] **Step 6.1.2: 테스트 실패 확인**

```bash
pnpm --filter @qa-sdk/sim-bitmap-cache test cache-service
```

기대: FAIL (`DEFAULT_BITMAP_TTL_MS`/`BitmapCacheEntry`/`setEntry`/`getEntry` 미존재).

- [ ] **Step 6.1.3: 최소 구현**

`src/lru-cache.ts`(주요 구간만 — 신규 추가/교체):

```typescript
import { LRUCache } from "lru-cache";
import { buildBitmapCacheKey, type BitmapCacheKey } from "@qa-sdk/sim-identifier-grammar";

/** spec 04 §3.1 — 기본 120000 (2분). */
export const DEFAULT_BITMAP_TTL_MS = 120_000;

/** spec 04 §3.1 — 캐시 entry 형태 (인터페이스 그대로). */
export interface BitmapCacheEntry {
  key: string;             // grammar #11
  prefix: string;          // catalog 등록 prefix
  prefixVersion: string;   // 발급 시점 version axis 값 (grammar #3)
  mask: Uint8Array;
  issuedAt: number;
  ttlMs: number;           // 기본 120000 (2분)
}

export interface BitmapLruCacheOptions { max: number; }

/** Deprecated alias — grammar #11 builder를 직접 사용할 것. 기존 호출자 무회귀용. */
export function makeKey(userId: string, prefix: string, v: string): string {
  const parts = prefix.split(".");
  if (parts.length !== 3) throw new Error(`legacy prefix must be 3-tier (got ${prefix})`);
  const m = v.match(/^v(\d+)(?:-(stable|candidate|retired))?$/);
  if (!m) throw new Error(`legacy version tag must be v{N}[-state] (got ${v})`);
  const key: BitmapCacheKey = {
    scope: "user", id: userId,
    prefix: { namespace: parts[0], category: parts[1], name: parts[2] },
    version: { axis: "version", value: Number(m[1]), state: (m[2] as BitmapCacheKey["version"]["state"]) ?? "stable" },
  };
  return buildBitmapCacheKey(key);
}

export class BitmapLruCache {
  private readonly cache: LRUCache<string, BitmapCacheEntry>;
  constructor(opts: BitmapLruCacheOptions) {
    this.cache = new LRUCache({ max: opts.max, ttlAutopurge: false });
  }
  setEntry(e: BitmapCacheEntry): void {
    if (e.ttlMs <= 0) return;
    this.cache.set(e.key, e, { ttl: e.ttlMs });
  }
  getEntry(key: string): BitmapCacheEntry | undefined { return this.cache.get(key); }
  evictByKey(key: string): boolean { return this.cache.delete(key); }
  invalidateUser(userId: string): number {
    let removed = 0; const needle = `bitmap:user:${userId}:`;
    for (const k of this.cache.keys()) if (k.startsWith(needle)) { this.cache.delete(k); removed++; }
    return removed;
  }
  invalidateUsers(ids: readonly string[]): number {
    let removed = 0; for (const id of ids) removed += this.invalidateUser(id); return removed;
  }
  invalidatePrefix(prefix: string): number {
    let removed = 0; const needle = `:${prefix}:`;
    for (const k of this.cache.keys()) if (k.includes(needle)) { this.cache.delete(k); removed++; }
    return removed;
  }
  size(): number { return this.cache.size; }
  clear(): void { this.cache.clear(); }
}
```

`package.json` 의존: `@qa-sdk/sim-identifier-grammar: workspace:*`, `prom-client: ^15.1.0` 추가.

- [ ] **Step 6.1.4: 테스트 통과 + index re-export**

```bash
pnpm --filter @qa-sdk/sim-bitmap-cache test cache-service
```

기대: 3 PASS. `src/index.ts`에 `BitmapCacheEntry`, `DEFAULT_BITMAP_TTL_MS` 추가 export.

- [ ] **Step 6.1.5: Commit**

```bash
git add simulations/enterprise-pm/packages/sim-bitmap-cache/src/lru-cache.ts \
        simulations/enterprise-pm/packages/sim-bitmap-cache/src/cache-service.test.ts \
        simulations/enterprise-pm/packages/sim-bitmap-cache/src/index.ts \
        simulations/enterprise-pm/packages/sim-bitmap-cache/package.json
git commit -m "feat(sim-bitmap-cache): BitmapCacheEntry + grammar #11 key builder 위임 (spec 04 §3.1)"
```

### Task 6.2: getBitmap(key) 3단계 검증 흐름 (spec 04 §3.2)

**Files:**
- Modify: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/cache-service.ts`
- Modify: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/cache-service.test.ts`
- Modify: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/index.ts`

spec 04 §3.2 ts 코드 그대로 인용해 `BitmapCacheService.getBitmap(key)`를 추가. 두 콜라보레이터 주입 — `catalog.getLatestPrefixVersion(prefix)`(루트 CLAUDE.md "좌표 컨벤션" §1의 `latestPrefixVersion(catalog, prefixId)` wrapper, Plan B 단계 3 결과)와 `authApi.fetchBitmap`(refresh 경로). 본 task는 인터페이스만 의존하고 구현체는 주입에 위임.

spec 04 §3.2 인용:

```ts
async function getBitmap(key: string): Promise<Uint8Array> {
  const cached = lru.get(key);

  // (1) hit + valid TTL + version-check OK → 즉시 반환
  if (cached && Date.now() - cached.issuedAt < cached.ttlMs) {
    const currentVersion = await catalog.getLatestPrefixVersion(cached.prefix);
    if (currentVersion === cached.prefixVersion) {
      return cached.mask;
    }
    // version mismatch → fallthrough (회복 경로)
  }

  // (2) miss / TTL 만료 / version mismatch → auth-api에서 refresh
  const fresh = await authApi.fetchBitmap({ key, prefix: cached?.prefix });
  lru.set(key, {
    key, prefix: fresh.prefix, prefixVersion: fresh.prefixVersion,
    mask: fresh.mask, issuedAt: Date.now(), ttlMs: 120_000,
  });
  return fresh.mask;
}
```

- [ ] **Step 6.2.1: 실패 테스트 작성**

`src/cache-service.test.ts`에 추가:

```typescript
import { vi } from "vitest";
import { BitmapCacheService } from "./cache-service.js";

const PREFIX = "sim.svc.approval";
const fixedEntry = (over = {}) => ({
  key: KEY, prefix: PREFIX, prefixVersion: "v3",
  mask: new Uint8Array([0x01, 0x02]), issuedAt: Date.now(), ttlMs: DEFAULT_BITMAP_TTL_MS, ...over,
});
const silent = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });
const make = (catVer: string, freshVer = catVer, freshMask = new Uint8Array([0xff])) => {
  const fetchBitmap = vi.fn(async () => ({ prefix: PREFIX, prefixVersion: freshVer, mask: freshMask }));
  const svc = new BitmapCacheService({
    publisherName: "test", cache: { max: 100 }, logger: silent(),
    catalog: { getLatestPrefixVersion: vi.fn(async () => catVer) },
    authApi: { fetchBitmap },
  });
  return { svc, fetchBitmap };
};

describe("BitmapCacheService.getBitmap (spec 04 §3.2)", () => {
  it("(1) hit + valid TTL + version OK → 즉시 반환, auth-api 미호출", async () => {
    const { svc, fetchBitmap } = make("v3");
    svc.cache.setEntry(fixedEntry());
    expect(await svc.getBitmap(KEY)).toEqual(new Uint8Array([0x01, 0x02]));
    expect(fetchBitmap).not.toHaveBeenCalled();
  });
  it("(2-a) miss → auth-api refresh + LRU set (ttlMs=120_000)", async () => {
    const { svc, fetchBitmap } = make("v3");
    expect(await svc.getBitmap(KEY)).toEqual(new Uint8Array([0xff]));
    expect(fetchBitmap).toHaveBeenCalledWith({ key: KEY, prefix: undefined });
    expect(svc.cache.getEntry(KEY)?.ttlMs).toBe(120_000);
  });
  it("(2-b) TTL 만료 → fallthrough", async () => {
    const { svc, fetchBitmap } = make("v3");
    svc.cache.setEntry(fixedEntry({ issuedAt: Date.now() - DEFAULT_BITMAP_TTL_MS - 1, ttlMs: 1 }));
    await svc.getBitmap(KEY);
    expect(fetchBitmap).toHaveBeenCalledTimes(1);
  });
  it("(2-c) version mismatch → fallthrough, prefixVersion 갱신", async () => {
    const { svc, fetchBitmap } = make("v4", "v4", new Uint8Array([0xee]));
    svc.cache.setEntry(fixedEntry({ prefixVersion: "v3" }));
    expect(await svc.getBitmap(KEY)).toEqual(new Uint8Array([0xee]));
    expect(fetchBitmap).toHaveBeenCalledTimes(1);
    expect(svc.cache.getEntry(KEY)?.prefixVersion).toBe("v4");
  });
});
```

- [ ] **Step 6.2.2: 테스트 실패 확인**

```bash
pnpm --filter @qa-sdk/sim-bitmap-cache test cache-service
```

기대: FAIL (`getBitmap`/`catalog`/`authApi` 미존재).

- [ ] **Step 6.2.3: 최소 구현**

기존 `BitmapCacheServiceOptions`에 `catalog`/`authApi`/`defaultTtlMs` 옵셔널 필드 추가, 클래스 본문에 `getBitmap` 메서드 추가. 기존 `publisher`/`subscriber` 설정 흐름은 보존:

```typescript
// 기존 import에 다음 추가
import { recordBitmapCacheLookup } from "./metrics.js";
import { DEFAULT_BITMAP_TTL_MS, type BitmapCacheEntry } from "./lru-cache.js";

/** spec 04 §3.2 — catalog 콜라보레이터. latestPrefixVersion 단일 진실. */
export interface BitmapCacheCatalog {
  getLatestPrefixVersion(prefix: string): Promise<string>;
}
/** spec 04 §3.2 — auth-api 콜라보레이터. */
export interface BitmapAuthApi {
  fetchBitmap(req: { key: string; prefix?: string }): Promise<{
    prefix: string; prefixVersion: string; mask: Uint8Array;
  }>;
}

// BitmapCacheServiceOptions에 추가
//   catalog?: BitmapCacheCatalog;
//   authApi?: BitmapAuthApi;
//   defaultTtlMs?: number;

// 클래스 필드 추가 + 생성자에서 할당:
//   private readonly catalog = opts.catalog;
//   private readonly authApi = opts.authApi;
//   private readonly defaultTtlMs = opts.defaultTtlMs ?? DEFAULT_BITMAP_TTL_MS;

/** spec 04 §3.2 — 3단계 검증 흐름. (BitmapCacheService 메서드) */
async getBitmap(key: string): Promise<Uint8Array> {
  if (!this.catalog || !this.authApi) {
    throw new Error("BitmapCacheService.getBitmap requires { catalog, authApi } 주입");
  }
  const cached = this.cache.getEntry(key);

  // (1) hit + valid TTL + version-check OK → 즉시 반환
  if (cached && Date.now() - cached.issuedAt < cached.ttlMs) {
    const currentVersion = await this.catalog.getLatestPrefixVersion(cached.prefix);
    if (currentVersion === cached.prefixVersion) {
      recordBitmapCacheLookup("hit");
      return cached.mask;
    }
    recordBitmapCacheLookup("version_mismatch");
  } else {
    recordBitmapCacheLookup("miss");
  }

  // (2) miss / TTL 만료 / version mismatch → auth-api 에서 refresh
  const fresh = await this.authApi.fetchBitmap({ key, prefix: cached?.prefix });
  const entry: BitmapCacheEntry = {
    key, prefix: fresh.prefix, prefixVersion: fresh.prefixVersion,
    mask: fresh.mask, issuedAt: Date.now(), ttlMs: this.defaultTtlMs,
  };
  this.cache.setEntry(entry);
  return fresh.mask;
}
```

- [ ] **Step 6.2.4: 테스트 통과 + index re-export**

```bash
pnpm --filter @qa-sdk/sim-bitmap-cache test cache-service
```

기대: 누적 7 PASS. `src/index.ts`에 `BitmapCacheCatalog`, `BitmapAuthApi` export 추가.

- [ ] **Step 6.2.5: Commit**

```bash
git add simulations/enterprise-pm/packages/sim-bitmap-cache/src/cache-service.ts \
        simulations/enterprise-pm/packages/sim-bitmap-cache/src/cache-service.test.ts \
        simulations/enterprise-pm/packages/sim-bitmap-cache/src/index.ts
git commit -m "feat(sim-bitmap-cache): getBitmap 3단계 검증 흐름 (spec 04 §3.2)"
```

### Task 6.3: pub/sub subscriber는 evict 트리거만 (spec 04 §3.3)

**Files:**
- Modify: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/subscriber.ts`
- Modify: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/subscriber.test.ts`

spec 04 §3.3 인용: *“subscriber는 메시지 수신 시 LRU에서 즉시 evict — 다음 조회가 §3.2 (1)에서 fallthrough → (2)로 진행한다. evict 자체가 fallthrough trigger.”* 회복 보장은 §3.2가 단독 책임. 기존 subscriber의 invalidate 동작은 *evict trigger* 의미와 정확히 일치 — 변경 두 가지: (1) info 로그에 `recovery: "fallthrough-trigger"` 컨텍스트 추가, (2) parse 실패 / `affectedUserIds` 누락 시 fail-safe noop을 “TTL+version-check가 회복 보장” 메시지로 정렬.

- [ ] **Step 6.3.1: 실패 테스트 작성**

`src/subscriber.test.ts`에 추가:

```typescript
import { describe, it, expect, vi } from "vitest";
import { BitmapInvalidationSubscriber } from "./subscriber.js";
import { BitmapLruCache, DEFAULT_BITMAP_TTL_MS } from "./lru-cache.js";
import { INVALIDATION_CHANNEL, serializeMessage } from "./message.js";

function fakeRedis() {
  const handlers: Array<(c: string, m: string) => void> = [];
  return {
    on: vi.fn((ev: string, h: (c: string, m: string) => void) => { if (ev === "message") handlers.push(h); }),
    off: vi.fn(), subscribe: vi.fn(async () => 1), unsubscribe: vi.fn(async () => 1),
    emit: (c: string, m: string) => handlers.forEach((h) => h(c, m)),
  };
}
const KEY = "bitmap:user:U001:sim.svc.approval:v3";
const seedEntry = () => ({
  key: KEY, prefix: "sim.svc.approval", prefixVersion: "v3",
  mask: new Uint8Array([0x01]), issuedAt: Date.now(), ttlMs: DEFAULT_BITMAP_TTL_MS,
});

describe("Subscriber as evict trigger only (spec 04 §3.3)", () => {
  it("scope=user → cache evict + recovery=\"fallthrough-trigger\" 로그", async () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.setEntry(seedEntry());
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const redis = fakeRedis();
    const sub = new BitmapInvalidationSubscriber({ redis: redis as never, cache, logger });
    await sub.start();
    redis.emit(INVALIDATION_CHANNEL, serializeMessage({
      scope: "user", target: "U001", reason: "permission_change",
      issuedAt: new Date().toISOString(), publisher: "test",
    }));
    expect(cache.getEntry(KEY)).toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ recovery: "fallthrough-trigger" }), expect.any(String),
    );
  });
  it("malformed 메시지 → fail-safe noop, cache 보존 (정합성은 §3.2 보장)", async () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.setEntry(seedEntry());
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const redis = fakeRedis();
    const sub = new BitmapInvalidationSubscriber({ redis: redis as never, cache, logger });
    await sub.start();
    redis.emit(INVALIDATION_CHANNEL, "{not-json");
    expect(cache.getEntry(KEY)).toBeDefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 6.3.2: 테스트 실패 확인**

```bash
pnpm --filter @qa-sdk/sim-bitmap-cache test subscriber
```

기대: FAIL (`recovery` 라벨 미존재).

- [ ] **Step 6.3.3: 최소 구현**

`src/subscriber.ts`의 `handleMessage` info/warn 로그 정렬 (각 case info 호출 객체에 `recovery: "fallthrough-trigger"` 키 추가, 메시지 본문은 *“cache evicted (latency 최적화 trigger; 정합성은 §3.2 보장)”*, parse 실패/affectedUserIds 누락 warn은 *“정합성은 §3.2 TTL+version-check 보장”* 또는 *“TTL+version-check가 회복 보장”* 문구로 교체). `cache.invalidateUser/invalidateUsers/invalidatePrefix` 호출 자체는 변경 없음 — semantic은 evict trigger와 정확히 정합.

- [ ] **Step 6.3.4: 테스트 통과**

```bash
pnpm --filter @qa-sdk/sim-bitmap-cache test subscriber
```

기대: 누적 PASS (기존 subscriber 테스트 + 신규 2건).

- [ ] **Step 6.3.5: Commit**

```bash
git add simulations/enterprise-pm/packages/sim-bitmap-cache/src/subscriber.ts \
        simulations/enterprise-pm/packages/sim-bitmap-cache/src/subscriber.test.ts
git commit -m "refactor(sim-bitmap-cache): subscriber를 fallthrough-trigger로 격하 (spec 04 §3.3)"
```

### Task 6.4: /metrics에 bitmap_cache_lookup_total counter 추가 (spec 04 §3.5)

**Files:**
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/metrics.ts`
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/metrics.test.ts`
- Modify: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/index.ts`

spec 04 §3.5 인용: *“hit-rate는 `/metrics`의 `bitmap_cache_lookup_total{result="hit|miss|version_mismatch"}` counter로 노출.”* `prom-client` 글로벌 default registry에 등록 — 서비스(approval-api 등)의 `/metrics` 엔드포인트가 자동 hook. Task 6.2의 `recordBitmapCacheLookup(result)` 호출 표면을 본 모듈이 노출.

- [ ] **Step 6.4.1: 실패 테스트 작성**

`src/metrics.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { register } from "prom-client";
import {
  recordBitmapCacheLookup, bitmapCacheLookupTotal, type BitmapCacheLookupResult,
} from "./metrics.js";

describe("bitmap_cache_lookup_total counter (spec 04 §3.5)", () => {
  beforeEach(() => { bitmapCacheLookupTotal.reset(); });
  it("counter 이름은 spec 04 §3.5 — bitmap_cache_lookup_total", async () => {
    const out = await register.getSingleMetricAsString("bitmap_cache_lookup_total");
    expect(out).toContain("bitmap_cache_lookup_total");
  });
  it("result 라벨 3종 (hit/miss/version_mismatch) 모두 증가", async () => {
    const cases: BitmapCacheLookupResult[] = ["hit", "miss", "version_mismatch"];
    for (const r of cases) recordBitmapCacheLookup(r);
    const out = await register.getSingleMetricAsString("bitmap_cache_lookup_total");
    expect(out).toMatch(/bitmap_cache_lookup_total\{result="hit"\} 1/);
    expect(out).toMatch(/bitmap_cache_lookup_total\{result="miss"\} 1/);
    expect(out).toMatch(/bitmap_cache_lookup_total\{result="version_mismatch"\} 1/);
  });
  it("invalid result 라벨 → 런타임 가드", () => {
    // @ts-expect-error 의도적 부적합
    expect(() => recordBitmapCacheLookup("bogus")).toThrow();
  });
});
```

- [ ] **Step 6.4.2: 테스트 실패 확인**

```bash
pnpm --filter @qa-sdk/sim-bitmap-cache test metrics
```

기대: FAIL (`metrics.ts` 미존재).

- [ ] **Step 6.4.3: 최소 구현**

`src/metrics.ts`:

```typescript
import { Counter, register } from "prom-client";

/** spec 04 §3.5 — version_mismatch 비율 비정상은 catalog 변동 이상 신호. */
export const BITMAP_CACHE_LOOKUP_RESULTS = ["hit", "miss", "version_mismatch"] as const;
export type BitmapCacheLookupResult = (typeof BITMAP_CACHE_LOOKUP_RESULTS)[number];

export const bitmapCacheLookupTotal = new Counter({
  name: "bitmap_cache_lookup_total",
  help: "BitmapCacheService.getBitmap 호출 결과 분포 (spec 04 §3.5)",
  labelNames: ["result"] as const,
  registers: [register],
});

export function recordBitmapCacheLookup(result: BitmapCacheLookupResult): void {
  if (!BITMAP_CACHE_LOOKUP_RESULTS.includes(result)) {
    throw new Error(`invalid bitmap cache lookup result: ${String(result)}`);
  }
  bitmapCacheLookupTotal.inc({ result }, 1);
}
```

- [ ] **Step 6.4.4: 테스트 통과 + index re-export**

```bash
pnpm --filter @qa-sdk/sim-bitmap-cache test metrics
```

기대: 3 PASS. `src/index.ts`에 `bitmapCacheLookupTotal`, `recordBitmapCacheLookup`, `BITMAP_CACHE_LOOKUP_RESULTS`, `BitmapCacheLookupResult` export.

- [ ] **Step 6.4.5: Commit**

```bash
git add simulations/enterprise-pm/packages/sim-bitmap-cache/src/metrics.ts \
        simulations/enterprise-pm/packages/sim-bitmap-cache/src/metrics.test.ts \
        simulations/enterprise-pm/packages/sim-bitmap-cache/src/index.ts
git commit -m "feat(sim-bitmap-cache): bitmap_cache_lookup_total counter (spec 04 §3.5)"
```

### Task 6.5: 단위 테스트 — pub/sub drop + version bump + TTL 만료 회복

**Files:**
- Create: `simulations/enterprise-pm/packages/sim-bitmap-cache/src/version-fallback.test.ts`

spec 04 §3.4 시나리오 #16(`bitmap-cache-version-fallback`)와 *별개로* 핵심 메커니즘 단위 테스트. fault injection은 in-memory pub/sub mock — publish 100% drop, catalog 측 prefixVersion v3 → v4 bump 후 (a) TTL 만료 이전 version-check fallthrough, (b) TTL 만료 후 fallthrough 두 경로 모두 회복됨을 단정.

- [ ] **Step 6.5.1: 실패 테스트 작성**

`src/version-fallback.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { register } from "prom-client";
import { BitmapCacheService } from "./cache-service.js";
import { DEFAULT_BITMAP_TTL_MS, type BitmapCacheEntry } from "./lru-cache.js";
import { bitmapCacheLookupTotal } from "./metrics.js";

const KEY = "bitmap:user:U001:sim.svc.approval:v3";
const PREFIX = "sim.svc.approval";
const fixedEntry = (over: Partial<BitmapCacheEntry> = {}): BitmapCacheEntry => ({
  key: KEY, prefix: PREFIX, prefixVersion: "v3",
  mask: new Uint8Array([0x01, 0x02]), issuedAt: Date.now(), ttlMs: DEFAULT_BITMAP_TTL_MS, ...over,
});
const silent = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

/** version mutable한 catalog mock — pub/sub은 미주입(=100% drop 효과). */
function setup(initialVer: string) {
  let current = initialVer;
  const catalog = {
    bump: (next: string) => { current = next; },
    getLatestPrefixVersion: vi.fn(async () => current),
  };
  const fetchBitmap = vi.fn(async () => ({ prefix: PREFIX, prefixVersion: current, mask: new Uint8Array([0xab]) }));
  const svc = new BitmapCacheService({
    publisherName: "test", cache: { max: 100 }, logger: silent(),
    catalog, authApi: { fetchBitmap },
  });
  return { svc, catalog, fetchBitmap };
}

describe("bitmap version-check fallback (spec 04 §3 — pub/sub drop 회복)", () => {
  beforeEach(() => { bitmapCacheLookupTotal.reset(); });

  it("pub/sub 100% drop + version bump → TTL 만료 이전이라도 version-check fallthrough", async () => {
    const { svc, catalog, fetchBitmap } = setup("v3");
    svc.cache.setEntry(fixedEntry());
    expect(await svc.getBitmap(KEY)).toEqual(new Uint8Array([0x01, 0x02])); // (1) hit
    expect(fetchBitmap).not.toHaveBeenCalled();
    catalog.bump("v4"); // pub/sub drop — subscriber 미도달
    await svc.getBitmap(KEY); // version mismatch → §3.2 fallthrough
    expect(fetchBitmap).toHaveBeenCalledTimes(1);
    expect(svc.cache.getEntry(KEY)?.prefixVersion).toBe("v4");
  });

  it("pub/sub 100% drop + TTL 만료 → §3.2 (2) fallthrough", async () => {
    const { svc, fetchBitmap } = setup("v3");
    svc.cache.setEntry(fixedEntry({ issuedAt: Date.now() - DEFAULT_BITMAP_TTL_MS - 1, ttlMs: 1 }));
    expect(await svc.getBitmap(KEY)).toEqual(new Uint8Array([0xab]));
    expect(fetchBitmap).toHaveBeenCalledTimes(1);
  });

  it("회복 경로 메트릭 — version_mismatch + miss 라벨 모두 증가", async () => {
    const { svc: a, catalog } = setup("v3");
    a.cache.setEntry(fixedEntry()); catalog.bump("v4"); await a.getBitmap(KEY);
    const { svc: b } = setup("v3"); await b.getBitmap(KEY); // miss
    const out = await register.getSingleMetricAsString("bitmap_cache_lookup_total");
    expect(out).toMatch(/result="version_mismatch"\} 1/);
    expect(out).toMatch(/result="miss"\} 1/);
  });
});
```

- [ ] **Step 6.5.2: 테스트 실패 확인**

```bash
pnpm --filter @qa-sdk/sim-bitmap-cache test version-fallback
```

기대: FAIL (Task 6.2/6.4가 미완성이거나, 라벨 정렬 불일치 시).

- [ ] **Step 6.5.3: 최소 구현 — 테스트만 추가, 신규 코드 없음**

본 task는 *행동 단정*만 추가한다. Task 6.2의 `getBitmap` 흐름과 Task 6.4의 `recordBitmapCacheLookup` 호출이 모든 단정을 커버해야 한다. 단정 실패 시 점검: (a) Task 6.2 cache-service.ts의 `recordBitmapCacheLookup("hit"|"miss"|"version_mismatch")` 호출 위치, (b) `bitmapCacheLookupTotal.reset()`이 글로벌 default registry counter를 리셋, (c) catalog 콜라보레이터가 closure mutation으로 *현재* 값 반환.

- [ ] **Step 6.5.4: 테스트 통과 + 단계 6 종료 검증**

```bash
pnpm --filter @qa-sdk/sim-bitmap-cache test
pnpm --filter @qa-sdk/sim-bitmap-cache build
pnpm --filter @qa-sdk/sim-bitmap-cache typecheck
```

기대: 모든 단위 테스트 PASS, `integration.test.ts`는 `SIM_REDIS_URL` 미설정으로 자동 skip, ESM 번들 dist 산출, typecheck 0 에러. spec 04 §3.1 ~ §3.5가 코드에 1:1 매핑된다 — entry 타입(§3.1), 3단계 검증 흐름(§3.2), evict-trigger 격하(§3.3), 시나리오 #16 핵심 메커니즘(§3.4), `/metrics` counter(§3.5).

- [ ] **Step 6.5.5: Commit**

```bash
git add simulations/enterprise-pm/packages/sim-bitmap-cache/src/version-fallback.test.ts
git commit -m "test(sim-bitmap-cache): pub/sub drop + version bump + TTL 만료 회복 단위 테스트 (spec 04 §3.4)"
```
