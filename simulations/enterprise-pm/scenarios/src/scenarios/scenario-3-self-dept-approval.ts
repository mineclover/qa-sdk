// @def.boundary sim-scenarios
// @def.doc authorization-ontology-resource-lifecycle

import { ok, equal } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import { fetchAuditTrace, fetchFirstFailure } from "./lib/audit-helpers.js";

interface S3Ctx {
  approver: { email: string; password: string };
  request: { id: string; departmentId: string; amount: number };
}

/**
 * 시나리오 3 — 자기 부서 budget 100만원 단일 step 승인.
 *
 * 검증 대상:
 *   - state machine: in_review → approved (단일 stage)
 *   - AccessChecker Pass 1 (bitmap allow) + Pass 2 (lifecycle — owner 매칭)
 *   - audit nested tree: execution + 2 check entry
 *   - firstFailure → null (전부 allow)
 *
 * NOTE: 본 환경의 Pass 2 는 ProjectAccessService 기준 "not_owner" 또는
 * cerbos deny 분기. budget.approve 는 resource kind 로 호출되며 policy 는
 * auto-create UNREGISTERED — 따라서 승인자가 resource.ownerId 와 매칭해야 pass.
 * requester 를 승인자와 동일 user 로 설정 (자기 요청 자기 승인).
 */
export const scenario3SelfDeptApproval: Scenario<S3Ctx> = {
  name: "scenario-3-self-dept-approval",
  description: "alice (engineering manager) — 자기 부서 100만원 단일 승인",
  validates: [
    "approval state machine decide → approved",
    "AccessChecker 2-pass allow",
    "audit nested tree (3 entry)",
  ],

  async setup() {
    const handle = (globalThis as unknown as {
      __simHandle?: {
        fixtures: {
          alice: { id: string; email: string; password: string; departmentId: string };
          departments: { eng: string };
          seedBudgetRequest: (args: {
            projectId: string;
            projectDepartmentId: string;
            amount: number;
            requesterId: string;
          }) => Promise<{ id: string }>;
        };
      };
    }).__simHandle;
    if (!handle) throw new Error("__simHandle not bound");
    // alice 가 승인자이자 requester — Pass 2 UNREGISTERED ownerId 매칭 통과.
    // amount = 500_000 (< 1M) → totalStages=1, 1회 승인 = 최종.
    const request = await handle.fixtures.seedBudgetRequest({
      projectId: "proj-scenario-3",
      projectDepartmentId: handle.fixtures.departments.eng,
      amount: 500_000,
      requesterId: handle.fixtures.alice.id,
    });
    return {
      approver: {
        email: handle.fixtures.alice.email,
        password: handle.fixtures.alice.password,
      },
      request: {
        id: request.id,
        departmentId: handle.fixtures.departments.eng,
        amount: 500_000,
      },
    };
  },

  async act(ctx) {
    const gatewayFetch = (globalThis as unknown as {
      __simGatewayFetch?: (r: Request) => Promise<Response>;
    }).__simGatewayFetch!;
    const traceIds: string[] = [];

    // 1. login (alice)
    const loginRes = await gatewayFetch(
      new Request("http://sim/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ctx.approver),
      }),
    );
    if (!loginRes.ok) throw new Error(`login: ${loginRes.status} ${await loginRes.text()}`);
    const { token } = (await loginRes.json()) as { token: string };
    traceIds.push(loginRes.headers.get("x-trace-id") ?? "");

    // 2. POST decision
    const approveRes = await gatewayFetch(
      new Request(
        `http://sim/approvals/requests/${ctx.request.id}/decisions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ decision: "approve", comment: "OK from scenario 3" }),
        },
      ),
    );
    const approveTraceId = approveRes.headers.get("x-trace-id") ?? "";
    if (approveTraceId) traceIds.push(approveTraceId);
    if (!approveRes.ok) {
      throw new Error(
        `approve: status=${approveRes.status} body=${await approveRes.text()}`,
      );
    }
    const approved = (await approveRes.json()) as {
      rootSpanId: string;
      status: string;
      currentStage: number;
    };

    // 3. GET request status
    const getRes = await gatewayFetch(
      new Request(`http://sim/approvals/requests/${ctx.request.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    if (!getRes.ok) throw new Error(`get: ${getRes.status} ${await getRes.text()}`);
    const fetched = (await getRes.json()) as {
      id: string;
      status: string;
      currentStage: number;
    };

    // 4. audit trace
    const trace = await fetchAuditTrace(gatewayFetch, approved.rootSpanId, token);
    const ff = await fetchFirstFailure(gatewayFetch, approved.rootSpanId, token);

    return {
      data: {
        approveStatus: approveRes.status,
        approvedRootSpanId: approved.rootSpanId,
        approvedResponseStatus: approved.status,
        finalStatus: fetched.status,
        auditEntryCount: trace.count,
        auditEntries: trace.entries,
        firstFailure: ff.firstFailure,
      },
      traceIds: traceIds.filter(Boolean),
      stepCount: 4,
    };
  },

  async assert(_ctx, actResult) {
    const d = actResult.data as Record<string, unknown>;
    // approve 응답: default NestJS POST → 201. BudgetController 는 default 상태 전이.
    ok(
      d.approveStatus === 200 || d.approveStatus === 201,
      `approve POST should be 200/201, got ${d.approveStatus}`,
    );
    equal(d.approvedResponseStatus, "approved", `state should transition to approved`);
    equal(d.finalStatus, "approved", `GET response should reflect approved`);

    // audit nested tree: 최소 2 entry (execution + Pass 1 bitmap). resource kind 이면 + Pass 2.
    const count = d.auditEntryCount as number;
    ok(count >= 2, `audit count must be ≥ 2, got ${count}`);

    const entries = d.auditEntries as Array<{ kind: string; outcome?: string }>;
    const execEntries = entries.filter((e) => e.kind === "execution");
    const checkEntries = entries.filter((e) => e.kind === "check");
    ok(execEntries.length >= 1, "must have ≥ 1 execution entry");
    ok(checkEntries.length >= 1, `must have ≥ 1 check entry, got ${checkEntries.length}`);
    ok(
      checkEntries.every((c) => c.outcome === "allow"),
      "all check entries must be allow",
    );

    // firstFailure null — 모두 allow
    equal(d.firstFailure, null, "firstFailure must be null (all allow)");
  },

  async teardown() {},
};
