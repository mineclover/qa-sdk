// @def.boundary sim-scenarios
// @def.doc authorization-ontology-resource-lifecycle

import { ok, equal } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import { fetchAuditTrace } from "./lib/audit-helpers.js";

interface S6Ctx {
  alice: { email: string; password: string };
  frank: { id: string; email: string; password: string };
  project: { id: string; departmentId: string };
  graphRootId: string;
}

/**
 * 시나리오 6 — DELEGATED 외부 컨설턴트 위임.
 *
 * authorization-ontology-resource-lifecycle:
 *   UNREGISTERED → (auto REGISTERED) → DELEGATED 전이 (alice 호출)
 *   DELEGATED 상태에서 frank 접근 시 Pass 2 evaluateDelegated 호출
 *   evaluateDelegated 는 delegate endpoint가 기록한 authorization-graph snapshot
 *   (`AuthorizationGraphStore` backed in-memory adapter) 에서 delegate principal 을 조회해 allow 한다
 *
 * 검증:
 *   - alice POST /projects/:id/delegate → 200, policy.state=DELEGATED
 *   - frank GET /projects/:id → 200 (Pass 2 acl branch allow)
 *   - audit entry pass=acl 존재 (DELEGATED 분기 증거)
 */
export const scenario6DelegatedResource: Scenario<S6Ctx> = {
  name: "scenario-6-delegated-resource",
  description:
    "alice 가 외부 컨설턴트 frank 에게 project 리소스 위임 → frank 접근 가능",
  validates: [
    "resource-policy DELEGATED state",
    "AccessChecker Pass 2 acl branch",
    "InstancePolicyEvaluator.evaluateDelegated",
    "authorization-graph",
  ],

  async setup() {
    const handle = (globalThis as unknown as { __simHandle?: unknown })
      .__simHandle as
      | {
          fixtures: {
            alice: { email: string; password: string; departmentId: string };
            frank: { id: string; email: string; password: string };
            departments: { eng: string };
          };
        }
      | undefined;
    if (!handle) throw new Error("__simHandle not bound");
    const fx = handle.fixtures;

    // setup 단계에서 project 생성 — alice token 으로 gateway 경유
    const gatewayFetch = (globalThis as unknown as {
      __simGatewayFetch?: (r: Request) => Promise<Response>;
    }).__simGatewayFetch!;
    const aliceLogin = await gatewayFetch(
      new Request("http://sim/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: fx.alice.email, password: fx.alice.password }),
      }),
    );
    if (!aliceLogin.ok) throw new Error(`alice login: ${aliceLogin.status}`);
    const { token: aliceToken } = (await aliceLogin.json()) as { token: string };
    const createRes = await gatewayFetch(
      new Request("http://sim/projects", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          name: "Consulting Project",
          departmentId: fx.departments.eng,
        }),
      }),
    );
    if (createRes.status !== 201) {
      throw new Error(
        `setup project create: ${createRes.status} ${await createRes.text()}`,
      );
    }
    const project = (await createRes.json()) as { id: string };

    return {
      alice: { email: fx.alice.email, password: fx.alice.password },
      frank: { id: fx.frank.id, email: fx.frank.email, password: fx.frank.password },
      project: { id: project.id, departmentId: fx.departments.eng },
      graphRootId: `consultant-graph-${project.id}`,
    };
  },

  async act(ctx) {
    const gatewayFetch = (globalThis as unknown as {
      __simGatewayFetch?: (r: Request) => Promise<Response>;
    }).__simGatewayFetch!;
    const traceIds: string[] = [];

    // alice login
    const aliceLogin = await gatewayFetch(
      new Request("http://sim/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ctx.alice),
      }),
    );
    const { token: aliceToken } = (await aliceLogin.json()) as { token: string };
    traceIds.push(aliceLogin.headers.get("x-trace-id") ?? "");

    // POST /projects/:id/delegate
    const delegateRes = await gatewayFetch(
      new Request(`http://sim/projects/${ctx.project.id}/delegate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          graphRootId: ctx.graphRootId,
          delegateUserId: ctx.frank.id,
        }),
      }),
    );
    if (!delegateRes.ok) {
      throw new Error(
        `delegate: status=${delegateRes.status} body=${await delegateRes.text()}`,
      );
    }
    traceIds.push(delegateRes.headers.get("x-trace-id") ?? "");
    const delegated = (await delegateRes.json()) as {
      state: string;
      graphRootId: string;
    };

    const graphRes = await gatewayFetch(
      new Request(`http://sim/audit/graphs/${ctx.graphRootId}/latest`, {
        headers: { Authorization: `Bearer ${aliceToken}` },
      }),
    );
    if (!graphRes.ok) {
      throw new Error(
        `delegation-graph: status=${graphRes.status} body=${await graphRes.text()}`,
      );
    }
    const delegationGraph = (await graphRes.json()) as {
      graphId: string;
      snapshotId: string;
      nodeCount: number;
      relationCount: number;
      graph: {
        nodes: Array<{ coord: { anchor: string } }>;
      };
    };

    // frank login
    const frankLogin = await gatewayFetch(
      new Request("http://sim/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: ctx.frank.email, password: ctx.frank.password }),
      }),
    );
    if (!frankLogin.ok)
      throw new Error(`frank login: ${frankLogin.status}`);
    const { token: frankToken } = (await frankLogin.json()) as { token: string };
    traceIds.push(frankLogin.headers.get("x-trace-id") ?? "");

    // frank GET /projects/:id
    const frankGetRes = await gatewayFetch(
      new Request(`http://sim/projects/${ctx.project.id}`, {
        headers: { Authorization: `Bearer ${frankToken}` },
      }),
    );
    const frankGetTraceId = frankGetRes.headers.get("x-trace-id") ?? "";
    if (frankGetTraceId) traceIds.push(frankGetTraceId);

    let frankRootSpanId: string | null = null;
    const frankBody = frankGetRes.ok
      ? ((await frankGetRes.json()) as { rootSpanId?: string })
      : {};
    frankRootSpanId = frankBody.rootSpanId ?? null;

    // audit trace (alice token 으로 조회)
    let trace: Awaited<ReturnType<typeof fetchAuditTrace>> | null = null;
    if (frankRootSpanId) {
      trace = await fetchAuditTrace(gatewayFetch, frankRootSpanId, aliceToken);
    }

    return {
      data: {
        delegateStatus: delegateRes.status,
        delegatedState: delegated.state,
        delegatedGraphRootId: delegated.graphRootId,
        delegationGraphId: delegationGraph.graphId,
        delegationGraphSnapshotId: delegationGraph.snapshotId,
        delegationGraphNodeAnchors: delegationGraph.graph.nodes.map((node) => node.coord.anchor),
        frankReadOk: frankGetRes.ok,
        frankReadStatus: frankGetRes.status,
        trace,
      },
      traceIds: traceIds.filter(Boolean),
      stepCount: 5,
    };
  },

  async assert(ctx, actResult) {
    const d = actResult.data as Record<string, unknown>;
    ok(
      d.delegateStatus === 200 || d.delegateStatus === 201,
      `delegate POST should be 200/201, got ${d.delegateStatus}`,
    );
    equal(d.delegatedState, "DELEGATED", "policy.state must be DELEGATED");
    ok(
      (d.delegatedGraphRootId as string).startsWith("consultant-graph-"),
      "graphRootId must be set",
    );
    equal(d.delegationGraphId, d.delegatedGraphRootId, "graph snapshot must be saved under graphRootId");
    ok(
      typeof d.delegationGraphSnapshotId === "string" &&
        (d.delegationGraphSnapshotId as string).length > 0,
      "delegation graph snapshotId must exist",
    );
    ok(
      Array.isArray(d.delegationGraphNodeAnchors) &&
        (d.delegationGraphNodeAnchors as string[]).includes(ctx.graphRootId) &&
        (d.delegationGraphNodeAnchors as string[]).includes(ctx.frank.id),
      "delegation graph snapshot must contain graph root and delegate principal",
    );

    equal(
      d.frankReadOk,
      true,
      `frank GET should succeed (DELEGATED → evaluator.evaluateDelegated allow), got status=${d.frankReadStatus}`,
    );

    const trace = d.trace as {
      entries: Array<{ kind: string; pass?: string; outcome: string }>;
    } | null;
    if (trace) {
      const aclEntries = trace.entries.filter(
        (e) => e.kind === "check" && e.pass === "acl",
      );
      ok(
        aclEntries.length >= 1,
        `must have ≥1 acl check entry (DELEGATED branch evidence), found ${aclEntries.length}`,
      );
      const allAllow = trace.entries
        .filter((e) => e.kind === "check")
        .every((c) => c.outcome === "allow");
      ok(allAllow, "all check entries should be allow");
    }
  },

  async teardown() {},
};
