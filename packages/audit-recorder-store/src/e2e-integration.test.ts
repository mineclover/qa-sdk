// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * DrizzleAuditRecorder + DrizzleResourcePolicyRegistry — 동일 SQLite 인스턴스 공존 검증.
 *
 * AccessChecker가 두 store를 동시에 쓰는 시나리오에서 트리/lifecycle invariant가 유지되는지.
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DisjointUnionIndex, buildMask } from "weighted-index";

import {
  AccessChecker,
  issueBitmap,
  type InstancePolicyEvaluator,
} from "permission-engine";

import {
  DrizzleResourcePolicyRegistry,
  RESOURCE_POLICIES_DDL,
} from "resource-policy-store";

import { DrizzleAuditRecorder } from "./drizzle-recorder.js";
import { AUDIT_ENTRIES_DDL } from "./schema.js";

describe("E2E — Drizzle audit + Drizzle resource-policy 공존", () => {
  const ACTIONS = { read: 1, write: 2 } as const;
  const TYPES = { document: 1 } as const;
  const TXNS = { publish: 1 } as const;

  const union = new DisjointUnionIndex([
    { kind: "resource", shape: [2, 1] },
    { kind: "transaction", shape: [1] },
  ]);

  function setup() {
    const raw = new Database(":memory:");
    raw.exec(RESOURCE_POLICIES_DDL);
    raw.exec(AUDIT_ENTRIES_DDL);
    const db = drizzle({ client: raw });
    const registry = new DrizzleResourcePolicyRegistry(db);
    const audit = new DrizzleAuditRecorder(db);
    const secret = randomBytes(32);
    let n = 0;
    const newSpanId = () => `span-${++n}`;
    return { db, registry, audit, secret, newSpanId };
  }

  function bitmap(secret: Uint8Array, bits: number[]) {
    const mask = buildMask(union.totalSize, bits);
    return issueBitmap({
      prefix: "perm", v: "uv1", mask,
      issuer: "auth", ttlMs: 60_000, secret,
    });
  }

  it("read 성공 → audit tree에 execution + bitmap check 기록", async () => {
    const { registry, audit, secret, newSpanId } = setup();

    const evaluator: InstancePolicyEvaluator = {
      async evaluateRegistered() { return true; },
      async evaluateDelegated() { return false; },
    };
    const checker = new AccessChecker({ union, policyRegistry: registry, evaluator, audit });

    await registry.create({ resourceId: "doc", resourceType: "document", ownerId: "u1" });

    const userBits = bitmap(secret, [union.encode("resource", [ACTIONS.read, TYPES.document])]);

    const result = await checker.check(
      { userId: "u1", bitmap: userBits, parentSpanId: null, traceId: "t1", newSpanId },
      {
        kind: "resource", apiId: "readDocument",
        coords: [ACTIONS.read, TYPES.document], targetId: "document",
        resource: { id: "doc", ownerId: "u1" },
      },
    );
    expect(result.allowed).toBe(true);

    const tree = await audit.listByRoot(result.executionSpanId);
    expect(tree.length).toBeGreaterThanOrEqual(2);
    expect(tree[0].kind).toBe("execution");
    expect(tree.some((e) => e.kind === "check" && e.pass === "bitmap")).toBe(true);
  });

  it("nested transaction → 한 root 아래 모든 entry depth>=0 일관", async () => {
    const { registry, audit, secret, newSpanId } = setup();

    const evaluator: InstancePolicyEvaluator = {
      async evaluateRegistered() { return true; },
      async evaluateDelegated() { return false; },
    };
    const checker = new AccessChecker({ union, policyRegistry: registry, evaluator, audit });

    await registry.create({ resourceId: "doc", resourceType: "document", ownerId: "u1" });

    const userBits = bitmap(secret, [
      union.encode("resource", [ACTIONS.read, TYPES.document]),
      union.encode("transaction", [TXNS.publish]),
    ]);

    const txn = await checker.check(
      { userId: "u1", bitmap: userBits, parentSpanId: null, traceId: "tx", newSpanId },
      { kind: "transaction", apiId: "publish", coords: [TXNS.publish], targetId: "publish" },
    );
    expect(txn.allowed).toBe(true);

    const nested = await checker.check(
      { userId: "u1", bitmap: userBits, parentSpanId: txn.executionSpanId, traceId: "tx", newSpanId },
      {
        kind: "resource", apiId: "readDocument",
        coords: [ACTIONS.read, TYPES.document], targetId: "document",
        resource: { id: "doc", ownerId: "u1" },
      },
    );
    expect(nested.allowed).toBe(true);

    const tree = await audit.listByRoot(txn.executionSpanId);
    // root depth=0, 모든 child depth>=1
    expect(tree[0].depth).toBe(0);
    for (const entry of tree.slice(1)) {
      expect(entry.depth).toBeGreaterThanOrEqual(1);
      expect(entry.rootSpanId).toBe(txn.executionSpanId);
    }
  });
});
