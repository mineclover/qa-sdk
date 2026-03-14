/**
 * E2E: PrefixRegistry + 백업/복원 + API 전송
 *
 * 흐름:
 *   PrefixRegistry (중앙) ← capacity 조회
 *   IndexMetaStore  (D1)  ← entry 저장/조회
 *   exportVersion / importVersion — versionId 단위 백업/복원
 *   applyEntryBatch — API 수신 → 적재
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryPrefixRegistry } from "./adapters/memory-prefix-registry.js";
import { InMemoryIndexMetaStore } from "./adapters/memory-store.js";
import { exportVersion, importVersion } from "./backup.js";
import { applyEntryBatch, validateEntryBatchPayload } from "./api-payload.js";
import { ValidationError } from "./errors.js";
import type { EntryBatchPayload } from "./api-payload.js";

// ── 공통 픽스처 ────────────────────────────────────────────

const ROLE_V1_PAYLOAD: EntryBatchPayload = {
  capacity: 1000,
  entries: {
    "1":   "guest",
    "2":   "viewer",
    "3":   "editor",
    "4":   "_",      // null marker
    "5":   "admin",
    "6":   "super_admin",
    "140": "NaN",    // NaN marker
    "999": "~",      // other marker
  },
};

// ── PrefixRegistry ────────────────────────────────────────

describe("PrefixRegistry — 중앙 capacity 관리", () => {
  it("register 후 getCapacity로 즉시 조회된다", async () => {
    const registry = new InMemoryPrefixRegistry();
    await registry.register({ prefix: "role", versionId: "v1", capacity: 1000 });

    expect(await registry.getCapacity("role", "v1")).toBe(1000);
  });

  it("미등록 (prefix, versionId)는 null을 반환한다", async () => {
    const registry = new InMemoryPrefixRegistry();
    expect(await registry.getCapacity("role", "v99")).toBeNull();
  });

  it("중복 등록은 ValidationError", async () => {
    const registry = new InMemoryPrefixRegistry();
    await registry.register({ prefix: "role", versionId: "v1", capacity: 1000 });
    await expect(
      registry.register({ prefix: "role", versionId: "v1", capacity: 2000 })
    ).rejects.toThrow(ValidationError);
  });

  it("composite도 capacity만 등록할 수 있다 (entry 없음)", async () => {
    const registry = new InMemoryPrefixRegistry();
    await registry.register({ prefix: "role",   versionId: "v1", capacity: 8    });
    await registry.register({ prefix: "action", versionId: "v1", capacity: 4    });
    await registry.register({ prefix: "perm",   versionId: "v1", capacity: 8*4  }); // composite

    expect(await registry.getCapacity("perm", "v1")).toBe(32);
  });

  it("listAll로 전체 레지스트리를 조회한다", async () => {
    const registry = new InMemoryPrefixRegistry();
    await registry.register({ prefix: "role",   versionId: "v1", capacity: 8  });
    await registry.register({ prefix: "role",   versionId: "v2", capacity: 16 });
    await registry.register({ prefix: "action", versionId: "v1", capacity: 4  });

    const all = await registry.listAll();
    expect(all).toHaveLength(3);
    expect(all.map((r) => r.prefix).sort()).toEqual(["action", "role", "role"]);
  });
});

// ── API 전송: EntryBatchPayload ───────────────────────────

describe("applyEntryBatch — API 수신 → 적재", () => {
  let registry: InMemoryPrefixRegistry;
  let store: InMemoryIndexMetaStore;

  beforeEach(() => {
    registry = new InMemoryPrefixRegistry();
    store    = new InMemoryIndexMetaStore();
  });

  it("payload를 수신하면 PrefixRegistry와 store에 동시 적재된다", async () => {
    await applyEntryBatch("role", "v1", ROLE_V1_PAYLOAD, registry, store, "2026-01-01T00:00:00Z");

    expect(await registry.getCapacity("role", "v1")).toBe(1000);
    expect(await store.getSchemaVersion("role", "v1")).toBeDefined();

    const entries = await store.getEntries("role", "v1");
    expect(entries).toHaveLength(Object.keys(ROLE_V1_PAYLOAD.entries).length);
  });

  it("예약 마커도 일반 entry와 동일하게 적재된다", async () => {
    await applyEntryBatch("role", "v1", ROLE_V1_PAYLOAD, registry, store, "2026-01-01T00:00:00Z");

    expect((await store.getEntry("role", "v1", 4))?.value).toBe("_");
    expect((await store.getEntry("role", "v1", 140))?.value).toBe("NaN");
    expect((await store.getEntry("role", "v1", 999))?.value).toBe("~");
  });

  it("같은 (prefix, versionId)에 두 번 전송하면 새 entry만 추가된다 (idempotent)", async () => {
    await applyEntryBatch("role", "v1", ROLE_V1_PAYLOAD, registry, store, "2026-01-01T00:00:00Z");

    // 이후 추가 전송 — 새 position만 포함
    const additionalPayload: EntryBatchPayload = {
      capacity: 1000,
      entries: { "10": "moderator" },
    };
    await applyEntryBatch("role", "v1", additionalPayload, registry, store, "2026-03-01T00:00:00Z");

    const entries = await store.getEntries("role", "v1");
    expect(entries.some((e) => e.value === "moderator")).toBe(true);
    expect(entries.find((e) => e.value === "guest")?.value).toBe("guest"); // 기존 유지
  });

  it("capacity 불일치 시 ValidationError", async () => {
    await applyEntryBatch("role", "v1", ROLE_V1_PAYLOAD, registry, store, "2026-01-01T00:00:00Z");

    const badPayload: EntryBatchPayload = { capacity: 500, entries: {} }; // 불일치
    await expect(
      applyEntryBatch("role", "v1", badPayload, registry, store)
    ).rejects.toThrow(ValidationError);
  });
});

// ── validateEntryBatchPayload ─────────────────────────────

describe("validateEntryBatchPayload — payload 검증", () => {
  it("capacity가 0이면 ValidationError", () => {
    expect(() =>
      validateEntryBatchPayload({ capacity: 0, entries: {} })
    ).toThrow(ValidationError);
  });

  it("position이 capacity를 초과하면 ValidationError", () => {
    expect(() =>
      validateEntryBatchPayload({ capacity: 10, entries: { "11": "x" } })
    ).toThrow(ValidationError);
  });

  it("position이 0이면 ValidationError", () => {
    expect(() =>
      validateEntryBatchPayload({ capacity: 10, entries: { "0": "x" } })
    ).toThrow(ValidationError);
  });

  it("value가 빈 문자열이면 ValidationError", () => {
    expect(() =>
      validateEntryBatchPayload({ capacity: 10, entries: { "1": "" } })
    ).toThrow(ValidationError);
  });

  it("정상 payload는 에러 없이 통과한다", () => {
    expect(() =>
      validateEntryBatchPayload(ROLE_V1_PAYLOAD)
    ).not.toThrow();
  });
});

// ── 백업/복원: exportVersion / importVersion ──────────────

describe("exportVersion / importVersion — versionId 단위 백업/복원", () => {
  it("exportVersion이 올바른 VersionBackup을 생성한다", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store    = new InMemoryIndexMetaStore();

    await applyEntryBatch("role", "v1", ROLE_V1_PAYLOAD, registry, store, "2026-01-01T00:00:00Z");

    const backup = await exportVersion("role", "v1", registry, store, "2026-03-15T00:00:00Z");

    expect(backup.format).toBe("index-meta/v1");
    expect(backup.prefix).toBe("role");
    expect(backup.versionId).toBe("v1");
    expect(backup.capacity).toBe(1000);
    expect(backup.entries["1"]).toBe("guest");
    expect(backup.entries["4"]).toBe("_");     // null marker 보존
    expect(backup.entries["140"]).toBe("NaN"); // NaN marker 보존
    expect(backup.entries["999"]).toBe("~");   // other marker 보존
  });

  it("exportVersion — 빈 position은 entries에 없다 (sparse)", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store    = new InMemoryIndexMetaStore();

    await applyEntryBatch("role", "v1", ROLE_V1_PAYLOAD, registry, store, "2026-01-01T00:00:00Z");

    const backup = await exportVersion("role", "v1", registry, store);
    const positionCount = Object.keys(backup.entries).length;

    expect(positionCount).toBe(Object.keys(ROLE_V1_PAYLOAD.entries).length);
    expect(backup.entries["1000"]).toBeUndefined(); // 빈 주소
  });

  it("importVersion으로 새 registry + store에 완전히 복원된다", async () => {
    // 원본에서 백업 생성
    const srcRegistry = new InMemoryPrefixRegistry();
    const srcStore    = new InMemoryIndexMetaStore();
    await applyEntryBatch("role", "v1", ROLE_V1_PAYLOAD, srcRegistry, srcStore, "2026-01-01T00:00:00Z");
    const backup = await exportVersion("role", "v1", srcRegistry, srcStore);

    // 새 인스턴스에 복원
    const dstRegistry = new InMemoryPrefixRegistry();
    const dstStore    = new InMemoryIndexMetaStore();
    await importVersion(backup, dstRegistry, dstStore);

    // capacity 동일
    expect(await dstRegistry.getCapacity("role", "v1")).toBe(1000);

    // 값과 position은 동일 (createdAt은 복원 시점이므로 제외)
    const srcEntries = await srcStore.getEntries("role", "v1");
    const dstEntries = await dstStore.getEntries("role", "v1");
    const toComparable = (e: typeof srcEntries[0]) => ({ position: e.position, value: e.value });
    expect(dstEntries.map(toComparable)).toEqual(srcEntries.map(toComparable));
    expect(dstEntries).toHaveLength(srcEntries.length);
  });

  it("versionId 단위로 개별 백업/복원이 가능하다", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store    = new InMemoryIndexMetaStore();

    // v1, v2 모두 적재
    await applyEntryBatch("role", "v1", { capacity: 8,  entries: { "1": "admin", "2": "viewer" } }, registry, store, "2026-01-01T00:00:00Z");
    await applyEntryBatch("role", "v2", { capacity: 16, entries: { "1": "admin", "2": "viewer", "3": "guest" } }, registry, store, "2026-06-01T00:00:00Z");

    // v1만 백업
    const backupV1 = await exportVersion("role", "v1", registry, store);
    // v2만 백업
    const backupV2 = await exportVersion("role", "v2", registry, store);

    expect(backupV1.versionId).toBe("v1");
    expect(backupV1.capacity).toBe(8);
    expect(Object.keys(backupV1.entries)).toHaveLength(2);

    expect(backupV2.versionId).toBe("v2");
    expect(backupV2.capacity).toBe(16);
    expect(Object.keys(backupV2.entries)).toHaveLength(3);
  });

  it("composite 테이블은 entries 없이 capacity만 백업된다", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store    = new InMemoryIndexMetaStore();

    // composite는 capacity만 등록 (entry 없음)
    await registry.register({ prefix: "perm", versionId: "v1", capacity: 32 });
    await store.insertSchemaVersion({ tableId: "perm", versionId: "v1", capacity: 32, createdAt: "2026-01-01T00:00:00Z" });

    const backup = await exportVersion("perm", "v1", registry, store);

    expect(backup.capacity).toBe(32);
    expect(backup.entries).toEqual({}); // entry 없음
  });

  it("importVersion — 알 수 없는 format은 ValidationError", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store    = new InMemoryIndexMetaStore();

    const badBackup = { format: "unknown/v99", prefix: "role", versionId: "v1", capacity: 8, entries: {} } as any;

    await expect(importVersion(badBackup, registry, store)).rejects.toThrow(ValidationError);
  });

  it("exportVersion — PrefixRegistry에 없는 버전은 ValidationError", async () => {
    const registry = new InMemoryPrefixRegistry();
    const store    = new InMemoryIndexMetaStore();

    await expect(
      exportVersion("role", "v99", registry, store)
    ).rejects.toThrow(ValidationError);
  });
});
