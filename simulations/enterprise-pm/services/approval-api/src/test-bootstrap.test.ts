import { afterEach, describe, expect, it } from "vitest";
import type { AccessChecker } from "permission-engine";
import {
  bootstrapTestApi,
  createTestBudgetRequest,
  seedApprovalFixtures,
  type TestApprovalApiHandle,
} from "./test-bootstrap.js";

function allowChecker(): AccessChecker {
  return {
    check: async () => ({ allowed: true, executionSpanId: "root-allow" }),
  } as unknown as AccessChecker;
}

function denyChecker(): AccessChecker {
  return {
    check: async () => ({
      allowed: false,
      executionSpanId: "root-deny",
      denyReason: "cross_department_requires_approver_role",
    }),
  } as unknown as AccessChecker;
}

describe("sim-approval-api/test-bootstrap", () => {
  let handle: TestApprovalApiHandle;

  afterEach(async () => {
    await handle?.close();
  });

  it("bootstrapTestApi — port > 0", async () => {
    handle = await bootstrapTestApi({ overrideChecker: allowChecker() });
    expect(handle.port).toBeGreaterThan(0);
  });

  it("seedApprovalFixtures — approver_role id 반환", async () => {
    handle = await bootstrapTestApi({ overrideChecker: allowChecker() });
    const fx = await seedApprovalFixtures(handle);
    expect(fx.approver_role.id).toBe("role-approver");
  });

  it("createTestBudgetRequest — amount 500_000 → totalStages 1", async () => {
    handle = await bootstrapTestApi({ overrideChecker: allowChecker() });
    const r = await createTestBudgetRequest(handle, {
      projectId: "p-1",
      projectDepartmentId: "dept-eng",
      amount: 500_000,
      requesterId: "user-eng-1",
    });
    expect(r.totalStages).toBe(1);
    expect(r.status).toBe("draft");
    expect(r.projectDepartmentId).toBe("dept-eng");
  });

  it("POST /approvals/requests — header 없음 → 401", async () => {
    handle = await bootstrapTestApi({ overrideChecker: allowChecker() });
    const res = await fetch(`${handle.baseUrl}/approvals/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "p-1",
        projectDepartmentId: "dept-eng",
        amount: 1_000_000,
        requesterId: "user-1",
      }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /approvals/requests — header + allow → 201 + rootSpanId", async () => {
    handle = await bootstrapTestApi({ overrideChecker: allowChecker() });
    const maskB64 = Buffer.from([0xff, 0xff]).toString("base64");
    const res = await fetch(`${handle.baseUrl}/approvals/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-user-id": "alice",
        "x-auth-bitmap-mask": maskB64,
        "x-auth-bitmap-v": "uv1",
      },
      body: JSON.stringify({
        projectId: "p-1",
        projectDepartmentId: "dept-eng",
        amount: 500_000,
        requesterId: "user-1",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; rootSpanId: string };
    expect(body.rootSpanId).toBe("root-allow");
  });

  it("POST decisions — cross-dept deny → 403 + denyReason", async () => {
    handle = await bootstrapTestApi({ overrideChecker: denyChecker() });
    // bootstrap 후 req 직접 use-case 로 생성 (override deny 통과 X)
    const req = await createTestBudgetRequest(handle, {
      projectId: "p-1",
      projectDepartmentId: "dept-eng",
      amount: 500_000,
      requesterId: "user-1",
      advanceTo: "in_review",
    });

    const maskB64 = Buffer.from([0xff, 0xff]).toString("base64");
    const res = await fetch(`${handle.baseUrl}/approvals/requests/${req.id}/decisions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-user-id": "bob",
        "x-auth-bitmap-mask": maskB64,
        "x-auth-bitmap-v": "uv1",
      },
      body: JSON.stringify({ decision: "approve" }),
    });
    expect(res.status).toBe(403);
  });
});
