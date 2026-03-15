import { describe, it, expect } from "vitest";
import { InMemoryIndexMetaStore } from "./memory-store.js";
import { ValidationError } from "../errors.js";

// ── 공통 픽스처 ────────────────────────────────────────────

const versionRecord = (overrides = {}) => ({
  prefix: "role",
  versionId: "v1",
  capacity: 8,
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const entryRecord = (overrides = {}) => ({
  prefix: "role",
  versionId: "v1",
  position: 1,
  value: "admin",
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

// ── insertSchemaVersion ───────────────────────────────────

describe("insertSchemaVersion", () => {
  it("정상 삽입 후 getSchemaVersion으로 조회된다", async () => {
    const store = new InMemoryIndexMetaStore();
    const record = versionRecord();
    await store.insertSchemaVersion(record);

    const result = await store.getSchemaVersion("role", "v1");
    expect(result).toEqual(record);
  });

  it("중복 (prefix, versionId)는 ValidationError", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord());
    await expect(store.insertSchemaVersion(versionRecord())).rejects.toThrow(ValidationError);
  });

  it("같은 prefix라도 versionId가 다르면 삽입된다", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord({ versionId: "v1", capacity: 8 }));
    await store.insertSchemaVersion(versionRecord({ versionId: "v2", capacity: 16 }));

    expect(await store.getSchemaVersion("role", "v1")).toBeDefined();
    expect(await store.getSchemaVersion("role", "v2")).toBeDefined();
  });
});

// ── getSchemaVersions ─────────────────────────────────────

describe("getSchemaVersions", () => {
  it("createdAt 오름차순으로 반환된다", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord({ versionId: "v2", createdAt: "2026-06-01T00:00:00Z" }));
    await store.insertSchemaVersion(versionRecord({ versionId: "v1", createdAt: "2026-01-01T00:00:00Z" }));

    const versions = await store.getSchemaVersions("role");
    expect(versions.map((v) => v.versionId)).toEqual(["v1", "v2"]);
  });

  it("등록된 버전이 없으면 빈 배열을 반환한다", async () => {
    const store = new InMemoryIndexMetaStore();
    expect(await store.getSchemaVersions("role")).toEqual([]);
  });

  it("다른 prefix의 버전은 포함되지 않는다", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord({ prefix: "role" }));
    await store.insertSchemaVersion(versionRecord({ prefix: "action" }));

    const versions = await store.getSchemaVersions("role");
    expect(versions.every((v) => v.prefix === "role")).toBe(true);
    expect(versions).toHaveLength(1);
  });
});

// ── getCapacity ───────────────────────────────────────────

describe("getCapacity", () => {
  it("등록된 버전의 capacity를 반환한다", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord({ capacity: 8 }));
    expect(await store.getCapacity("role", "v1")).toBe(8);
  });

  it("없는 버전은 null을 반환한다", async () => {
    const store = new InMemoryIndexMetaStore();
    expect(await store.getCapacity("role", "v99")).toBeNull();
  });
});

// ── insertEntry ───────────────────────────────────────────

describe("insertEntry", () => {
  it("schema_version이 먼저 없으면 ValidationError", async () => {
    const store = new InMemoryIndexMetaStore();
    await expect(store.insertEntry(entryRecord())).rejects.toThrow(ValidationError);
  });

  it("schema_version 등록 후 entry를 삽입할 수 있다", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord());
    await store.insertEntry(entryRecord({ position: 1, value: "admin" }));

    const result = await store.getEntry("role", "v1", 1);
    expect(result?.value).toBe("admin");
  });

  it("position이 1보다 작으면 ValidationError", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord());
    await expect(store.insertEntry(entryRecord({ position: 0 }))).rejects.toThrow(ValidationError);
  });

  it("position이 capacity를 초과하면 ValidationError", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord({ capacity: 8 }));
    await expect(store.insertEntry(entryRecord({ position: 9 }))).rejects.toThrow(ValidationError);
  });

  it("중복 position은 ValidationError", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord());
    await store.insertEntry(entryRecord({ position: 1 }));
    await expect(store.insertEntry(entryRecord({ position: 1, value: "editor" }))).rejects.toThrow(ValidationError);
  });

  it("schema_version 등록 후 언제든 capacity 범위 내 entry를 추가할 수 있다 (버전 불필요)", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord({ capacity: 8 }));

    // 초기 3개
    await store.insertEntry(entryRecord({ position: 1, value: "guest" }));
    await store.insertEntry(entryRecord({ position: 2, value: "viewer" }));
    await store.insertEntry(entryRecord({ position: 3, value: "editor" }));

    // 나중에 추가
    await store.insertEntry(entryRecord({ position: 4, value: "admin", createdAt: "2026-03-01T00:00:00Z" }));

    const entries = await store.getEntries("role", "v1");
    expect(entries).toHaveLength(4);
    expect(entries[3].value).toBe("admin");
  });
});

// ── getEntries ────────────────────────────────────────────

describe("getEntries", () => {
  it("position 오름차순으로 반환된다", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord());
    await store.insertEntry(entryRecord({ position: 3, value: "editor" }));
    await store.insertEntry(entryRecord({ position: 1, value: "guest" }));
    await store.insertEntry(entryRecord({ position: 2, value: "viewer" }));

    const entries = await store.getEntries("role", "v1");
    expect(entries.map((e) => e.position)).toEqual([1, 2, 3]);
  });

  it("빈 position은 결과에 포함되지 않는다 (sparse)", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord({ capacity: 8 }));
    await store.insertEntry(entryRecord({ position: 1 }));
    await store.insertEntry(entryRecord({ position: 5, value: "admin" }));

    const entries = await store.getEntries("role", "v1");
    expect(entries.map((e) => e.position)).toEqual([1, 5]);
  });

  it("등록된 entry가 없으면 빈 배열을 반환한다", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord());
    expect(await store.getEntries("role", "v1")).toEqual([]);
  });
});

// ── getEntriesInRange ─────────────────────────────────────

describe("getEntriesInRange", () => {
  it("[from, to] 범위 내 entry만 반환한다 (inclusive)", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord({ capacity: 8 }));
    for (let i = 1; i <= 6; i++) {
      await store.insertEntry(entryRecord({ position: i, value: `entry-${i}` }));
    }

    const result = await store.getEntriesInRange("role", "v1", 2, 4);
    expect(result.map((e) => e.position)).toEqual([2, 3, 4]);
  });

  it("범위 내 빈 position은 포함되지 않는다", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord({ capacity: 8 }));
    await store.insertEntry(entryRecord({ position: 1 }));
    await store.insertEntry(entryRecord({ position: 4, value: "admin" }));

    const result = await store.getEntriesInRange("role", "v1", 1, 4);
    expect(result.map((e) => e.position)).toEqual([1, 4]);
  });

  it("범위 내 항목이 없으면 빈 배열을 반환한다", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord({ capacity: 8 }));
    await store.insertEntry(entryRecord({ position: 1 }));

    const result = await store.getEntriesInRange("role", "v1", 5, 8);
    expect(result).toEqual([]);
  });

  it("position 오름차순으로 반환된다", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord({ capacity: 8 }));
    await store.insertEntry(entryRecord({ position: 3, value: "c" }));
    await store.insertEntry(entryRecord({ position: 1, value: "a" }));
    await store.insertEntry(entryRecord({ position: 2, value: "b" }));

    const result = await store.getEntriesInRange("role", "v1", 1, 3);
    expect(result.map((e) => e.position)).toEqual([1, 2, 3]);
  });
});

// ── getEntry ──────────────────────────────────────────────

describe("getEntry", () => {
  it("등록된 entry를 조회한다", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord());
    const record = entryRecord({ position: 2, value: "viewer" });
    await store.insertEntry(record);

    expect(await store.getEntry("role", "v1", 2)).toEqual(record);
  });

  it("없는 position은 null을 반환한다", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord());
    expect(await store.getEntry("role", "v1", 99)).toBeNull();
  });
});

// ── 격리성 ───────────────────────────────────────────────

describe("격리성", () => {
  it("서로 다른 prefix는 독립적으로 동작한다", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord({ prefix: "role",   versionId: "v1", capacity: 8 }));
    await store.insertSchemaVersion(versionRecord({ prefix: "action", versionId: "v1", capacity: 4 }));
    await store.insertEntry(entryRecord({ prefix: "role",   position: 1, value: "admin"  }));
    await store.insertEntry(entryRecord({ prefix: "action", position: 1, value: "read"   }));

    expect((await store.getEntry("role",   "v1", 1))?.value).toBe("admin");
    expect((await store.getEntry("action", "v1", 1))?.value).toBe("read");
  });

  it("서로 다른 versionId는 독립적으로 동작한다", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion(versionRecord({ versionId: "v1", capacity: 8  }));
    await store.insertSchemaVersion(versionRecord({ versionId: "v2", capacity: 16 }));
    await store.insertEntry(entryRecord({ versionId: "v1", position: 1, value: "old" }));
    await store.insertEntry(entryRecord({ versionId: "v2", position: 1, value: "new" }));

    expect((await store.getEntry("role", "v1", 1))?.value).toBe("old");
    expect((await store.getEntry("role", "v2", 1))?.value).toBe("new");
  });

  it("composite 테이블은 schema_version에만 저장되고 entry가 없어도 된다", async () => {
    const store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion({ prefix: "perm", versionId: "v1", capacity: 512, createdAt: "2026-01-01T00:00:00Z" });

    const versions = await store.getSchemaVersions("perm");
    expect(versions).toHaveLength(1);
    expect(versions[0].capacity).toBe(512);
    expect(await store.getEntries("perm", "v1")).toEqual([]);
  });
});
