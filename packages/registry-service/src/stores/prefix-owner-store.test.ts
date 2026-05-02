// @def.boundary registry-system
// @def.doc registry-system

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryPrefixOwnerStore } from "./in-memory-prefix-owner-store.js";
import type { PrefixOwnerStore } from "./prefix-owner-store.js";
import type { PrefixOwnerRecord } from "../types/index.js";

function makeRecord(prefix: string, overrides?: Partial<PrefixOwnerRecord>): PrefixOwnerRecord {
  return {
    prefix,
    owner: "service-a",
    kind: "leaf",
    numberType: "number",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function runContractTests(name: string, factory: () => PrefixOwnerStore) {
  describe(name, () => {
    let store: PrefixOwnerStore;

    beforeEach(() => {
      store = factory();
    });

    it("register + get", async () => {
      const rec = makeRecord("role");
      await store.register(rec);
      const result = await store.get("role");
      expect(result).toEqual(rec);
    });

    it("get returns null for unknown prefix", async () => {
      expect(await store.get("unknown")).toBeNull();
    });

    it("register duplicate throws", async () => {
      await store.register(makeRecord("role"));
      await expect(store.register(makeRecord("role"))).rejects.toThrow();
    });

    it("list returns all records", async () => {
      await store.register(makeRecord("role"));
      await store.register(makeRecord("action", { owner: "service-b" }));
      const list = await store.list();
      expect(list).toHaveLength(2);
      expect(list.map((r) => r.prefix).toSorted()).toEqual(["action", "role"]);
    });

    it("delete removes record", async () => {
      await store.register(makeRecord("role"));
      await store.delete("role");
      expect(await store.get("role")).toBeNull();
    });

    it("delete non-existent is no-op", async () => {
      await store.delete("nonexistent");
    });
  });
}

runContractTests("InMemoryPrefixOwnerStore", () => new InMemoryPrefixOwnerStore());
