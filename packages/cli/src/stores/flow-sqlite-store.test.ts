// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * SqliteInstanceStore 테스트
 *
 * :memory: SQLite로 영속 계층을 검증한다.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteInstanceStore } from "./flow-sqlite-store.js";
import type { FlowInstance } from "decision-flow";

function makeInstance(overrides: Partial<FlowInstance> = {}): FlowInstance {
  return {
    id: overrides.id ?? "test-001",
    schemaId: overrides.schemaId ?? "test-schema",
    schemaVersion: overrides.schemaVersion ?? "v1",
    status: overrides.status ?? "completed",
    context: overrides.context ?? { team: "platform", feature: "sqlite-test" },
    selections: overrides.selections ?? [
      { gateId: "g1", branchId: "b1", evidence: [], confidence: 0.8, timestamp: "2026-03-25T00:00:00Z", durationMs: 0 },
    ],
    outcome: overrides.outcome,
    startedAt: overrides.startedAt ?? "2026-03-25T00:00:00Z",
    completedAt: overrides.completedAt ?? "2026-03-25T00:01:00Z",
    coordinateAddress: overrides.coordinateAddress ?? 42,
  };
}

describe("SqliteInstanceStore", () => {
  let store: SqliteInstanceStore;

  beforeEach(() => {
    store = new SqliteInstanceStore(":memory:");
  });

  it("save + findBySchema 라운드트립", () => {
    store.save(makeInstance({ id: "i1" }));
    store.save(makeInstance({ id: "i2", schemaId: "other" }));

    const results = store.findBySchema("test-schema");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("i1");
    expect(results[0].coordinateAddress).toBe(42);
  });

  it("findByContext — JSON 필드 검색", () => {
    store.save(makeInstance({ id: "i1", context: { team: "platform" } }));
    store.save(makeInstance({ id: "i2", context: { team: "infra" } }));

    const results = store.findByContext({ key: "team", value: "platform" });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("i1");
  });

  it("findByTimeRange — 시간 범위 검색", () => {
    store.save(makeInstance({ id: "i1", startedAt: "2026-03-20T00:00:00Z" }));
    store.save(makeInstance({ id: "i2", startedAt: "2026-03-25T00:00:00Z" }));
    store.save(makeInstance({ id: "i3", startedAt: "2026-03-30T00:00:00Z" }));

    const results = store.findByTimeRange({ from: "2026-03-24T00:00:00Z", to: "2026-03-26T00:00:00Z" });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("i2");
  });

  it("findActive — active 인스턴스만 조회", () => {
    store.save(makeInstance({ id: "active-1", status: "active", completedAt: undefined }));
    store.save(makeInstance({ id: "done-1", status: "completed" }));
    store.save(makeInstance({ id: "active-2", status: "active", completedAt: undefined }));

    const actives = store.findActive();
    expect(actives.length).toBe(2);
    expect(actives.every((i) => i.status === "active")).toBe(true);
  });

  it("findById — 단건 조회", () => {
    store.save(makeInstance({ id: "target" }));
    expect(store.findById("target")).toBeDefined();
    expect(store.findById("nonexistent")).toBeUndefined();
  });

  it("search — 키워드 검색 (context + schemaId)", () => {
    store.save(makeInstance({ id: "i1", context: { feature: "event-catalog" } }));
    store.save(makeInstance({ id: "i2", context: { feature: "other" } }));
    store.save(makeInstance({ id: "i3", schemaId: "stabilization" }));

    expect(store.search("event-catalog").length).toBe(1);
    expect(store.search("stabilization").length).toBe(1);
    expect(store.search("nonexistent").length).toBe(0);
  });

  it("recent — 최신순 + limit", () => {
    for (let i = 0; i < 5; i++) {
      store.save(makeInstance({
        id: `i${i}`,
        startedAt: `2026-03-${20 + i}T00:00:00Z`,
      }));
    }

    const recent3 = store.recent(3);
    expect(recent3.length).toBe(3);
    expect(recent3[0].id).toBe("i4"); // 가장 최근
  });

  it("stats — 집계", () => {
    store.save(makeInstance({ id: "a1", status: "active", schemaId: "s1" }));
    store.save(makeInstance({ id: "c1", status: "completed", schemaId: "s1" }));
    store.save(makeInstance({ id: "c2", status: "completed", schemaId: "s2" }));

    const s = store.stats();
    expect(s.total).toBe(3);
    expect(s.completed).toBe(2);
    expect(s.active).toBe(1);
    expect(s.schemas).toBe(2);
  });

  it("save는 INSERT OR REPLACE — 같은 ID로 갱신 가능", () => {
    store.save(makeInstance({ id: "update-me", status: "active" }));
    expect(store.findById("update-me")!.status).toBe("active");

    store.save(makeInstance({ id: "update-me", status: "completed" }));
    expect(store.findById("update-me")!.status).toBe("completed");
  });

  it("손상된 JSON은 fallback으로 처리 (크래시 안 함)", () => {
    // 직접 SQL로 손상 데이터 삽입
    const db = (store as any).rawDb;
    db.prepare(`
      INSERT INTO flow_instances (id, schema_id, schema_version, status, context, selections, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run("corrupt-1", "test", "v1", "completed", "{invalid json", "[]", "2026-03-25T00:00:00Z");

    // 크래시 없이 조회 가능
    const result = store.findById("corrupt-1");
    expect(result).toBeDefined();
    expect(result!.context).toEqual({}); // fallback
  });
});
