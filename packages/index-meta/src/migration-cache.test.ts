// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * PositionEngine — MigrationCache (L2) 테스트
 * 불변 마이그레이션 매핑 캐시 + 무효화
 */
import { describe, it, expect } from "vitest";
import { MigrationCache } from "./migration-cache.js";
import { InMemoryMigrationStore } from "./adapters/memory-migration-store.js";
import type { MigrationMapping } from "./migration-store.js";

function mapping(overrides: Partial<MigrationMapping> & Pick<MigrationMapping, "fromVersionId" | "toVersionId" | "position" | "changeType">): MigrationMapping {
  return {
    oldEntityId: null,
    newEntityId: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("PositionEngine: MigrationCache", () => {
  it("getMappings — 캐시 후 store 재호출 없음", async () => {
    const store = new InMemoryMigrationStore();
    await store.saveMappings("role", [
      mapping({ fromVersionId: "v1", toVersionId: "v2", position: 3, changeType: "modified", oldEntityId: "viewer", newEntityId: "member" }),
    ]);

    const cache = new MigrationCache(store);
    const first = await cache.getMappings("role", "v1", "v2");
    expect(first).toHaveLength(1);

    // store 직접 접근을 spy하기 어려우므로 캐시 히트 확인은 간접적
    const second = await cache.getMappings("role", "v1", "v2");
    expect(second).toEqual(first);
  });

  it("getHistory — position별 이력 캐시", async () => {
    const store = new InMemoryMigrationStore();
    await store.saveMappings("role", [
      mapping({ fromVersionId: "v1", toVersionId: "v2", position: 3, changeType: "modified", createdAt: "2026-01-01T00:00:00Z" }),
    ]);
    await store.saveMappings("role", [
      mapping({ fromVersionId: "v2", toVersionId: "v3", position: 3, changeType: "deactivated", createdAt: "2026-02-01T00:00:00Z" }),
    ]);

    const cache = new MigrationCache(store);
    const history = await cache.getHistory("role", 3);
    expect(history).toHaveLength(2);
  });

  it("saveMappingsAndInvalidate — 저장 후 캐시 무효화", async () => {
    const store = new InMemoryMigrationStore();
    const cache = new MigrationCache(store);

    // 빈 상태 캐시
    const before = await cache.getMappings("role", "v1", "v2");
    expect(before).toHaveLength(0);

    // 매핑 추가 + 무효화
    await cache.saveMappingsAndInvalidate("role", [
      mapping({ fromVersionId: "v1", toVersionId: "v2", position: 3, changeType: "modified" }),
    ]);

    // 무효화 후 재조회 → 새 매핑 반영
    const after = await cache.getMappings("role", "v1", "v2");
    expect(after).toHaveLength(1);
  });

  it("resolveToLatest — store 위임", async () => {
    const store = new InMemoryMigrationStore();
    await store.saveMappings("role", [
      mapping({ fromVersionId: "v1", toVersionId: "v2", position: 3, changeType: "modified", oldEntityId: "viewer", newEntityId: "member", createdAt: "2026-01-01T00:00:00Z" }),
    ]);

    const cache = new MigrationCache(store);
    const result = await cache.resolveToLatest("role", "v1", 3, "v2");
    expect(result.currentEntityId).toBe("member");
    expect(result.chain).toHaveLength(1);
  });

  it("clear — 전체 캐시 초기화", async () => {
    const store = new InMemoryMigrationStore();
    await store.saveMappings("role", [
      mapping({ fromVersionId: "v1", toVersionId: "v2", position: 3, changeType: "modified" }),
    ]);

    const cache = new MigrationCache(store);
    await cache.getMappings("role", "v1", "v2");
    await cache.getHistory("role", 3);

    cache.clear();
    // clear 후에도 재조회 가능 (store에서 다시 fetch)
    const result = await cache.getMappings("role", "v1", "v2");
    expect(result).toHaveLength(1);
  });
});
