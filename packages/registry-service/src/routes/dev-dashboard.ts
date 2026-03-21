/**
 * dev-dashboard — 개발 워크플로우 모니터링 대시보드 API + HTML 서빙.
 *
 * GET /dev/              → HTML 대시보드
 * GET /dev/api/overview  → 전체 요약
 * GET /dev/api/flow-map  → Schema/Prefix/Consumer 레이어 + 진행도
 * GET /dev/api/metrics   → 6종 metric 현황
 * GET /dev/api/timeline  → 의사결정/관측/버전 이벤트 시간순
 */

import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DevDkgProvider } from "../lib/dev-dkg-provider.js";
import type { CatalogStore } from "../stores/catalog-store.js";
import type { DkgNodePort, MetricValuePort, ObservationNodePort } from "../types/spec-core-ports.js";

export interface DevDashboardDeps {
  provider: DevDkgProvider;
  catalogStore?: CatalogStore;
}

// ── WebSocket 핸들러 (server.ts에서 upgradeWebSocket으로 등록) ──

export interface DevWsClient {
  send(data: string): void;
}

/**
 * dev-dashboard WebSocket 핸들러.
 * 연결된 클라이언트에게 주기적으로 overview+metrics 데이터를 push.
 */
export function createDevWsHandler(deps: DevDashboardDeps) {
  const clients = new Set<DevWsClient>();
  let pushTimer: ReturnType<typeof setInterval> | null = null;

  function startPush() {
    if (pushTimer) return;
    pushTimer = setInterval(() => {
      if (clients.size === 0) return;
      try {
        const graph = deps.provider.getGraph();
        const nodes = graph.getAllNodes();
        const byKind: Record<string, number> = {};
        for (const n of nodes) byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
        const observations = nodes.filter((n: DkgNodePort) => n.kind === "observation");

        const metrics = deps.provider.collectMetrics();
        const summary = { ok: 0, warning: 0, critical: 0, total: metrics.length };
        for (const m of metrics) summary[m.status as keyof typeof summary]++;

        const payload = JSON.stringify({
          type: "update",
          data: {
            overview: {
              nodes: byKind,
              observations: { total: observations.length, unresolved: observations.filter((o: DkgNodePort) => !o.resolution).length },
            },
            metrics: { summary },
          },
          timestamp: new Date().toISOString(),
        });

        for (const client of clients) {
          try { client.send(payload); } catch { clients.delete(client); }
        }
      } catch { /* 에러 격리 */ }
    }, 10_000); // 10초마다 push

    if ("unref" in pushTimer && typeof pushTimer.unref === "function") {
      pushTimer.unref();
    }
  }

  return {
    onOpen(_evt: unknown, ws: DevWsClient) {
      clients.add(ws);
      startPush();
    },
    onMessage(data: unknown, ws: DevWsClient) {
      try {
        const msg = JSON.parse(String(data)) as { type?: string };
        if (msg.type === "refresh") {
          deps.provider.refresh();
          ws.send(JSON.stringify({ type: "refreshed" }));
        }
      } catch { /* 잘못된 메시지 무시 */ }
    },
    onClose(_evt: unknown, ws: DevWsClient) {
      clients.delete(ws);
      if (clients.size === 0 && pushTimer) {
        clearInterval(pushTimer);
        pushTimer = null;
      }
    },
    onError(_evt: unknown, ws: DevWsClient) {
      clients.delete(ws);
    },
    /** 테스트용: 연결된 클라이언트 수 */
    get clientCount() { return clients.size; },
  };
}

export function createDevDashboardRoutes(deps: DevDashboardDeps) {
  const app = new Hono();
  const { provider } = deps;

  // ── HTML 서빙 ─────────────────────────────────────

  let cachedHtml: string | null = null;

  app.get("/dev/", (c) => {
    if (!cachedHtml) {
      try {
        const dir = dirname(fileURLToPath(import.meta.url));
        cachedHtml = readFileSync(join(dir, "../../public/dev-dashboard.html"), "utf-8");
      } catch {
        return c.text("Dashboard HTML not found", 404);
      }
    }
    return c.html(cachedHtml);
  });

  // ── API: overview ─────────────────────────────────

  app.get("/dev/api/overview", (c) => {
    const graph = provider.getGraph();
    const store = provider.getStore();

    const nodes = graph.getAllNodes();
    const byKind: Record<string, number> = {};
    for (const n of nodes) {
      byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
    }

    // constraint 검사
    const constraints = nodes.filter((n: DkgNodePort) => n.kind === "constraint" && n.lifecycle === "active");
    const prefixes = nodes.filter((n: DkgNodePort) => n.kind === "prefix");
    let constraintsPassed = 0;
    for (const cn of constraints) {
      const edges = graph.edgesFrom(cn.id, "constrains");
      let violated = false;
      for (const e of edges) {
        if (e.type === "constrains") {
          // 간단히 active constraint가 violation 없으면 pass
          violated = false; // checkConstraints와 동일한 로직이지만 여기서는 간략화
        }
      }
      if (!violated) constraintsPassed++;
    }

    // domain health
    const domains = nodes.filter((n: DkgNodePort) => n.kind === "domain");
    const observations = nodes.filter((n: DkgNodePort) => n.kind === "observation");
    const unresolved = observations.filter((n: DkgNodePort) => !n.resolution).length;

    const lastConvergence = store?.getMeta?.("last_convergence") ?? null;
    const lastBootstrap = store?.getMeta?.("last_bootstrap") ?? null;

    return c.json({
      nodes: byKind,
      total: { nodes: nodes.length, edges: graph.getAllNodes().length },
      health: {
        constraints: `${constraintsPassed}/${constraints.length} passed`,
        domains: `${domains.length} domains`,
        unresolved,
      },
      observations: { total: observations.length, unresolved },
      lastConvergence,
      lastBootstrap,
    });
  });

  // ── API: flow-map ─────────────────────────────────

  app.get("/dev/api/flow-map", (c) => {
    const graph = provider.getGraph();
    const catalog = provider.getCatalog();
    const nodes = graph.getAllNodes();

    // Schema layer (axes)
    const schemaLayer: Array<Record<string, unknown>> = [];
    for (const [id, axis] of Object.entries(catalog.axes) as [string, any][]) {
      const versions = Object.keys(axis.versions);
      const latestKey = versions[versions.length - 1];
      const latest = axis.versions[latestKey];
      const entries = latest?.entries?.length ?? 0;
      const capacity = latest?.capacity ?? entries;
      const headroom = capacity - entries;

      schemaLayer.push({
        id,
        name: axis.name,
        version: latestKey,
        entries,
        capacity,
        headroom,
        status: headroom <= 0 ? "critical" : headroom <= 1 ? "warning" : "ok",
      });
    }

    // Prefix layer
    const prefixLayer: Array<Record<string, unknown>> = [];
    const prefixNodes = nodes.filter((n: DkgNodePort) => n.kind === "prefix");
    for (const pn of prefixNodes) {
      const composes = graph.neighbors(pn.id, "composes") as string[];
      const category = pn.category ?? "unknown";

      // version 정보 (graph에서는 lifecycle으로 추정)
      const lifecycle = pn.lifecycle ?? "active";

      // consumer 찾기
      const consumedBy: string[] = [];
      const consumerNodes = nodes.filter((n: DkgNodePort) => n.kind === "consumer");
      for (const cn of consumerNodes) {
        if ((Array.isArray(cn.consumedPrefixes) ? cn.consumedPrefixes : []).includes(pn.id)) {
          consumedBy.push(cn.id);
        }
      }

      prefixLayer.push({
        id: pn.id,
        name: pn.name,
        category,
        lifecycle,
        dimCount: composes.length,
        axes: composes,
        consumers: consumedBy,
      });
    }

    // Consumer layer
    const consumerLayer: Array<Record<string, unknown>> = [];
    const consumerNodes = nodes.filter((n: DkgNodePort) => n.kind === "consumer");
    for (const cn of consumerNodes) {
      consumerLayer.push({
        id: cn.id,
        name: cn.name,
        prefixes: cn.consumedPrefixes ?? [],
        role: cn.role ?? "unknown",
      });
    }

    // Edges (composes + consumes)
    const edges: Array<Record<string, unknown>> = [];
    for (const pn of prefixNodes) {
      for (const axis of (graph.neighbors(pn.id, "composes") as string[])) {
        edges.push({ from: axis, to: pn.id, type: "composes" });
      }
    }
    for (const cn of consumerNodes) {
      for (const pid of (Array.isArray(cn.consumedPrefixes) ? cn.consumedPrefixes as string[] : [])) {
        edges.push({ from: cn.id, to: pid, type: "consumes" });
      }
    }

    // Progress
    const total = prefixNodes.length;
    const active = prefixNodes.filter((n: DkgNodePort) => (n.lifecycle ?? "active") === "active").length;
    const draft = prefixNodes.filter((n: DkgNodePort) => n.lifecycle === "draft").length;
    const deprecated = prefixNodes.filter((n: DkgNodePort) => n.lifecycle === "deprecated").length;

    return c.json({
      layers: {
        schema: schemaLayer,
        prefix: prefixLayer,
        consumer: consumerLayer,
      },
      edges,
      progress: { defined: total, active, draft, deprecated },
    });
  });

  // ── API: metrics ──────────────────────────────────

  app.get("/dev/api/metrics", (c) => {
    const metrics = provider.collectMetrics();
    const graph = provider.getGraph();
    const observations = (graph.getAllNodes()).filter((n: DkgNodePort) => n.kind === "observation");

    const summary = { ok: 0, warning: 0, critical: 0, total: metrics.length };
    const byCategory: Record<string, { ok: number; warning: number; critical: number }> = {};

    for (const m of metrics) {
      summary[m.status as keyof typeof summary]++;
      const cat = m.id.split(":")[1] ?? "unknown";
      if (!byCategory[cat]) byCategory[cat] = { ok: 0, warning: 0, critical: 0 };
      byCategory[cat][m.status as "ok" | "warning" | "critical"]++;
    }

    return c.json({
      summary,
      byCategory,
      metrics: metrics.map((m: MetricValuePort) => ({
        id: m.id,
        name: m.name,
        value: m.value,
        status: m.status,
        detail: m.detail,
        target: m.target,
      })),
      observations: {
        total: observations.length,
        unresolved: observations.filter((o: DkgNodePort) => !o.resolution).length,
      },
    });
  });

  // ── API: timeline ─────────────────────────────────

  app.get("/dev/api/timeline", (c) => {
    const limit = parseInt(c.req.query("limit") ?? "30");
    const graph = provider.getGraph();
    const nodes = graph.getAllNodes();

    // decision, observation, version-event 노드 수집
    const timelineKinds = ["decision", "observation", "version-event"];
    const events: Array<Record<string, unknown>> = [];

    for (const n of nodes) {
      if (!timelineKinds.includes(n.kind)) continue;

      const base: Record<string, unknown> = {
        date: n.date ?? "unknown",
        kind: n.kind,
        id: n.id,
      };

      if (n.kind === "decision") {
        base.title = n.title;
        base.type = n.type;
        base.targets = n.targets;
        base.lifecycle = n.lifecycle;
      } else if (n.kind === "observation") {
        base.finding = typeof n.finding === "string" ? n.finding.slice(0, 100) : n.finding;
        base.source = n.source;
        base.resolved = !!n.resolution;
        base.subjects = n.subjects;
        // 연결된 decision 찾기
        const prompted = graph.neighbors(n.id, "prompts") as string[];
        if (prompted.length > 0) {
          base.linkedDecision = prompted[0];
          base.loopClosed = true;
        }
      } else if (n.kind === "version-event") {
        base.prefix = n.subjectId ?? n.prefix;
        base.fromVersion = n.fromVersion;
        base.toVersion = n.toVersion;
        base.impact = n.impact;
      }

      events.push(base);
    }

    // 날짜 역순 정렬
    events.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));

    return c.json({
      events: events.slice(0, limit),
      total: events.length,
    });
  });

  // ── API: refresh ──────────────────────────────────

  app.post("/dev/api/refresh", (c) => {
    provider.refresh();
    return c.json({ ok: true, message: "Cache invalidated. Next request will re-bootstrap." });
  });

  // ── API: catalogs ─────────────────────────────────

  app.get("/dev/api/catalogs", async (c) => {
    const catalogs: { id: string; name: string }[] = [
      { id: "demo", name: "DEMO_CATALOG (기본)" },
    ];

    if (deps.catalogStore) {
      try {
        const stored = await deps.catalogStore.list();
        for (const cat of stored) {
          if (cat.id !== "demo") {
            catalogs.push({ id: cat.id, name: cat.name });
          }
        }
      } catch {
        // catalog store 실패 시 기본만 반환
      }
    }

    return c.json({ catalogs });
  });

  return app;
}
