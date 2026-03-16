/**
 * SqlEntryFlagStore 테스트
 *
 * BetterSqliteDriver로 실제 SQLite에서 entry_flag 테이블의
 * append-only 이력 관리가 올바른지 검증한다.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { BetterSqliteDriver } from "./node-sqlite-driver.js";
import { SqlIndexMetaStore } from "./sql-store.js";
import { SqlEntryFlagStore } from "./sql-entry-flag-store.js";
import type { EntryFlagRecord } from "../entry-flag-store.js";

describe("SqlEntryFlagStore", () => {
  let driver: BetterSqliteDriver;
  let metaStore: SqlIndexMetaStore;
  let store: SqlEntryFlagStore;

  beforeEach(async () => {
    driver = new BetterSqliteDriver();
    metaStore = new SqlIndexMetaStore(driver);
    store = new SqlEntryFlagStore(driver);

    // entry_flag FK → entry → schema_version 의존
    const now = "2024-01-01T00:00:00Z";
    await metaStore.insertSchemaVersion({ prefix: "role", versionId: "v1", capacity: 8, createdAt: now });
    await metaStore.insertSchemaVersion({ prefix: "role", versionId: "v2", capacity: 16, createdAt: now });
    await metaStore.insertSchemaVersion({ prefix: "action", versionId: "v1", capacity: 4, createdAt: now });
    for (let i = 1; i <= 4; i++) {
      await metaStore.insertEntry({ prefix: "role", versionId: "v1", position: i, value: `role_${i}`, createdAt: now });
      await metaStore.insertEntry({ prefix: "role", versionId: "v2", position: i, value: `role_${i}`, createdAt: now });
      await metaStore.insertEntry({ prefix: "action", versionId: "v1", position: i, value: `action_${i}`, createdAt: now });
    }
  });

  // ── setFlag / getFlag ──

  it("setFlag 후 getFlag로 최신 상태를 조회한다", async () => {
    const now = new Date().toISOString();
    await store.setFlag({
      prefix: "role", versionId: "v1", position: 1,
      status: "active", updatedAt: now,
    });

    const flag = await store.getFlag("role", "v1", 1);
    expect(flag).not.toBeNull();
    expect(flag!.status).toBe("active");
    expect(flag!.position).toBe(1);
  });

  it("같은 position에 여러 flag를 추가하면 최신 것을 반환한다", async () => {
    await store.setFlag({
      prefix: "role", versionId: "v1", position: 1,
      status: "active", updatedAt: "2024-01-01T00:00:00Z",
    });
    await store.setFlag({
      prefix: "role", versionId: "v1", position: 1,
      status: "inactive", reason: "deprecated", updatedAt: "2024-06-01T00:00:00Z",
    });

    const flag = await store.getFlag("role", "v1", 1);
    expect(flag!.status).toBe("inactive");
    expect(flag!.reason).toBe("deprecated");
  });

  it("기록 없는 position은 null을 반환한다", async () => {
    const flag = await store.getFlag("role", "v1", 99);
    expect(flag).toBeNull();
  });

  // ── getFlags (position별 최신 상태) ──

  it("getFlags가 position별 최신 상태를 반환한다", async () => {
    const base = "2024-01-01T00:00:00Z";
    const later = "2024-06-01T00:00:00Z";

    // position 1: active → inactive
    await store.setFlag({ prefix: "role", versionId: "v1", position: 1, status: "active", updatedAt: base });
    await store.setFlag({ prefix: "role", versionId: "v1", position: 1, status: "inactive", updatedAt: later });

    // position 2: active만
    await store.setFlag({ prefix: "role", versionId: "v1", position: 2, status: "active", updatedAt: base });

    // position 3: inactive → active (재활성화)
    await store.setFlag({ prefix: "role", versionId: "v1", position: 3, status: "inactive", updatedAt: base });
    await store.setFlag({ prefix: "role", versionId: "v1", position: 3, status: "active", updatedAt: later });

    const flags = await store.getFlags("role", "v1");
    expect(flags).toHaveLength(3);

    const byPos = new Map(flags.map((f) => [f.position, f]));
    expect(byPos.get(1)!.status).toBe("inactive");
    expect(byPos.get(2)!.status).toBe("active");
    expect(byPos.get(3)!.status).toBe("active");
  });

  it("다른 prefix/version의 flags는 혼합되지 않는다", async () => {
    const now = new Date().toISOString();
    await store.setFlag({ prefix: "role", versionId: "v1", position: 1, status: "active", updatedAt: now });
    await store.setFlag({ prefix: "role", versionId: "v2", position: 1, status: "inactive", updatedAt: now });
    await store.setFlag({ prefix: "action", versionId: "v1", position: 1, status: "inactive", updatedAt: now });

    const v1Flags = await store.getFlags("role", "v1");
    expect(v1Flags).toHaveLength(1);
    expect(v1Flags[0].status).toBe("active");
  });

  // ── getInactivePositions ──

  it("getInactivePositions가 inactive position만 반환한다", async () => {
    const now = new Date().toISOString();
    await store.setFlag({ prefix: "role", versionId: "v1", position: 1, status: "inactive", updatedAt: now });
    await store.setFlag({ prefix: "role", versionId: "v1", position: 2, status: "active", updatedAt: now });
    await store.setFlag({ prefix: "role", versionId: "v1", position: 3, status: "inactive", updatedAt: now });

    const inactives = await store.getInactivePositions("role", "v1");
    expect(inactives).toEqual([1, 3]);
  });

  it("전부 active면 빈 배열을 반환한다", async () => {
    const now = new Date().toISOString();
    await store.setFlag({ prefix: "role", versionId: "v1", position: 1, status: "active", updatedAt: now });
    await store.setFlag({ prefix: "role", versionId: "v1", position: 2, status: "active", updatedAt: now });

    const inactives = await store.getInactivePositions("role", "v1");
    expect(inactives).toEqual([]);
  });

  // ── reason 필드 ──

  it("reason이 undefined면 null로 저장되고 undefined로 복원된다", async () => {
    const now = new Date().toISOString();
    await store.setFlag({ prefix: "role", versionId: "v1", position: 1, status: "active", updatedAt: now });

    const flag = await store.getFlag("role", "v1", 1);
    expect(flag!.reason).toBeUndefined();
  });

  it("reason이 있으면 보존된다", async () => {
    const now = new Date().toISOString();
    await store.setFlag({
      prefix: "role", versionId: "v1", position: 1,
      status: "inactive", reason: "compliance requirement", updatedAt: now,
    });

    const flag = await store.getFlag("role", "v1", 1);
    expect(flag!.reason).toBe("compliance requirement");
  });
});
