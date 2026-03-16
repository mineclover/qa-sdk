/**
 * PositionEngine — EntryMetadataStore 테스트
 * position 기반 관계형 메타데이터 CRUD
 */
import { describe, it, expect } from "vitest";
import { InMemoryEntryMetadataStore } from "./adapters/memory-entry-metadata-store.js";

describe("PositionEngine: EntryMetadataStore", () => {
  function create() {
    return new InMemoryEntryMetadataStore();
  }

  it("set + get", async () => {
    const s = create();
    await s.set("role", 1, "display_name", "관리자");
    expect(await s.get("role", 1, "display_name")).toBe("관리자");
  });

  it("upsert 동작", async () => {
    const s = create();
    await s.set("role", 1, "icon", "shield");
    await s.set("role", 1, "icon", "crown");
    expect(await s.get("role", 1, "icon")).toBe("crown");
  });

  it("없는 키는 null", async () => {
    const s = create();
    expect(await s.get("role", 1, "missing")).toBeNull();
  });

  it("getAll", async () => {
    const s = create();
    await s.set("role", 1, "display_name", "관리자");
    await s.set("role", 1, "icon", "shield");
    await s.set("role", 1, "color", "#ff0000");

    const all = await s.getAll("role", 1);
    expect(Object.keys(all)).toHaveLength(3);
    expect(all["display_name"]).toBe("관리자");
    expect(all["icon"]).toBe("shield");
  });

  it("delete", async () => {
    const s = create();
    await s.set("role", 1, "icon", "shield");
    await s.delete("role", 1, "icon");
    expect(await s.get("role", 1, "icon")).toBeNull();
  });

  it("findByKey — 같은 key를 가진 모든 position", async () => {
    const s = create();
    await s.set("config", 1, "value", "dark");
    await s.set("config", 2, "value", "ko-KR");
    await s.set("config", 3, "value", "Asia/Seoul");
    await s.set("config", 1, "label", "theme"); // 다른 key

    const results = await s.findByKey("config", "value");
    expect(results).toHaveLength(3);
    expect(results[0]!.position).toBe(1);
    expect(results[0]!.value).toBe("dark");
  });

  it("prefix 격리", async () => {
    const s = create();
    await s.set("role", 1, "name", "admin");
    await s.set("perm", 1, "name", "read");

    expect(await s.get("role", 1, "name")).toBe("admin");
    expect(await s.get("perm", 1, "name")).toBe("read");
    expect(await s.findByKey("role", "name")).toHaveLength(1);
  });

  it("JSON 값 저장", async () => {
    const s = create();
    const perms = ["read", "write", "delete"];
    await s.set("role", 1, "permissions", perms);
    expect(await s.get("role", 1, "permissions")).toEqual(perms);
  });
});
