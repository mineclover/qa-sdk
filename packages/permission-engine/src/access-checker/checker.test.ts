// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { DisjointUnionIndex, buildMask } from "weighted-index";

import { AccessChecker, type InstancePolicyEvaluator } from "./checker.js";
import { InMemoryAuditRecorder } from "../audit/index.js";
import { InMemoryResourcePolicyRegistry } from "../resource-policy/index.js";
import { issueBitmap } from "../versioned-bitmap/index.js";

function makeEvaluator(
  registered: (args: any) => boolean = () => true,
  delegated: (args: any) => boolean = () => true,
): InstancePolicyEvaluator {
  return {
    async evaluateRegistered(args) {
      return registered(args);
    },
    async evaluateDelegated(args) {
      return delegated(args);
    },
  };
}

describe("AccessChecker — 2-pass + audit", () => {
  // shape:
  //   resource variant: [action(3), resource_type(3)]  size 9
  //   transaction variant: [transition_id(5)]          size 5
  // total 14
  const union = new DisjointUnionIndex([
    { kind: "resource",    shape: [3, 3] },
    { kind: "transaction", shape: [5] },
  ]);

  const secret = randomBytes(32);
  let audit: InMemoryAuditRecorder;
  let registry: InMemoryResourcePolicyRegistry;
  let spanCounter: number;
  let checker: AccessChecker;
  const NOW = 1_700_000_000_000;

  const newSpanId = () => `span-${++spanCounter}`;

  beforeEach(() => {
    audit = new InMemoryAuditRecorder();
    registry = new InMemoryResourcePolicyRegistry();
    spanCounter = 0;
  });

  function ctxWith(bits: number[]) {
    const mask = buildMask(union.totalSize, bits);
    const b = issueBitmap({
      prefix: "perm", v: "uv1", mask,
      issuer: "test", ttlMs: 60_000, secret, now: NOW,
    });
    return {
      userId: "user-1",
      bitmap: b,
      parentSpanId: null,
      traceId: "trace-1",
      newSpanId,
    };
  }

  describe("Pass 1 — bitmap only", () => {
    it("비트 없으면 deny (bitmap_bit_not_set)", async () => {
      checker = new AccessChecker({
        union, policyRegistry: registry, evaluator: makeEvaluator(), audit,
      });
      const ctx = ctxWith([]); // 빈 비트맵
      const r = await checker.check(ctx, {
        kind: "resource", apiId: "readDoc",
        coords: [1, 1], targetId: "document",
      });
      expect(r.allowed).toBe(false);
      expect(r.denyReason).toBe("bitmap_bit_not_set");

      const tree = await audit.listByRoot(r.executionSpanId);
      expect(tree.length).toBe(2); // execution + bitmap check
      expect(tree[1].kind === "check" && tree[1].outcome).toBe("deny");
    });

    it("transaction kind: 비트 있으면 Pass 2 스킵하고 바로 allow", async () => {
      const bit = union.encode("transaction", [2]); // transition_id=2
      checker = new AccessChecker({
        union, policyRegistry: registry, evaluator: makeEvaluator(), audit,
      });
      const ctx = ctxWith([bit]);
      const r = await checker.check(ctx, {
        kind: "transaction", apiId: "publishWorkflow",
        coords: [2], targetId: "txn-publish",
      });
      expect(r.allowed).toBe(true);

      const tree = await audit.listByRoot(r.executionSpanId);
      // execution + 1 bitmap check만 (lifecycle 없음)
      expect(tree.filter((e) => e.kind === "check").length).toBe(1);
    });
  });

  describe("Pass 2 — UNREGISTERED (owner check)", () => {
    beforeEach(async () => {
      await registry.create({
        resourceId: "doc-1", resourceType: "document", ownerId: "user-1", now: "2026-04-22T10:00:00Z",
      });
    });

    it("owner 일치 → allow, lifecycle check entry 생성", async () => {
      const bit = union.encode("resource", [1, 1]);
      checker = new AccessChecker({
        union, policyRegistry: registry, evaluator: makeEvaluator(), audit,
      });
      const ctx = ctxWith([bit]);
      const r = await checker.check(ctx, {
        kind: "resource", apiId: "readDoc", coords: [1, 1],
        targetId: "document", resource: { id: "doc-1", ownerId: "user-1" },
      });
      expect(r.allowed).toBe(true);
      const tree = await audit.listByRoot(r.executionSpanId);
      const lifecycle = tree.find((e) => e.kind === "check" && e.pass === "lifecycle");
      expect(lifecycle).toBeDefined();
    });

    it("owner 불일치 → deny (not_owner)", async () => {
      const bit = union.encode("resource", [1, 1]);
      checker = new AccessChecker({
        union, policyRegistry: registry, evaluator: makeEvaluator(), audit,
      });
      const ctx = { ...ctxWith([bit]), userId: "user-2" };
      const r = await checker.check(ctx, {
        kind: "resource", apiId: "readDoc", coords: [1, 1],
        targetId: "document", resource: { id: "doc-1", ownerId: "user-1" },
      });
      expect(r.allowed).toBe(false);
      expect(r.denyReason).toBe("not_owner");
      // 트리에서 denyReason이 담긴 check entry 찾기 (firstFailure는 execution도 포함하므로 별도 탐색)
      const tree = await audit.listByRoot(r.executionSpanId);
      const lifecycleDeny = tree.find(
        (e) => e.kind === "check" && e.pass === "lifecycle" && e.outcome === "deny",
      );
      expect(lifecycleDeny?.kind === "check" && lifecycleDeny.denyReason).toBe("not_owner");
    });
  });

  describe("Pass 2 — REGISTERED (Cerbos)", () => {
    beforeEach(async () => {
      await registry.create({
        resourceId: "doc-1", resourceType: "document", ownerId: "user-1", now: "2026-04-22T10:00:00Z",
      });
      await registry.register("doc-1", { cerbosPolicyRef: "policy-v1", now: "2026-04-22T11:00:00Z" });
    });

    it("Cerbos allow → allow", async () => {
      const bit = union.encode("resource", [1, 1]);
      checker = new AccessChecker({
        union, policyRegistry: registry,
        evaluator: makeEvaluator(() => true),
        audit,
      });
      const ctx = { ...ctxWith([bit]), userId: "user-2" }; // owner가 아니어도 REGISTERED면 정책 판정
      const r = await checker.check(ctx, {
        kind: "resource", apiId: "readDoc", coords: [1, 1],
        targetId: "document", resource: { id: "doc-1", ownerId: "user-1" },
      });
      expect(r.allowed).toBe(true);
    });

    it("Cerbos deny → deny (cerbos_deny)", async () => {
      const bit = union.encode("resource", [1, 1]);
      checker = new AccessChecker({
        union, policyRegistry: registry,
        evaluator: makeEvaluator(() => false),
        audit,
      });
      const ctx = ctxWith([bit]);
      const r = await checker.check(ctx, {
        kind: "resource", apiId: "readDoc", coords: [1, 1],
        targetId: "document", resource: { id: "doc-1", ownerId: "user-1" },
      });
      expect(r.allowed).toBe(false);
      expect(r.denyReason).toBe("cerbos_deny");
    });
  });

  describe("nested audit — parent spanId 전파", () => {
    it("parent 지정 시 execution이 그 아래에 attach", async () => {
      const bit = union.encode("resource", [1, 1]);
      checker = new AccessChecker({
        union, policyRegistry: registry, evaluator: makeEvaluator(), audit,
      });
      // 가짜 root execution을 먼저 기록
      await audit.startExecution({
        spanId: "root", traceId: "trace-1", parentSpanId: null,
        apiId: "txn-A", actorUserId: "user-1", targetKind: "transaction", targetId: "A",
      });
      const ctx = { ...ctxWith([bit]), parentSpanId: "root" };
      await registry.create({
        resourceId: "doc-1", resourceType: "document", ownerId: "user-1", now: "2026-04-22T10:00:00Z",
      });
      const r = await checker.check(ctx, {
        kind: "resource", apiId: "readDoc", coords: [1, 1],
        targetId: "document", resource: { id: "doc-1", ownerId: "user-1" },
      });
      expect(r.allowed).toBe(true);
      const entries = await audit.listByRoot("root");
      expect(entries.some((e) => e.spanId === r.executionSpanId)).toBe(true);
      const exec = entries.find((e) => e.spanId === r.executionSpanId);
      expect(exec?.parentSpanId).toBe("root");
      expect(exec?.depth).toBe(1);
    });
  });
});
