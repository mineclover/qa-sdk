import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InMemoryPolicyRuleStore } from "./in-memory-policy-rule-store.js";
import { NodeSqliteDriver } from "index-meta";
import {
  PolicyRuleNotFoundError,
  type PolicyRuleStore,
  type StoredPolicyRule,
} from "./policy-rule-store.js";
import { SqlPolicyRuleStore } from "./sql-policy-rule-store.js";

interface RuleValue {
  effect: "allow" | "deny";
  reason: string;
}

interface StoreHarness {
  store: PolicyRuleStore<RuleValue>;
  dispose?: () => void;
}

function createRule(
  overrides: Partial<StoredPolicyRule<RuleValue>> & {
    id: string;
  },
): StoredPolicyRule<RuleValue> {
  const { id, ...rest } = overrides;
  return {
    id,
    indexId: "perm",
    versionId: "v1",
    pattern: ["1", null, "3"],
    value: { effect: "allow", reason: "baseline" },
    priority: 10,
    createdAt: "2026-03-18T00:00:00.000Z",
    updatedAt: "2026-03-18T00:00:00.000Z",
    ruleSetId: "rbac-rules",
    ...rest,
  };
}

function policyRuleStoreSuite(
  name: string,
  factory: () => StoreHarness,
) {
  describe(name, () => {
    let harness: StoreHarness;
    let store: PolicyRuleStore<RuleValue>;

    beforeEach(() => {
      harness = factory();
      store = harness.store;
    });

    afterEach(() => {
      harness.dispose?.();
    });

    it("CRUD roundtrip", async () => {
      const inserted = createRule({ id: "rule-1" });
      await expect(store.insert(inserted)).resolves.toEqual(inserted);
      await expect(store.findById("rule-1")).resolves.toEqual(inserted);

      const updated = createRule({
        id: "rule-1",
        pattern: ["1", "2", "3"],
        value: { effect: "deny", reason: "narrow override" },
        priority: 50,
        updatedAt: "2026-03-18T01:00:00.000Z",
        ruleSetId: undefined,
      });
      await expect(store.update(updated)).resolves.toEqual(updated);
      await expect(store.findById("rule-1")).resolves.toEqual(updated);

      await expect(store.findByIndex("perm", "v1")).resolves.toEqual([updated]);

      await expect(store.delete("rule-1")).resolves.toBeUndefined();
      await expect(store.findByIndex("perm", "v1")).resolves.toEqual([]);
    });

    it("findByIndex filters by indexId and versionId", async () => {
      const expected = [
        createRule({ id: "rule-1", createdAt: "2026-03-18T00:00:00.000Z" }),
        createRule({
          id: "rule-2",
          createdAt: "2026-03-18T00:05:00.000Z",
          updatedAt: "2026-03-18T00:05:00.000Z",
          priority: undefined,
          ruleSetId: undefined,
          value: { effect: "deny", reason: "fallback" },
        }),
      ];
      const otherVersion = createRule({
        id: "rule-3",
        versionId: "v2",
      });
      const otherIndex = createRule({
        id: "rule-4",
        indexId: "article",
      });

      for (const rule of [...expected, otherVersion, otherIndex]) {
        await store.insert(rule);
      }

      await expect(store.findByIndex("perm", "v1")).resolves.toEqual(expected);
      await expect(store.findByIndex("perm", "v2")).resolves.toEqual([otherVersion]);
      await expect(store.findByIndex("article", "v1")).resolves.toEqual([otherIndex]);
    });

    it("missing IDs raise PolicyRuleNotFoundError", async () => {
      await expect(store.findById("missing-rule")).rejects.toBeInstanceOf(
        PolicyRuleNotFoundError,
      );
      await expect(store.update(createRule({ id: "missing-rule" }))).rejects.toBeInstanceOf(
        PolicyRuleNotFoundError,
      );
      await expect(store.delete("missing-rule")).rejects.toBeInstanceOf(
        PolicyRuleNotFoundError,
      );
    });
  });
}

policyRuleStoreSuite("InMemoryPolicyRuleStore", () => ({
  store: new InMemoryPolicyRuleStore<RuleValue>(),
}));

policyRuleStoreSuite("SqlPolicyRuleStore", () => {
  const driver = new NodeSqliteDriver(":memory:", null);
  return {
    store: new SqlPolicyRuleStore<RuleValue>(driver),
    dispose: () => driver.close(),
  };
});

describe("PolicyRuleStore parity", () => {
  it("InMemory and SQL stores stay behaviorally equivalent", async () => {
    const driver = new NodeSqliteDriver(":memory:", null);
    const memoryStore = new InMemoryPolicyRuleStore<RuleValue>();
    const sqlStore = new SqlPolicyRuleStore<RuleValue>(driver);

    const rules = [
      createRule({ id: "rule-1" }),
      createRule({
        id: "rule-2",
        createdAt: "2026-03-18T00:02:00.000Z",
        updatedAt: "2026-03-18T00:02:00.000Z",
        value: { effect: "deny", reason: "fallback" },
        priority: undefined,
      }),
    ];

    for (const rule of rules) {
      await memoryStore.insert(rule);
      await sqlStore.insert(rule);
    }

    const updated = createRule({
      id: "rule-2",
      createdAt: "2026-03-18T00:02:00.000Z",
      updatedAt: "2026-03-18T01:15:00.000Z",
      pattern: ["2", null, null],
      value: { effect: "allow", reason: "temporary exception" },
      ruleSetId: "exceptions",
    });

    await memoryStore.update(updated);
    await sqlStore.update(updated);

    await expect(memoryStore.findById("rule-2")).resolves.toEqual(
      await sqlStore.findById("rule-2"),
    );
    await expect(memoryStore.findByIndex("perm", "v1")).resolves.toEqual(
      await sqlStore.findByIndex("perm", "v1"),
    );

    await memoryStore.delete("rule-1");
    await sqlStore.delete("rule-1");

    await expect(memoryStore.findByIndex("perm", "v1")).resolves.toEqual(
      await sqlStore.findByIndex("perm", "v1"),
    );

    driver.close();
  });
});
