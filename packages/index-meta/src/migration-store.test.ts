/**
 * PositionEngine — MigrationStore 테스트
 * 버전 간 변경 이력 (EntityId 수정, 비활성화) + 체이닝
 */
import { describe, it, expect } from "vitest";
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

describe("PositionEngine: MigrationStore", () => {
  function create() {
    return new InMemoryMigrationStore();
  }

  // ── saveMappings + getMappings ──────────────────────────

  it("매핑 저장 및 조회", async () => {
    const s = create();
    const mappings = [
      mapping({
        fromVersionId: "v1", toVersionId: "v2", position: 3,
        changeType: "modified", oldEntityId: "viewer", newEntityId: "member",
      }),
      mapping({
        fromVersionId: "v1", toVersionId: "v2", position: 5,
        changeType: "deactivated",
      }),
    ];
    await s.saveMappings("role", mappings);

    const result = await s.getMappings("role", "v1", "v2");
    expect(result).toHaveLength(2);
    expect(result[0]!.position).toBe(3);
    expect(result[1]!.position).toBe(5);
  });

  it("중복 매핑 저장 거부", async () => {
    const s = create();
    const m = [mapping({ fromVersionId: "v1", toVersionId: "v2", position: 3, changeType: "modified" })];
    await s.saveMappings("role", m);
    await expect(s.saveMappings("role", m)).rejects.toThrow(/Duplicate/);
  });

  // ── getHistory ──────────────────────────────────────────

  it("position별 변경 이력", async () => {
    const s = create();
    await s.saveMappings("role", [
      mapping({ fromVersionId: "v1", toVersionId: "v2", position: 3, changeType: "modified", oldEntityId: "viewer", newEntityId: "member", createdAt: "2026-01-01T00:00:00Z" }),
    ]);
    await s.saveMappings("role", [
      mapping({ fromVersionId: "v2", toVersionId: "v3", position: 3, changeType: "deactivated", createdAt: "2026-02-01T00:00:00Z" }),
    ]);

    const history = await s.getHistory("role", 3);
    expect(history).toHaveLength(2);
    expect(history[0]!.fromVersionId).toBe("v1");
    expect(history[1]!.fromVersionId).toBe("v2");
  });

  it("변경 없는 position은 빈 이력", async () => {
    const s = create();
    expect(await s.getHistory("role", 99)).toEqual([]);
  });

  // ── resolveToLatest ─────────────────────────────────────

  it("체이닝: modified → modified", async () => {
    const s = create();
    await s.saveMappings("role", [
      mapping({ fromVersionId: "v1", toVersionId: "v2", position: 3, changeType: "modified", oldEntityId: "viewer", newEntityId: "member", createdAt: "2026-01-01T00:00:00Z" }),
    ]);
    await s.saveMappings("role", [
      mapping({ fromVersionId: "v2", toVersionId: "v3", position: 3, changeType: "modified", oldEntityId: "member", newEntityId: "contributor", createdAt: "2026-02-01T00:00:00Z" }),
    ]);

    const result = await s.resolveToLatest("role", "v1", 3, "v3");
    expect(result.currentVersionId).toBe("v3");
    expect(result.currentEntityId).toBe("contributor");
    expect(result.chain).toHaveLength(2);
  });

  it("체이닝: modified → deactivated", async () => {
    const s = create();
    await s.saveMappings("role", [
      mapping({ fromVersionId: "v1", toVersionId: "v2", position: 3, changeType: "modified", oldEntityId: "viewer", newEntityId: "member", createdAt: "2026-01-01T00:00:00Z" }),
    ]);
    await s.saveMappings("role", [
      mapping({ fromVersionId: "v2", toVersionId: "v3", position: 3, changeType: "deactivated", createdAt: "2026-02-01T00:00:00Z" }),
    ]);

    const result = await s.resolveToLatest("role", "v1", 3, "v3");
    expect(result.currentEntityId).toBeNull();
    expect(result.chain).toHaveLength(2);
  });

  it("변경 없는 position은 빈 체인", async () => {
    const s = create();
    await s.saveMappings("role", [
      mapping({ fromVersionId: "v1", toVersionId: "v2", position: 5, changeType: "deactivated", createdAt: "2026-01-01T00:00:00Z" }),
    ]);

    const result = await s.resolveToLatest("role", "v1", 1, "v2");
    // position 1에 대한 매핑이 없으므로 빈 체인
    expect(result.chain).toHaveLength(0);
  });

  // ── 이미 latest인 경우 ─────────────────────────────────

  it("fromVersion === latestVersion → 빈 체인", async () => {
    const s = create();
    const result = await s.resolveToLatest("role", "v1", 3, "v1");
    expect(result.currentVersionId).toBe("v1");
    expect(result.chain).toEqual([]);
  });
});
