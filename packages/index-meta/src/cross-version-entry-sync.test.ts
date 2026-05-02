// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * CrossVersionEntrySync 테스트
 * prefix의 모든 활성 버전에 entry를 동일 position으로 전파.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryVersionLifecycleStore } from "./adapters/memory-version-lifecycle.js";
import { InMemoryIndexMetaStore } from "./adapters/memory-store.js";
import { EntryCache } from "./entry-cache.js";
import { CrossVersionEntrySync } from "./cross-version-entry-sync.js";

describe("CrossVersionEntrySync", () => {
  let versions: InMemoryVersionLifecycleStore;
  let store: InMemoryIndexMetaStore;
  let cache: EntryCache;
  let sync: CrossVersionEntrySync;

  beforeEach(() => {
    versions = new InMemoryVersionLifecycleStore();
    store = new InMemoryIndexMetaStore();
    cache = new EntryCache(store);
    sync = new CrossVersionEntrySync(versions, store, cache);
  });

  /** prefix에 schema_version + lifecycle을 함께 세팅하는 헬퍼 */
  async function setupVersion(
    prefix: string,
    versionId: string,
    capacity: number,
    status: "draft" | "released" | "active",
    baseVersionId: string | null = null,
  ) {
    await store.insertSchemaVersion({
      prefix, versionId, capacity, createdAt: new Date().toISOString(),
    });
    await versions.createDraft(prefix, versionId, baseVersionId, capacity);
    if (status === "released" || status === "active") {
      await versions.release(prefix, versionId);
    }
    if (status === "active") {
      await versions.activate(prefix, versionId);
    }
  }

  // ── 기본 동작 ─────────────────────────────────────────────

  it("active 버전에 entry 추가", async () => {
    await setupVersion("role", "v1", 8, "active");

    const result = await sync.addEntry("role", "admin");

    expect(result.position).toBe(1);
    expect(result.added).toEqual(["v1"]);
    expect(result.skipped).toHaveLength(0);

    // store에 실제 저장 확인
    const entry = await store.getEntry("role", "v1", 1);
    expect(entry?.value).toBe("admin");
  });

  it("연속 추가 시 position 증가", async () => {
    await setupVersion("role", "v1", 8, "active");

    const r1 = await sync.addEntry("role", "admin");
    const r2 = await sync.addEntry("role", "editor");
    const r3 = await sync.addEntry("role", "viewer");

    expect(r1.position).toBe(1);
    expect(r2.position).toBe(2);
    expect(r3.position).toBe(3);
  });

  // ── 멀티 버전 전파 ───────────────────────────────────────

  it("active + released 버전에 동일 position으로 전파", async () => {
    await setupVersion("role", "v1", 8, "active");
    await setupVersion("role", "v2", 16, "released", "v1");

    const result = await sync.addEntry("role", "admin");

    expect(result.position).toBe(1);
    expect(result.added).toContain("v1");
    expect(result.added).toContain("v2");

    // 양쪽 모두 같은 position에 저장
    expect((await store.getEntry("role", "v1", 1))?.value).toBe("admin");
    expect((await store.getEntry("role", "v2", 1))?.value).toBe("admin");
  });

  it("active + draft 버전에 동일 position으로 전파", async () => {
    await setupVersion("role", "v1", 8, "active");
    await setupVersion("role", "v2", 16, "draft", "v1");

    const result = await sync.addEntry("role", "admin");

    expect(result.position).toBe(1);
    expect(result.added).toContain("v1");
    expect(result.added).toContain("v2");
  });

  it("deprecated 버전에는 전파하지 않음", async () => {
    await setupVersion("role", "v1", 8, "active");
    // v0를 deprecated로 만들기
    await store.insertSchemaVersion({
      prefix: "role", versionId: "v0", capacity: 4, createdAt: new Date().toISOString(),
    });
    await versions.createDraft("role", "v0", null, 4);
    await versions.release("role", "v0");
    await versions.deprecate("role", "v0");

    const result = await sync.addEntry("role", "admin");

    expect(result.added).toEqual(["v1"]);
    // deprecated v0에는 저장 안됨
    expect(await store.getEntry("role", "v0", 1)).toBeNull();
  });

  // ── capacity 제약 ──────────────────────────────────────────

  it("이전 버전 capacity 부족 시 skip", async () => {
    await setupVersion("role", "v1", 2, "released");
    await setupVersion("role", "v2", 8, "active", "v1");

    // pos 1, 2 추가 → v1도 수용 가능
    await sync.addEntry("role", "admin");
    await sync.addEntry("role", "editor");

    // pos 3 → v1(capacity 2) 수용 불가
    const r3 = await sync.addEntry("role", "viewer");

    expect(r3.position).toBe(3);
    expect(r3.added).toEqual(["v2"]);
    expect(r3.skipped).toEqual([
      { versionId: "v1", reason: "capacity 2 < position 3" },
    ]);
  });

  it("active 버전 capacity 소진 시 에러", async () => {
    await setupVersion("role", "v1", 2, "active");

    await sync.addEntry("role", "admin");
    await sync.addEntry("role", "editor");

    await expect(sync.addEntry("role", "viewer")).rejects.toThrow(/Capacity exhausted/);
  });

  // ── idempotent ─────────────────────────────────────────────

  it("이미 존재하는 value는 기존 position 반환 (idempotent)", async () => {
    await setupVersion("role", "v1", 8, "active");

    const r1 = await sync.addEntry("role", "admin");
    const r2 = await sync.addEntry("role", "admin");

    expect(r2.position).toBe(r1.position);
    expect(r2.added).toHaveLength(0);
    // 단일 writable 버전이므로 skipped 1건 (duplicate)
    expect(r2.skipped).toEqual([{ versionId: "v1", reason: "duplicate" }]);
  });

  it("idempotent — 멀티 버전에서 품질 게이트 완전성 보장", async () => {
    await setupVersion("role", "v1", 8, "released");
    await setupVersion("role", "v2", 8, "active", "v1");
    await setupVersion("role", "v3", 16, "draft", "v2");

    await sync.addEntry("role", "admin");
    const r2 = await sync.addEntry("role", "admin"); // idempotent

    expect(r2.position).toBe(1);
    expect(r2.added).toHaveLength(0);
    // 3개 writable 모두 skipped (duplicate) — 완전성 보장
    expect(r2.skipped).toHaveLength(3);
    expect(r2.skipped.every(s => s.reason === "duplicate")).toBe(true);
    // added + skipped = writable 전체
    expect(r2.added.length + r2.skipped.length).toBe(3);
  });

  // ── 에러 ───────────────────────────────────────────────────

  it("active 버전이 없으면 에러", async () => {
    await setupVersion("role", "v1", 8, "released");

    await expect(sync.addEntry("role", "admin")).rejects.toThrow(/No active version/);
  });

  // ── prefix 격리 ────────────────────────────────────────────

  it("다른 prefix는 서로 영향 없음", async () => {
    await setupVersion("role", "v1", 8, "active");
    await setupVersion("action", "v1", 4, "active");

    await sync.addEntry("role", "admin");
    await sync.addEntry("action", "read");

    expect((await store.getEntry("role", "v1", 1))?.value).toBe("admin");
    expect((await store.getEntry("action", "v1", 1))?.value).toBe("read");
    // role에는 action의 entry가 없음
    expect(await store.getEntry("role", "v1", 2)).toBeNull();
  });

  // ── 3+ 버전 시나리오 ──────────────────────────────────────

  it("3개 버전 (released + active + draft) 동시 전파", async () => {
    await setupVersion("role", "v1", 4, "released");
    await setupVersion("role", "v2", 8, "active", "v1");
    await setupVersion("role", "v3", 16, "draft", "v2");

    const result = await sync.addEntry("role", "admin");

    expect(result.position).toBe(1);
    expect(result.added).toHaveLength(3);
    expect(result.added).toContain("v1");
    expect(result.added).toContain("v2");
    expect(result.added).toContain("v3");

    // 모든 버전에 동일 position
    for (const v of ["v1", "v2", "v3"]) {
      expect((await store.getEntry("role", v, 1))?.value).toBe("admin");
    }
  });

  it("3개 버전 중 가장 오래된 버전만 capacity 부족", async () => {
    await setupVersion("role", "v1", 1, "released");
    await setupVersion("role", "v2", 8, "active", "v1");
    await setupVersion("role", "v3", 16, "draft", "v2");

    await sync.addEntry("role", "admin"); // pos 1 → 전부 수용

    const r2 = await sync.addEntry("role", "editor"); // pos 2 → v1 불가

    expect(r2.position).toBe(2);
    expect(r2.added).toContain("v2");
    expect(r2.added).toContain("v3");
    expect(r2.skipped).toEqual([
      { versionId: "v1", reason: "capacity 1 < position 2" },
    ]);
  });

  // ── EntryCache 동기화 ──────────────────────────────────────

  it("추가 후 EntryCache에서 즉시 조회 가능", async () => {
    await setupVersion("role", "v1", 8, "active");

    await sync.addEntry("role", "admin");

    // cache가 동기화되었으므로 DB 재조회 없이 즉시 반환
    const pos = await cache.getByValue("role", "v1", "admin");
    expect(pos).toBe(1);

    const val = await cache.getByPosition("role", "v1", 1);
    expect(val).toBe("admin");
  });

  // ── 비대칭 기존 상태 ──────────────────────────────────────

  it("released 버전에 이미 값이 있고 active에 없으면 정상 추가", async () => {
    // v1(released)에 직접 entry 삽입 (sync 외부에서 추가된 상태)
    await setupVersion("role", "v1", 8, "released");
    await store.insertEntry({
      prefix: "role", versionId: "v1", position: 1, value: "admin",
      createdAt: new Date().toISOString(),
    });

    // v2(active)는 비어있음
    await setupVersion("role", "v2", 8, "active", "v1");

    // active에서 "admin"은 없으므로 position 1 할당
    const result = await sync.addEntry("role", "admin");

    expect(result.position).toBe(1);
    expect(result.added).toContain("v2");
    // v1은 이미 가지고 있으므로 duplicate skip
    expect(result.skipped).toEqual([
      { versionId: "v1", reason: "duplicate" },
    ]);
  });

  it("released 버전의 해당 position에 다른 값이 점유 시 skip", async () => {
    // v1(released)에 pos 1 = "superadmin" (다른 값)
    await setupVersion("role", "v1", 8, "released");
    await store.insertEntry({
      prefix: "role", versionId: "v1", position: 1, value: "superadmin",
      createdAt: new Date().toISOString(),
    });

    // v2(active)는 비어있음
    await setupVersion("role", "v2", 8, "active", "v1");

    const result = await sync.addEntry("role", "admin");

    expect(result.position).toBe(1);
    expect(result.added).toContain("v2");
    // v1의 pos 1은 "superadmin"이 점유 → skip
    expect(result.skipped).toEqual([
      { versionId: "v1", reason: 'position 1 occupied by "superadmin"' },
    ]);
  });

  // ── position 결정 안정성 ───────────────────────────────────

  it("sparse entries가 있어도 maxPos 기준으로 position 결정", async () => {
    await setupVersion("role", "v1", 8, "active");

    // pos 1, 2를 수동 삽입 후 pos 2를 건너뛴 듯한 상황 시뮬레이션은 불가
    // (sync는 항상 순차적이므로) 대신 수동으로 pos 1, 3을 삽입
    await store.insertEntry({
      prefix: "role", versionId: "v1", position: 1, value: "admin",
      createdAt: new Date().toISOString(),
    });
    await store.insertEntry({
      prefix: "role", versionId: "v1", position: 3, value: "viewer",
      createdAt: new Date().toISOString(),
    });

    // cache를 무효화해서 store에서 다시 로드
    cache.invalidate("role", "v1");

    // maxPos = 3이므로 다음은 4
    const result = await sync.addEntry("role", "editor");
    expect(result.position).toBe(4);
  });

  // ── capacity 경계값 ────────────────────────────────────────

  it("capacity 정확히 도달 시 마지막 entry 성공", async () => {
    await setupVersion("role", "v1", 3, "active");

    await sync.addEntry("role", "admin");   // pos 1
    await sync.addEntry("role", "editor");  // pos 2
    const r3 = await sync.addEntry("role", "viewer"); // pos 3 = capacity

    expect(r3.position).toBe(3);
    expect(r3.added).toContain("v1");
  });

  it("capacity 초과 직전까지 성공, 초과 시 에러", async () => {
    await setupVersion("role", "v1", 1, "active");

    const r1 = await sync.addEntry("role", "admin");
    expect(r1.position).toBe(1);

    await expect(sync.addEntry("role", "editor")).rejects.toThrow(/Capacity exhausted/);
  });

  // ── 멀티 버전 EntryCache 동기화 ────────────────────────────

  it("멀티 버전 추가 후 각 버전 EntryCache가 모두 동기화됨", async () => {
    await setupVersion("role", "v1", 8, "released");
    await setupVersion("role", "v2", 8, "active", "v1");

    await sync.addEntry("role", "admin");
    await sync.addEntry("role", "editor");

    // 각 버전 캐시에서 즉시 조회
    for (const v of ["v1", "v2"]) {
      expect(await cache.getByValue("role", v, "admin")).toBe(1);
      expect(await cache.getByValue("role", v, "editor")).toBe(2);
      expect(await cache.getByPosition("role", v, 1)).toBe("admin");
      expect(await cache.getByPosition("role", v, 2)).toBe("editor");
    }
  });

  // ── 대량 추가 ──────────────────────────────────────────────

  it("capacity까지 연속 추가 시 position 연속성 보장", async () => {
    const cap = 32;
    await setupVersion("role", "v1", cap, "active");

    for (let i = 1; i <= cap; i++) {
      const r = await sync.addEntry("role", `entry_${i}`);
      expect(r.position).toBe(i);
    }

    // capacity 소진
    await expect(sync.addEntry("role", "overflow")).rejects.toThrow(/Capacity exhausted/);

    // 모든 entry가 순서대로 저장됨
    const entries = await store.getEntries("role", "v1");
    expect(entries).toHaveLength(cap);
    expect(entries[0].value).toBe("entry_1");
    expect(entries[cap - 1].value).toBe(`entry_${cap}`);
  });

  // ── 품질 게이트 ────────────────────────────────────────────

  describe("품질 게이트: 사후 불변식", () => {
    it("added + skipped = 전체 writable 버전 (완전성)", async () => {
      await setupVersion("role", "v1", 2, "released");
      await setupVersion("role", "v2", 8, "active", "v1");
      await setupVersion("role", "v3", 16, "draft", "v2");

      // capacity 넘는 추가로 v1이 skip됨
      await sync.addEntry("role", "a");
      await sync.addEntry("role", "b");
      const result = await sync.addEntry("role", "c"); // v1 skip

      // added + skipped = 3 (모든 writable)
      expect(result.added.length + result.skipped.length).toBe(3);
    });

    it("active 버전은 항상 added에 포함 (새 entry 시)", async () => {
      await setupVersion("role", "v1", 2, "released");
      await setupVersion("role", "v2", 8, "active", "v1");

      const r1 = await sync.addEntry("role", "admin");
      expect(r1.added).toContain("v2");

      const r2 = await sync.addEntry("role", "editor");
      expect(r2.added).toContain("v2");
    });

    it("모든 added 버전은 store에 동일 position·value로 저장됨 (일관성)", async () => {
      await setupVersion("role", "v1", 8, "released");
      await setupVersion("role", "v2", 8, "active", "v1");
      await setupVersion("role", "v3", 8, "draft", "v2");

      const values = ["admin", "editor", "viewer"];
      for (const val of values) {
        const result = await sync.addEntry("role", val);
        // 모든 added 버전에서 같은 position + value 확인
        for (const vId of result.added) {
          const entry = await store.getEntry("role", vId, result.position);
          expect(entry).not.toBeNull();
          expect(entry!.value).toBe(val);
          expect(entry!.position).toBe(result.position);
        }
      }
    });

    it("skipped 버전에는 해당 value가 신규 삽입되지 않음 (no phantom)", async () => {
      await setupVersion("role", "v1", 1, "released");
      await setupVersion("role", "v2", 8, "active", "v1");

      await sync.addEntry("role", "admin"); // pos 1 → 둘 다 성공
      const r2 = await sync.addEntry("role", "editor"); // pos 2 → v1 skip

      expect(r2.skipped.length).toBeGreaterThan(0);
      for (const s of r2.skipped) {
        // skip된 버전에 "editor" 값이 없어야 함
        const entry = await store.getEntryByValue("role", s.versionId, "editor");
        expect(entry).toBeNull();
      }
    });

    it("position은 항상 단조 증가 (monotonicity)", async () => {
      await setupVersion("role", "v1", 16, "active");

      let prevPos = 0;
      for (const val of ["a", "b", "c", "d", "e"]) {
        const result = await sync.addEntry("role", val);
        expect(result.position).toBeGreaterThan(prevPos);
        prevPos = result.position;
      }
    });

    it("non-active store 에러 시 skip 처리 (best-effort)", async () => {
      // v1(released)에 schema_version을 등록하지 않아 insertEntry 시 에러 유발
      await versions.createDraft("role", "v1", null, 8);
      await versions.release("role", "v1");
      // store에는 schema_version 없음 → insertEntry에서 validation error

      await setupVersion("role", "v2", 8, "active", "v1");

      const result = await sync.addEntry("role", "admin");

      // active(v2)는 성공
      expect(result.added).toContain("v2");
      // v1은 store error로 skip
      expect(result.skipped).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            versionId: "v1",
            reason: expect.stringContaining("store error"),
          }),
        ]),
      );
    });
  });

  // ── applyEntryBatch + CrossVersionEntrySync 통합 ──────────

  describe("applyEntryBatch + sync 통합", () => {
    it("sync 제공 시 모든 writable 버전에 전파", async () => {
      const { applyEntryBatch } = await import("./api-payload.js");
      const { InMemoryPrefixRegistry } = await import("./adapters/memory-prefix-registry.js");

      const registry = new InMemoryPrefixRegistry();

      await setupVersion("role", "v1", 8, "released");
      await setupVersion("role", "v2", 8, "active", "v1");

      const payload = {
        capacity: 8,
        entries: { "1": "admin", "2": "editor", "3": "viewer" },
      };

      await applyEntryBatch("role", "v2", payload, registry, store, undefined, sync);

      // 양쪽 버전에 모두 저장됨
      expect((await store.getEntries("role", "v1")).map(e => e.value))
        .toEqual(["admin", "editor", "viewer"]);
      expect((await store.getEntries("role", "v2")).map(e => e.value))
        .toEqual(["admin", "editor", "viewer"]);
    });

    it("sync 미제공 시 단일 버전에만 삽입 (기존 동작)", async () => {
      const { applyEntryBatch } = await import("./api-payload.js");
      const { InMemoryPrefixRegistry } = await import("./adapters/memory-prefix-registry.js");

      const registry = new InMemoryPrefixRegistry();

      await setupVersion("role", "v1", 8, "released");
      await setupVersion("role", "v2", 8, "active", "v1");

      const payload = {
        capacity: 8,
        entries: { "1": "admin", "2": "editor" },
      };

      // sync 없이 호출 → v2에만 삽입
      await applyEntryBatch("role", "v2", payload, registry, store);

      expect((await store.getEntries("role", "v2")).map(e => e.value))
        .toEqual(["admin", "editor"]);
      // v1에는 전파 안 됨
      expect(await store.getEntries("role", "v1")).toEqual([]);
    });
  });
});
