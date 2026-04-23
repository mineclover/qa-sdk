// @def.boundary sim-scenarios
// @def.doc authorization-ontology-resource-lifecycle

import { ok, equal } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import {
  fetchAuditTrace,
  fetchFirstFailure,
  fetchAuditEntry,
} from "./lib/audit-helpers.js";

interface S4Ctx {
  badApprover: { email: string; password: string };
  goodApprover: { email: string; password: string };
  request: { id: string; departmentId: string; requesterId: string };
}

/**
 * 시나리오 4 — bob (marketing) 가 engineering 부서 budget 단독 승인 시도 → deny.
 *
 * 검증 대상:
 *   - AccessChecker Pass 2 deny — requester=alice / approver=bob 불일치로 "not_owner"
 *     또는 Pass 1 "bitmap_bit_not_set" (member mask 0x0f00 이 budget.approve address=4 미포함)
 *   - audit-recorder.firstFailure 가 정확히 위 deny entry 노출
 *   - decision replay: firstFailure.spanId 로 GET /audit/entry/:id → 동일 entry 복원
 *
 * 실제 deny reason 은 bob 의 role (member/0x0f00) 이 approval-api address 공간
 * (budget.approve = resource kind offset 6 + (5-1)*1 = 10) 과 어떻게 매핑되느냐에 따라
 * "bitmap_bit_not_set" 또는 "not_owner" — assert 에서 두 경우 모두 허용.
 */
export const scenario4CrossDeptDeny: Scenario<S4Ctx> = {
  name: "scenario-4-cross-dept-deny",
  description:
    "bob (marketing) — engineering 부서 budget 단독 승인 시도 → deny + replay",
  validates: [
    "RLS scoping (Phase 3)",
    "AccessChecker 2-pass deny path",
    "audit firstFailure (decision replay)",
  ],

  async setup() {
    const handle = (globalThis as unknown as {
      __simHandle?: {
        fixtures: {
          alice: { id: string; email: string; password: string };
          bob: { email: string; password: string };
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
    const req = await handle.fixtures.seedBudgetRequest({
      projectId: "proj-scenario-4",
      projectDepartmentId: handle.fixtures.departments.eng,
      amount: 500_000,
      requesterId: handle.fixtures.alice.id,
    });
    return {
      badApprover: {
        email: handle.fixtures.bob.email,
        password: handle.fixtures.bob.password,
      },
      goodApprover: {
        email: handle.fixtures.alice.email,
        password: handle.fixtures.alice.password,
      },
      request: {
        id: req.id,
        departmentId: handle.fixtures.departments.eng,
        requesterId: handle.fixtures.alice.id,
      },
    };
  },

  async act(ctx) {
    const gatewayFetch = (globalThis as unknown as {
      __simGatewayFetch?: (r: Request) => Promise<Response>;
    }).__simGatewayFetch!;
    const traceIds: string[] = [];

    // 1. bob login
    const bobLogin = await gatewayFetch(
      new Request("http://sim/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ctx.badApprover),
      }),
    );
    if (!bobLogin.ok) throw new Error(`bob login: ${bobLogin.status}`);
    const { token: bobToken } = (await bobLogin.json()) as { token: string };
    traceIds.push(bobLogin.headers.get("x-trace-id") ?? "");

    // 2. bob attempts approve → expect 403
    const denyRes = await gatewayFetch(
      new Request(
        `http://sim/approvals/requests/${ctx.request.id}/decisions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${bobToken}`,
          },
          body: JSON.stringify({ decision: "approve", comment: "bob trying" }),
        },
      ),
    );
    traceIds.push(denyRes.headers.get("x-trace-id") ?? "");

    let denyBody: {
      rootSpanId?: string;
      error?: string;
      denyReason?: string;
    } = {};
    try {
      denyBody = (await denyRes.json()) as typeof denyBody;
    } catch {
      // JSON 파싱 실패 — body 무시
    }

    // NestJS HttpException 은 ForbiddenException({ ... }) 호출 시 body 를 { message: ... }
    // 형태로 래핑할 수 있음. 실제 body 구조 확인.
    const denyMeta = ((denyBody as Record<string, unknown>).message ??
      denyBody) as {
      rootSpanId?: string;
      error?: string;
      denyReason?: string;
    };

    // 3. alice login (audit 조회 권한)
    const aliceLogin = await gatewayFetch(
      new Request("http://sim/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ctx.goodApprover),
      }),
    );
    if (!aliceLogin.ok) throw new Error(`alice login: ${aliceLogin.status}`);
    const { token: aliceToken } = (await aliceLogin.json()) as {
      token: string;
    };

    // 4. audit trace + firstFailure
    let trace: Awaited<ReturnType<typeof fetchAuditTrace>> | null = null;
    let firstFailure: Awaited<ReturnType<typeof fetchFirstFailure>> | null = null;
    let replayedEntry: Awaited<ReturnType<typeof fetchAuditEntry>> | null = null;

    const rootSpanId = denyMeta.rootSpanId;
    if (rootSpanId) {
      trace = await fetchAuditTrace(gatewayFetch, rootSpanId, aliceToken);
      firstFailure = await fetchFirstFailure(
        gatewayFetch,
        rootSpanId,
        aliceToken,
      );
      if (firstFailure.firstFailure) {
        replayedEntry = await fetchAuditEntry(
          gatewayFetch,
          firstFailure.firstFailure.spanId,
          aliceToken,
        );
      }
    }

    return {
      data: {
        denyStatus: denyRes.status,
        denyBody,
        denyMeta,
        rootSpanId: rootSpanId ?? null,
        trace,
        firstFailure,
        replayedEntry,
      },
      traceIds: traceIds.filter(Boolean),
      stepCount: 4,
    };
  },

  async assert(_ctx, actResult) {
    const d = actResult.data as Record<string, unknown>;
    ok(d.denyStatus === 403, `expected 403, got ${d.denyStatus}`);

    const ff = d.firstFailure as Awaited<
      ReturnType<typeof fetchFirstFailure>
    > | null;
    ok(ff && ff.firstFailure, "firstFailure must exist");
    const failure = ff!.firstFailure as {
      spanId: string;
      kind: string;
      outcome: string;
      pass?: string;
      denyReason?: string;
    };
    equal(failure.outcome, "deny", "firstFailure must be deny");
    // firstFailure 는 recorder.listByRoot 의 depth 순서 → execution(0) 이 먼저.
    // Execution 자체도 outcome=deny 이면 노출. check entry 도 trace 내부에 존재.
    ok(
      failure.kind === "check" || failure.kind === "execution",
      `firstFailure kind must be check/execution, got ${failure.kind}`,
    );

    // trace 전체에 check entry 최소 1건 deny 가 있어야 함 (Pass 1 또는 Pass 2)
    const trace = d.trace as {
      entries: Array<{ kind: string; outcome?: string; denyReason?: string }>;
    } | null;
    ok(trace, "trace must be available");
    const denyChecks = trace!.entries.filter(
      (e) => e.kind === "check" && e.outcome === "deny",
    );
    ok(
      denyChecks.length >= 1,
      `expected ≥ 1 deny check entry, got ${denyChecks.length}`,
    );
    // deny reason 은 "not_owner" (Pass 2 UNREGISTERED owner mismatch) 또는
    // "bitmap_bit_not_set" (Pass 1 bob member mask 미포함).
    const denyReasons = denyChecks.map((e) => e.denyReason).filter(Boolean);
    const matchedReason = denyReasons.some(
      (r) =>
        r === "not_owner" ||
        r === "bitmap_bit_not_set" ||
        (r ?? "").includes("scope") ||
        (r ?? "").includes("dept"),
    );
    ok(
      matchedReason,
      `unexpected denyReasons in check entries: ${JSON.stringify(denyReasons)}`,
    );

    // decision replay — 동일 entry 복원
    const replay = d.replayedEntry as { spanId: string; outcome: string };
    ok(replay, "replay entry must exist");
    equal(
      replay.spanId,
      failure.spanId,
      "replayed entry spanId must match firstFailure",
    );
    equal(replay.outcome, "deny", "replayed entry outcome must be deny");
  },

  async teardown() {},
};
