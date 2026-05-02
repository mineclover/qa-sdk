// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * query-service InMemoryPolicyRuleStore — facet 격리 테스트.
 *
 * 원본: packages/query-service/src/stores/in-memory-policy-rule-store.ts
 * 동기화: synced/query-service/src/stores/
 */

import { describe, it, expect } from "vitest";
import { InMemoryPolicyRuleStore } from "../../synced/query-service/src/stores/in-memory-policy-rule-store.js";
import type { StoredPolicyRule } from "../../synced/query-service/src/stores/policy-rule-store.js";

interface TestValue { effect: "allow" | "deny"; reason: string }

const NOW = "2026-04-05T00:00:00Z";

function makeRule(overrides: Partial<StoredPolicyRule<TestValue>> = {}): StoredPolicyRule<TestValue> {
  return {
    id: `rule-${Math.random().toString(36).slice(2, 8)}`,
    pattern: [{ position: 0, value: 1 }],
    value: { effect: "allow", reason: "default" },
    indexId: "permission",
    versionId: "v1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("InMemoryPolicyRuleStore (facet)", () => {
  it("CRUD roundtrip — insert → findById → update → delete", async () => {
    const store = new InMemoryPolicyRuleStore<TestValue>();

    // insert
    const rule = makeRule({ value: { effect: "allow", reason: "admin" } });
    const created = await store.insert(rule);
    expect(created.id).toBe(rule.id);

    // findById
    const got = await store.findById(rule.id);
    expect(got.value).toEqual({ effect: "allow", reason: "admin" });

    // update
    const updated = await store.update({ ...got, value: { effect: "deny", reason: "revoked" }, updatedAt: NOW });
    expect(updated.value.effect).toBe("deny");

    // delete
    await store.delete(rule.id);
    await expect(store.findById(rule.id)).rejects.toThrow();
  });

  it("findByIndex — indexId + versionId 필터", async () => {
    const store = new InMemoryPolicyRuleStore<TestValue>();

    await store.insert(makeRule({ indexId: "permission", versionId: "v1", value: { effect: "allow", reason: "a" } }));
    await store.insert(makeRule({ indexId: "permission", versionId: "v2", value: { effect: "allow", reason: "b" } }));
    await store.insert(makeRule({ indexId: "other", versionId: "v1", value: { effect: "deny", reason: "c" } }));

    const v1Rules = await store.findByIndex("permission", "v1");
    expect(v1Rules).toHaveLength(1);
    expect(v1Rules[0].value.reason).toBe("a");
  });

  it("존재하지 않는 ID → 에러", async () => {
    const store = new InMemoryPolicyRuleStore<TestValue>();
    await expect(store.findById("nonexistent")).rejects.toThrow();
  });

  it("중복 insert → 에러", async () => {
    const store = new InMemoryPolicyRuleStore<TestValue>();
    const rule = makeRule();
    await store.insert(rule);
    await expect(store.insert(rule)).rejects.toThrow();
  });
});
