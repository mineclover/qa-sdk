/**
 * NodeSqliteDriver + SqlIndexMetaStore 통합 테스트
 *
 * node:sqlite 인메모리 DB를 사용해 실제 SQL 실행을 검증한다.
 * InMemorySqlDriver(목 기반)와 달리 실제 SQLite 엔진이 동작한다.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BetterSqliteDriver as NodeSqliteDriver } from "./node-sqlite-driver.js";
import { SqlIndexMetaStore } from "./sql-store.js";
import { ValidationError } from "../errors.js";

// ── 셋업 ─────────────────────────────────────────────────

let driver: NodeSqliteDriver;
let store: SqlIndexMetaStore;

beforeEach(() => {
  driver = new NodeSqliteDriver(); // :memory:
  store  = new SqlIndexMetaStore(driver);
});

afterEach(() => {
  driver.close();
});

// ── schema_version ────────────────────────────────────────

describe("schema_version", () => {
  it("insert → get 왕복", async () => {
    await store.insertSchemaVersion({
      prefix: "role", versionId: "v1", capacity: 8, createdAt: "2026-01-01T00:00:00Z",
    });

    const sv = await store.getSchemaVersion("role", "v1");
    expect(sv).toEqual({ prefix: "role", versionId: "v1", capacity: 8, createdAt: "2026-01-01T00:00:00Z" });
  });

  it("getCapacity fast-path", async () => {
    await store.insertSchemaVersion({ prefix: "role", versionId: "v1", capacity: 1000, createdAt: "2026-01-01T00:00:00Z" });

    expect(await store.getCapacity("role", "v1")).toBe(1000);
    expect(await store.getCapacity("role", "v99")).toBeNull();
  });

  it("getSchemaVersions createdAt 오름차순", async () => {
    await store.insertSchemaVersion({ prefix: "role", versionId: "v2", capacity: 16, createdAt: "2026-06-01T00:00:00Z" });
    await store.insertSchemaVersion({ prefix: "role", versionId: "v1", capacity: 8,  createdAt: "2026-01-01T00:00:00Z" });

    const versions = await store.getSchemaVersions("role");
    expect(versions.map((v) => v.versionId)).toEqual(["v1", "v2"]);
  });

  it("중복 삽입 시 SQLite UNIQUE 제약 에러", async () => {
    await store.insertSchemaVersion({ prefix: "role", versionId: "v1", capacity: 8, createdAt: "2026-01-01T00:00:00Z" });
    await expect(
      store.insertSchemaVersion({ prefix: "role", versionId: "v1", capacity: 8, createdAt: "2026-01-01T00:00:00Z" })
    ).rejects.toThrow();
  });
});

// ── entry ─────────────────────────────────────────────────

describe("entry", () => {
  beforeEach(async () => {
    await store.insertSchemaVersion({
      prefix: "role", versionId: "v1", capacity: 1000, createdAt: "2026-01-01T00:00:00Z",
    });
  });

  it("insert → getEntry 왕복", async () => {
    await store.insertEntry({ prefix: "role", versionId: "v1", position: 1, value: "admin", createdAt: "2026-01-01T00:00:00Z" });

    const entry = await store.getEntry("role", "v1", 1);
    expect(entry).toEqual({ prefix: "role", versionId: "v1", position: 1, value: "admin", createdAt: "2026-01-01T00:00:00Z" });
  });

  it("schema_version 없이 insert 시 ValidationError", async () => {
    await expect(
      store.insertEntry({ prefix: "other", versionId: "v1", position: 1, value: "x", createdAt: "2026-01-01T00:00:00Z" })
    ).rejects.toThrow(ValidationError);
  });

  it("position이 capacity를 초과하면 ValidationError", async () => {
    await expect(
      store.insertEntry({ prefix: "role", versionId: "v1", position: 1001, value: "x", createdAt: "2026-01-01T00:00:00Z" })
    ).rejects.toThrow(ValidationError);
  });

  it("중복 position은 SQLite UNIQUE 제약 에러", async () => {
    await store.insertEntry({ prefix: "role", versionId: "v1", position: 1, value: "admin", createdAt: "2026-01-01T00:00:00Z" });
    await expect(
      store.insertEntry({ prefix: "role", versionId: "v1", position: 1, value: "other", createdAt: "2026-01-01T00:00:00Z" })
    ).rejects.toThrow();
  });

  it("getEntries position 오름차순", async () => {
    await store.insertEntry({ prefix: "role", versionId: "v1", position: 3, value: "c", createdAt: "2026-01-01T00:00:00Z" });
    await store.insertEntry({ prefix: "role", versionId: "v1", position: 1, value: "a", createdAt: "2026-01-01T00:00:00Z" });
    await store.insertEntry({ prefix: "role", versionId: "v1", position: 2, value: "b", createdAt: "2026-01-01T00:00:00Z" });

    const entries = await store.getEntries("role", "v1");
    expect(entries.map((e) => e.position)).toEqual([1, 2, 3]);
    expect(entries.map((e) => e.value)).toEqual(["a", "b", "c"]);
  });

  it("빈 position은 결과에 없다 (sparse)", async () => {
    await store.insertEntry({ prefix: "role", versionId: "v1", position: 1,   value: "guest", createdAt: "2026-01-01T00:00:00Z" });
    await store.insertEntry({ prefix: "role", versionId: "v1", position: 500, value: "admin", createdAt: "2026-01-01T00:00:00Z" });

    const entries = await store.getEntries("role", "v1");
    expect(entries.map((e) => e.position)).toEqual([1, 500]);
  });

  it("getEntriesInRange — [from, to] inclusive (idx_entry_range 인덱스 활용)", async () => {
    for (let i = 1; i <= 10; i++) {
      await store.insertEntry({ prefix: "role", versionId: "v1", position: i, value: `v${i}`, createdAt: "2026-01-01T00:00:00Z" });
    }

    const range = await store.getEntriesInRange("role", "v1", 3, 7);
    expect(range.map((e) => e.position)).toEqual([3, 4, 5, 6, 7]);
  });

  it("예약 마커도 일반 값과 동일하게 저장된다", async () => {
    await store.insertEntry({ prefix: "role", versionId: "v1", position: 1,   value: "_",   createdAt: "2026-01-01T00:00:00Z" });
    await store.insertEntry({ prefix: "role", versionId: "v1", position: 2,   value: "~",   createdAt: "2026-01-01T00:00:00Z" });
    await store.insertEntry({ prefix: "role", versionId: "v1", position: 3,   value: "?",   createdAt: "2026-01-01T00:00:00Z" });
    await store.insertEntry({ prefix: "role", versionId: "v1", position: 4,   value: "NaN", createdAt: "2026-01-01T00:00:00Z" });
    await store.insertEntry({ prefix: "role", versionId: "v1", position: 5,   value: "guest", createdAt: "2026-01-01T00:00:00Z" });

    const entries = await store.getEntries("role", "v1");
    expect(entries.map((e) => e.value)).toEqual(["_", "~", "?", "NaN", "guest"]);
  });

  it("없는 position은 null", async () => {
    expect(await store.getEntry("role", "v1", 999)).toBeNull();
  });
});

// ── 대용량 capacity 시나리오 ──────────────────────────────

describe("대용량 capacity", () => {
  it("capacity 1000, sparse entries 정상 동작", async () => {
    await store.insertSchemaVersion({ prefix: "game", versionId: "v1", capacity: 1000, createdAt: "2026-01-01T00:00:00Z" });

    // 일부만 적재
    const positions = [1, 10, 50, 140, 500, 999];
    for (const pos of positions) {
      await store.insertEntry({ prefix: "game", versionId: "v1", position: pos, value: `val-${pos}`, createdAt: "2026-01-01T00:00:00Z" });
    }

    const entries = await store.getEntries("game", "v1");
    expect(entries).toHaveLength(positions.length);
    expect(entries.map((e) => e.position)).toEqual(positions);

    // 범위 조회
    const range = await store.getEntriesInRange("game", "v1", 50, 500);
    expect(range.map((e) => e.position)).toEqual([50, 140, 500]);
  });
});
