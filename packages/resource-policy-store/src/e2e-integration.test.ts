// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

/**
 * End-to-end 통합 테스트 — 권한 모델 전체 플로우.
 *
 * 조립 구성:
 *   - DisjointUnionIndex (weighted-index): resource + transaction variants
 *   - VersionedBitmap (permission-engine/versioned-bitmap): HMAC 서명
 *   - ResourcePolicyRegistry (resource-policy-store): Drizzle + SQLite
 *   - AuditRecorder (permission-engine/audit): InMemory
 *   - AccessChecker (permission-engine/access-checker): 2-pass 통합
 *   - Cerbos/ACL mock: 단순 함수
 *
 * 시나리오:
 *   1. 유저 A가 document 생성 → UNREGISTERED
 *   2. 유저 A가 읽기 접근 → owner check 통과
 *   3. 유저 B가 읽기 접근 → owner mismatch deny
 *   4. 유저 A가 공유 → REGISTERED + Cerbos policy 배포
 *   5. 유저 B가 읽기 접근 (Cerbos allow) → 통과
 *   6. 유저 B가 쓰기 접근 (Cerbos deny) → 거절
 *   7. 트랜잭션 publish 실행 (nested: B 호출) → 중첩 audit tree
 *   8. Decision replay — 실패 원인 식별
 */

import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DisjointUnionIndex, buildMask } from "weighted-index";

import {
  AccessChecker,
  InMemoryAuditRecorder,
  issueBitmap,
  type InstancePolicyEvaluator,
} from "permission-engine";

import { createSqliteTestFixture } from "db-bootstrap";

import { createResourcePolicyRegistry } from "./factory.js";
import { type ResourcePolicyRegistry } from "./port.js";
import { RESOURCE_POLICIES_DDL } from "./sqlite/schema.js";

describe("권한 모델 End-to-End 통합", () => {
  // ── 조립 ──────────────────────────────────────────────────────────────────
  const ACTIONS = { read: 1, write: 2, share: 3 } as const;
  const RESOURCE_TYPES = { document: 1, project: 2 } as const;
  const TRANSITIONS = { publishWorkflow: 1, archiveProject: 2 } as const;

  // resource: [action(3), resource_type(2)]   size 6
  // transaction: [transition(2)]              size 2
  // total: 8 bits
  const union = new DisjointUnionIndex([
    { kind: "resource", shape: [3, 2] },
    { kind: "transaction", shape: [2] },
  ]);

  async function setupContext() {
    const fixture = await createSqliteTestFixture(RESOURCE_POLICIES_DDL);
    const registry: ResourcePolicyRegistry = await createResourcePolicyRegistry({
      dialect: "sqlite",
      db: fixture.db as never,
    });
    const audit = new InMemoryAuditRecorder();
    const secret = randomBytes(32);
    let spanCounter = 0;
    const newSpanId = () => `span-${++spanCounter}`;
    return {
      registry,
      audit,
      secret,
      newSpanId,
      cleanup: fixture.cleanup,
    };
  }

  function makeBitmap(secret: Uint8Array, bits: number[]) {
    const mask = buildMask(union.totalSize, bits);
    return issueBitmap({
      prefix: "perm", v: "uv1", mask,
      issuer: "auth-svc", ttlMs: 60_000, secret,
    });
  }

  function makeEvaluator(cerbosDecide: (args: { userId: string; resourceId: string }) => boolean): InstancePolicyEvaluator {
    return {
      async evaluateRegistered(args) {
        return cerbosDecide(args);
      },
      async evaluateDelegated() {
        return false;
      },
    };
  }

  it("풀 시나리오 — 8단계 통합 플로우 (audit tree + replay 포함)", async () => {
    const ctx = await setupContext();
    try {
      const { registry, audit, secret, newSpanId } = ctx;

    // Cerbos mock: 공유된 리소스는 user-A(owner), user-B(shared) 둘 다 읽기 허용
    const evaluator = makeEvaluator(({ userId }) => userId === "user-A" || userId === "user-B");
    // writeEvaluator: user-B는 쓰기 거절 (읽기 공유만)
    const writeEvaluator = makeEvaluator(({ userId }) => userId === "user-A");

    // 유저 A 비트맵: document에 대한 read/write/share + publishWorkflow 실행
    const userABitmap = makeBitmap(secret, [
      union.encode("resource", [ACTIONS.read, RESOURCE_TYPES.document]),
      union.encode("resource", [ACTIONS.write, RESOURCE_TYPES.document]),
      union.encode("resource", [ACTIONS.share, RESOURCE_TYPES.document]),
      union.encode("transaction", [TRANSITIONS.publishWorkflow]),
    ]);

    // 유저 B 비트맵: document에 대한 read/write만
    const userBBitmap = makeBitmap(secret, [
      union.encode("resource", [ACTIONS.read, RESOURCE_TYPES.document]),
      union.encode("resource", [ACTIONS.write, RESOURCE_TYPES.document]),
    ]);

    const readChecker = new AccessChecker({ union, policyRegistry: registry, evaluator, audit });
    const writeChecker = new AccessChecker({ union, policyRegistry: registry, evaluator: writeEvaluator, audit });

    // ── Step 1: 유저 A가 document 생성 → UNREGISTERED 등록 ─────────────────
    const docId = "doc-1";
    await registry.create({
      resourceId: docId, resourceType: "document", ownerId: "user-A",
    });
    const step1Policy = await registry.resolve(docId);
    expect(step1Policy?.state).toBe("UNREGISTERED");
    expect(step1Policy?.ownerId).toBe("user-A");

    // ── Step 2: 유저 A 읽기 → owner check 통과 ────────────────────────────
    const step2 = await readChecker.check(
      {
        userId: "user-A", bitmap: userABitmap, parentSpanId: null,
        traceId: "trace-1", newSpanId,
      },
      {
        kind: "resource", apiId: "readDocument",
        coords: [ACTIONS.read, RESOURCE_TYPES.document], targetId: "document",
        resource: { id: docId, ownerId: "user-A" },
      },
    );
    expect(step2.allowed).toBe(true);

    // ── Step 3: 유저 B 읽기 → owner 불일치 deny ──────────────────────────
    const step3 = await readChecker.check(
      {
        userId: "user-B", bitmap: userBBitmap, parentSpanId: null,
        traceId: "trace-2", newSpanId,
      },
      {
        kind: "resource", apiId: "readDocument",
        coords: [ACTIONS.read, RESOURCE_TYPES.document], targetId: "document",
        resource: { id: docId, ownerId: "user-A" },
      },
    );
    expect(step3.allowed).toBe(false);
    expect(step3.denyReason).toBe("not_owner");

    // ── Step 4: 유저 A가 공유 → REGISTERED 전이 + Cerbos policy 참조 ──────
    await registry.register(docId, {
      cerbosPolicyRef: "cerbos:document-shared-v1",
    });
    const step4Policy = await registry.resolve(docId);
    expect(step4Policy?.state).toBe("REGISTERED");
    expect(step4Policy?.cerbosPolicyRef).toBe("cerbos:document-shared-v1");

    // ── Step 5: 유저 B 읽기 → Cerbos allow ────────────────────────────────
    const step5 = await readChecker.check(
      {
        userId: "user-B", bitmap: userBBitmap, parentSpanId: null,
        traceId: "trace-3", newSpanId,
      },
      {
        kind: "resource", apiId: "readDocument",
        coords: [ACTIONS.read, RESOURCE_TYPES.document], targetId: "document",
        resource: { id: docId, ownerId: "user-A" },
      },
    );
    expect(step5.allowed).toBe(true);

    // ── Step 6: 유저 B 쓰기 → Cerbos deny ─────────────────────────────────
    const step6 = await writeChecker.check(
      {
        userId: "user-B", bitmap: userBBitmap, parentSpanId: null,
        traceId: "trace-4", newSpanId,
      },
      {
        kind: "resource", apiId: "writeDocument",
        coords: [ACTIONS.write, RESOURCE_TYPES.document], targetId: "document",
        resource: { id: docId, ownerId: "user-A" },
      },
    );
    expect(step6.allowed).toBe(false);
    expect(step6.denyReason).toBe("cerbos_deny");

    // ── Step 7: 유저 A 트랜잭션 publishWorkflow — 내부에서 readDocument 중첩 호출 ──
    const txn = await readChecker.check(
      {
        userId: "user-A", bitmap: userABitmap, parentSpanId: null,
        traceId: "trace-5", newSpanId,
      },
      {
        kind: "transaction", apiId: "publishWorkflow",
        coords: [TRANSITIONS.publishWorkflow], targetId: "publishWorkflow",
      },
    );
    expect(txn.allowed).toBe(true);

    // 트랜잭션 내부에서 호출되는 readDocument (parentSpanId = txn.executionSpanId)
    const nestedRead = await readChecker.check(
      {
        userId: "user-A", bitmap: userABitmap, parentSpanId: txn.executionSpanId,
        traceId: "trace-5", newSpanId,
      },
      {
        kind: "resource", apiId: "readDocument",
        coords: [ACTIONS.read, RESOURCE_TYPES.document], targetId: "document",
        resource: { id: docId, ownerId: "user-A" },
      },
    );
    expect(nestedRead.allowed).toBe(true);

    // Nested audit tree 검증
    const txnTree = await audit.listByRoot(txn.executionSpanId);
    // root (txn execution) + txn bitmap check + nested read execution + read bitmap check + lifecycle check
    expect(txnTree.length).toBeGreaterThanOrEqual(5);
    const rootEntry = txnTree[0];
    expect(rootEntry.depth).toBe(0);
    expect(rootEntry.kind === "execution" && rootEntry.apiId).toBe("publishWorkflow");

    const nestedExec = txnTree.find((e) => e.kind === "execution" && e.apiId === "readDocument");
    expect(nestedExec?.depth).toBe(1);
    expect(nestedExec?.parentSpanId).toBe(txn.executionSpanId);

    // ── Step 8: Decision replay — 유저 B 쓰기 실패 원인 추적 ────────────────
    const failureTree = await audit.listByRoot(step6.executionSpanId);
    const failCheck = failureTree.find(
      (e) => e.kind === "check" && e.outcome === "deny",
    );
    expect(failCheck?.kind === "check" && failCheck.pass).toBe("cerbos");
    expect(failCheck?.kind === "check" && failCheck.denyReason).toBe("cerbos_deny");
    } finally {
      await ctx.cleanup();
    }
  });

  it("VersionedBitmap 변조 검증 — HMAC 서명 불일치", async () => {
    const ctx = await setupContext();
    try {
      const { secret } = ctx;
      const bitmap = makeBitmap(secret, [union.encode("resource", [1, 1])]);

      // 공격자가 mask 비트 조작 — 없던 권한 추가 시도
      const tampered = {
        ...bitmap,
        mask: buildMask(union.totalSize, [0, 1, 2, 3, 4, 5, 6, 7]), // 전체 허용
      };

      const { verifyBitmap } = await import("permission-engine");
      const result = verifyBitmap({ bitmap: tampered, secret });
      expect(result).toEqual({ ok: false, reason: "signature_mismatch" });
    } finally {
      await ctx.cleanup();
    }
  });

  it("Cross-kind disjoint — resource와 transaction address 충돌 없음", async () => {
    // resource [1,1] → address 0 (첫 kind 첫 좌표)
    // transaction [1] → address 6 (두 번째 kind, offset 적용)
    const rAddr = union.encode("resource", [1, 1]);
    const tAddr = union.encode("transaction", [1]);
    expect(rAddr).toBe(0);
    expect(tAddr).toBe(6);
    expect(rAddr).not.toBe(tAddr);

    // decode로 원래 kind 복원
    expect(union.decode(0).kind).toBe("resource");
    expect(union.decode(6).kind).toBe("transaction");
  });
});
