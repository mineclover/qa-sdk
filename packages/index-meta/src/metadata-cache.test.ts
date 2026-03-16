/**
 * MetadataCache — 메타데이터 캐싱 + Active 수렴 테스트
 *
 * [M1] 기본 CRUD 캐싱 — set/get/getAll/delete 시 캐시 동작
 * [M2] TTL — 시간 기반 만료
 * [M3] invalidation — set/delete 후 stale 데이터 없음
 * [M4] Active 수렴 — 어떤 버전 주소든 동일 position으로 메타데이터 접근
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InMemoryEntryMetadataStore } from "./adapters/memory-entry-metadata-store.js";
import { MetadataCache } from "./metadata-cache.js";

// ── [M1] 기본 CRUD 캐싱 ────────────────────────────────────

describe("[M1] MetadataCache — 기본 CRUD 캐싱", () => {
  it("set → get 캐시에서 반환", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store);

    await cache.set("role", 1, "display_name", "관리자");
    expect(await cache.get("role", 1, "display_name")).toBe("관리자");
  });

  it("get — store에서 fetch 후 캐시에 적재", async () => {
    const store = new InMemoryEntryMetadataStore();
    await store.set("role", 1, "icon", "shield");

    const cache = new MetadataCache(store);

    // 첫 접근: store에서 fetch
    expect(await cache.get("role", 1, "icon")).toBe("shield");
    // 두 번째 접근: 캐시에서 반환 (store 직접 변경해도 캐시 값 유지)
    await store.set("role", 1, "icon", "changed-directly");
    expect(await cache.get("role", 1, "icon")).toBe("shield"); // 캐시된 값
  });

  it("getAll — position 전체 메타데이터 캐싱", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store);

    await cache.set("role", 1, "display_name", "관리자");
    await cache.set("role", 1, "icon", "shield");

    const all = await cache.getAll("role", 1);
    expect(Object.keys(all)).toHaveLength(2);
    expect(all["display_name"]).toBe("관리자");
    expect(all["icon"]).toBe("shield");
  });

  it("delete → 캐시에서 즉시 제거", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store);

    await cache.set("role", 1, "icon", "shield");
    expect(await cache.get("role", 1, "icon")).toBe("shield");

    await cache.delete("role", 1, "icon");
    expect(await cache.get("role", 1, "icon")).toBeNull();
  });

  it("findByKey — 캐시 미적용, store 직접 조회", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store);

    await cache.set("config", 1, "value", "dark");
    await cache.set("config", 2, "value", "ko-KR");
    await cache.set("config", 3, "value", "Asia/Seoul");

    const results = await cache.findByKey("config", "value");
    expect(results).toHaveLength(3);
    expect(results[0]!.position).toBe(1);
    expect(results[0]!.value).toBe("dark");
  });

  it("clear — 전체 캐시 초기화", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store);

    await cache.set("role", 1, "name", "admin");
    await cache.get("role", 1, "name"); // 캐시에 적재
    expect(cache.size).toBeGreaterThan(0);

    cache.clear();
    expect(cache.size).toBe(0);
  });
});

// ── [M2] TTL ────────────────────────────────────────────────

describe("[M2] MetadataCache — TTL 기반 만료", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("TTL 내 → 캐시에서 반환", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store, { ttl: 1000 });

    await cache.set("role", 1, "icon", "shield");
    expect(await cache.get("role", 1, "icon")).toBe("shield");

    // store 직접 변경
    await store.set("role", 1, "icon", "changed");

    // TTL 내: 캐시 값 유지
    vi.advanceTimersByTime(500);
    expect(await cache.get("role", 1, "icon")).toBe("shield");
  });

  it("TTL 초과 → store에서 재fetch", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store, { ttl: 1000 });

    await store.set("role", 1, "icon", "shield");
    expect(await cache.get("role", 1, "icon")).toBe("shield");

    // store 직접 변경
    await store.set("role", 1, "icon", "crown");

    // TTL 초과
    vi.advanceTimersByTime(1500);
    expect(await cache.get("role", 1, "icon")).toBe("crown"); // 재fetch
  });

  it("getAll도 TTL 적용", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store, { ttl: 500 });

    await store.set("role", 1, "a", "1");
    await store.set("role", 1, "b", "2");

    const first = await cache.getAll("role", 1);
    expect(Object.keys(first)).toHaveLength(2);

    // store에 새 키 추가
    await store.set("role", 1, "c", "3");

    // TTL 내: 이전 캐시
    expect(Object.keys(await cache.getAll("role", 1))).toHaveLength(2);

    // TTL 초과: 재fetch (3개)
    vi.advanceTimersByTime(600);
    expect(Object.keys(await cache.getAll("role", 1))).toHaveLength(3);
  });
});

// ── [M3] Invalidation ───────────────────────────────────────

describe("[M3] MetadataCache — set/delete 후 일관성", () => {
  it("set으로 값 변경 → 이전 캐시 무효화", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store);

    await cache.set("role", 1, "icon", "shield");
    expect(await cache.get("role", 1, "icon")).toBe("shield");

    // 같은 키에 새 값 set
    await cache.set("role", 1, "icon", "crown");
    expect(await cache.get("role", 1, "icon")).toBe("crown");
  });

  it("set 후 getAll 캐시도 갱신", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store);

    await cache.set("role", 1, "a", "1");
    await cache.set("role", 1, "b", "2");

    // getAll 캐시 적재
    const first = await cache.getAll("role", 1);
    expect(Object.keys(first)).toHaveLength(2);

    // 새 키 추가
    await cache.set("role", 1, "c", "3");

    // getAll이 새 값을 포함
    const second = await cache.getAll("role", 1);
    expect(Object.keys(second)).toHaveLength(3);
    expect(second["c"]).toBe("3");
  });

  it("delete 후 getAll 캐시 갱신", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store);

    await cache.set("role", 1, "a", "1");
    await cache.set("role", 1, "b", "2");

    const first = await cache.getAll("role", 1);
    expect(Object.keys(first)).toHaveLength(2);

    await cache.delete("role", 1, "a");

    const second = await cache.getAll("role", 1);
    expect(Object.keys(second)).toHaveLength(1);
    expect(second["b"]).toBe("2");
  });

  it("invalidate() 수동 호출 → 다음 접근 시 재fetch", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store);

    await store.set("role", 1, "icon", "shield");
    expect(await cache.get("role", 1, "icon")).toBe("shield");

    // store 직접 변경 + 수동 invalidate
    await store.set("role", 1, "icon", "star");
    cache.invalidate("role", 1);

    expect(await cache.get("role", 1, "icon")).toBe("star");
  });
});

// ── [M4] Active 수렴 ────────────────────────────────────────

describe("[M4] Active 수렴 — 버전 무관 position 기반 메타데이터", () => {
  it("같은 position의 메타데이터는 버전에 관계없이 동일", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store);

    // position 1 = "admin" (모든 버전에서 동일)
    await cache.set("role", 1, "display_name", "관리자");
    await cache.set("role", 1, "icon", "shield");
    await cache.set("role", 1, "color", "#ff0000");

    // v1에서 addr 1로 접근하든, v2에서 접근하든 position 1의 메타데이터는 동일
    // (position이 불변이므로 version 컬럼 불필요)
    const meta = await cache.getAll("role", 1);
    expect(meta).toEqual({
      display_name: "관리자",
      icon: "shield",
      color: "#ff0000",
    });
  });

  it("비활성화된 position도 메타데이터 접근 가능 (읽기 전용)", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store);

    // v1: pos 3 = "viewer" → active
    // v3: pos 3 = deactivated
    // 메타데이터는 여전히 position 3으로 접근 가능
    await cache.set("role", 3, "display_name", "일반 사용자");
    await cache.set("role", 3, "deprecated_at", "2026-03-01");
    await cache.set("role", 3, "deprecated_reason", "viewer 역할 통합");

    const meta = await cache.getAll("role", 3);
    expect(meta["display_name"]).toBe("일반 사용자");
    expect(meta["deprecated_reason"]).toBe("viewer 역할 통합");
  });

  it("1D prefix 메타데이터 — 설정값 관리", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store);

    // 1D config prefix: position이 곧 entry 식별자
    await cache.set("config", 1, "value", "dark");   // theme
    await cache.set("config", 2, "value", "ko-KR");  // locale
    await cache.set("config", 3, "value", "Asia/Seoul"); // timezone

    // findByKey로 모든 설정값 한번에 조회
    const allValues = await cache.findByKey("config", "value");
    expect(allValues).toHaveLength(3);
    expect(allValues.map((v) => v.value)).toEqual(["dark", "ko-KR", "Asia/Seoul"]);
  });

  it("composite address를 position으로 사용 — nD 메타데이터", async () => {
    const store = new InMemoryEntryMetadataStore();
    const cache = new MetadataCache(store);

    // perm index: role(4) × action(3) × resource(3) = 36
    // composite address 20 = admin + read + report (예시)
    // 이 주소에 메타데이터를 직접 연결
    await cache.set("perm", 20, "description", "리포트 읽기 권한");
    await cache.set("perm", 20, "risk_level", "low");
    await cache.set("perm", 20, "audit_required", false);

    const meta = await cache.getAll("perm", 20);
    expect(meta["description"]).toBe("리포트 읽기 권한");
    expect(meta["risk_level"]).toBe("low");
    expect(meta["audit_required"]).toBe(false);
  });
});
