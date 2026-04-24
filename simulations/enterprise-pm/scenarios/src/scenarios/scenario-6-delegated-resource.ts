// @def.boundary sim-scenarios
// @def.doc authorization-ontology-resource-lifecycle

import { ok, equal } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import {
  fetchAuditContext,
  fetchGraphSnapshotDiff,
  fetchGraphSnapshotList,
  fetchGraphSnapshotPrune,
} from "./lib/audit-helpers.js";

interface S6Ctx {
  alice: { email: string; password: string };
  frank: { id: string; email: string; password: string };
  eve: { id: string };
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
 *   (`AuthorizationGraphStore` persistent sim adapter) 에서 delegate principal 을 조회해 allow 한다
 *
 * 검증:
 *   - alice POST /projects/:id/delegate → 200, policy.state=DELEGATED
 *   - frank GET /projects/:id → 200 (Pass 2 acl branch allow)
 *   - graph snapshot list/diff/prune → delegated graph lifecycle evidence
 *   - prune 이후 audit/context 재조회 → trace + latest graph + retention insight composite proof
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
            eve: { id: string };
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
      eve: { id: fx.eve.id },
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

    const appendRes = await gatewayFetch(
      new Request(`http://sim/projects/${ctx.project.id}/delegates`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          delegateUserId: ctx.eve.id,
        }),
      }),
    );
    if (!appendRes.ok) {
      throw new Error(
        `append-delegate: status=${appendRes.status} body=${await appendRes.text()}`,
      );
    }

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

    let auditContext: Awaited<ReturnType<typeof fetchAuditContext>> | null = null;
    let graphSnapshotList: Awaited<ReturnType<typeof fetchGraphSnapshotList>> | null = null;
    let graphSnapshotDiff: Awaited<ReturnType<typeof fetchGraphSnapshotDiff>> | null = null;
    let graphSnapshotPrune: Awaited<ReturnType<typeof fetchGraphSnapshotPrune>> | null = null;
    let auditContextAfterPrune:
      | Awaited<ReturnType<typeof fetchAuditContext>>
      | null = null;
    if (frankRootSpanId) {
      auditContext = await fetchAuditContext(
        gatewayFetch,
        frankRootSpanId,
        ctx.graphRootId,
        aliceToken,
      );
      graphSnapshotList = await fetchGraphSnapshotList(
        gatewayFetch,
        ctx.graphRootId,
        aliceToken,
      );
      if ((graphSnapshotList?.snapshots.length ?? 0) >= 2) {
        const from = graphSnapshotList!.snapshots[0]!;
        const to = graphSnapshotList!.snapshots[graphSnapshotList!.snapshots.length - 1]!;
        graphSnapshotDiff = await fetchGraphSnapshotDiff(
          gatewayFetch,
          from.snapshotId,
          to.snapshotId,
          aliceToken,
        );
        graphSnapshotPrune = await fetchGraphSnapshotPrune(
          gatewayFetch,
          ctx.graphRootId,
          1,
          aliceToken,
        );
        auditContextAfterPrune = await fetchAuditContext(
          gatewayFetch,
          frankRootSpanId,
          ctx.graphRootId,
          aliceToken,
        );
      }
    }

    return {
      data: {
        delegateStatus: delegateRes.status,
        delegatedState: delegated.state,
        delegatedGraphRootId: delegated.graphRootId,
        appendDelegateStatus: appendRes.status,
        frankReadOk: frankGetRes.ok,
        frankReadStatus: frankGetRes.status,
        auditContext,
        graphSnapshotList,
        graphSnapshotDiff,
        graphSnapshotPrune,
        auditContextAfterPrune,
      },
      traceIds: traceIds.filter(Boolean),
      stepCount: 6,
      operatorHints: frankRootSpanId
        ? [
            `pnpm --filter @qa-sdk/sim-scenarios start -- audit context --root-span-id ${frankRootSpanId} --graph-id ${ctx.graphRootId}`,
          ]
        : undefined,
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
    ok(
      d.appendDelegateStatus === 200 || d.appendDelegateStatus === 201,
      `append delegate should be 200/201, got ${d.appendDelegateStatus}`,
    );
    const auditContext = d.auditContext as {
      graphId: string;
      firstFailure: unknown;
      trace: { entries: Array<{ kind: string; pass?: string; outcome: string }> };
      graphSnapshot: {
        snapshotId: string;
        graph: { nodes: Array<{ coord: { anchor: string } }> };
      };
      graphRetentionInsight?: {
        total: number;
        summary: Record<string, number>;
        byTrigger: Record<string, number>;
      } | null;
    } | null;
    ok(auditContext, "audit context must exist");
    equal(auditContext!.graphId, d.delegatedGraphRootId, "graph snapshot must be saved under graphRootId");
    ok(
      typeof auditContext!.graphSnapshot.snapshotId === "string" &&
        auditContext!.graphSnapshot.snapshotId.length > 0,
      "delegation graph snapshotId must exist",
    );
    ok(
      auditContext!.graphSnapshot.graph.nodes.map((node) => node.coord.anchor).includes(ctx.graphRootId) &&
        auditContext!.graphSnapshot.graph.nodes.map((node) => node.coord.anchor).includes(ctx.frank.id),
      "delegation graph snapshot must contain graph root and delegate principal",
    );
    ok(
      auditContext!.graphSnapshot.graph.nodes.map((node) => node.coord.anchor).includes(ctx.eve.id),
      "delegation graph latest snapshot must contain appended delegate principal",
    );

    const snapshotList = d.graphSnapshotList as {
      count: number;
      snapshots: Array<{ snapshotId: string }>;
    } | null;
    ok(snapshotList, "graph snapshot list must exist");
    ok(snapshotList!.count >= 2, `expected >= 2 graph snapshots, got ${snapshotList!.count}`);

    const snapshotDiff = d.graphSnapshotDiff as {
      summary: { addedNodeCount: number };
    } | null;
    ok(snapshotDiff, "graph snapshot diff must exist");
    ok(
      snapshotDiff!.summary.addedNodeCount >= 1,
      `expected graph diff to add nodes, got ${snapshotDiff!.summary.addedNodeCount}`,
    );

    const pruneResult = d.graphSnapshotPrune as {
      beforeCount: number;
      afterCount: number;
      deletedSnapshotIds: string[];
      keptSnapshotIds: string[];
    } | null;
    ok(pruneResult, "graph snapshot prune result must exist");
    equal(
      pruneResult!.beforeCount,
      snapshotList!.count,
      "prune should see the same snapshot count as the pre-prune list",
    );
    equal(pruneResult!.afterCount, 1, "prune should keep only the latest snapshot");
    equal(
      pruneResult!.deletedSnapshotIds.length,
      pruneResult!.beforeCount - 1,
      "prune should delete all but the latest snapshot",
    );
    equal(
      pruneResult!.keptSnapshotIds.length,
      1,
      "prune should return one kept snapshot id",
    );
    equal(
      pruneResult!.keptSnapshotIds[0],
      auditContext!.graphSnapshot.snapshotId,
      "prune should keep the latest snapshot from the composite audit view",
    );

    const auditContextAfterPrune = d.auditContextAfterPrune as {
      graphId: string;
      trace: { count: number };
      graphSnapshot: { snapshotId: string };
      graphRetentionInsight?: {
        total: number;
        summary: Record<string, number>;
        byTrigger: Record<string, number>;
      } | null;
    } | null;
    ok(auditContextAfterPrune, "audit context after prune must exist");
    equal(
      auditContextAfterPrune!.graphSnapshot.snapshotId,
      pruneResult!.keptSnapshotIds[0],
      "audit context after prune must point to the kept latest snapshot",
    );
    equal(
      auditContextAfterPrune!.graphId,
      d.delegatedGraphRootId,
      "audit context after prune must stay bound to the delegated graph",
    );

    if (auditContextAfterPrune!.graphRetentionInsight) {
      ok(
        auditContextAfterPrune!.graphRetentionInsight.total >= 1,
        "graph retention insight should include at least one retention event when ingest insight is available",
      );
      ok(
        (auditContextAfterPrune!.graphRetentionInsight.summary["sim.graph_retention.graph_pruned"] ?? 0) >= 1,
        "graph retention insight should include graph_pruned event when available",
      );
      ok(
        (auditContextAfterPrune!.graphRetentionInsight.byTrigger.api ?? 0) >= 1,
        "graph retention insight should attribute retained events to api trigger when available",
      );
    }

    equal(
      d.frankReadOk,
      true,
      `frank GET should succeed (DELEGATED → evaluator.evaluateDelegated allow), got status=${d.frankReadStatus}`,
    );

    const trace = auditContext!.trace;
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
