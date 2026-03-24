/**
 * dashboard-api — DKG 모니터링 API (Worker + Node.js 양쪽 동작).
 *
 * devDashboardProvider 없이 graph/catalog만으로 동작.
 * Node.js의 /dev/api/* 와 동일한 데이터를 /api/dashboard/* 로 제공.
 */

import { Hono } from "hono";
import type {
  GraphRegistryPort,
  CatalogPort,
  DkgNodePort,
  MetricValuePort,
} from "../types/spec-core-ports.js";

export interface DashboardApiDeps {
  getGraph: () => GraphRegistryPort;
  getCatalog: () => CatalogPort;
  collectMetrics?: () => MetricValuePort[];
}

interface SchemaLayerEntry {
  id: string;
  name: string;
  version: string;
  entries: number;
  capacity: number;
  headroom: number;
  status: "ok" | "warning" | "critical";
}

interface PrefixLayerEntry {
  id: string;
  name?: string;
  category: string;
  lifecycle: string;
  dimCount: number;
  axes: string[];
  consumers: string[];
}

interface ConsumerLayerEntry {
  id: string;
  name?: string;
  prefixes: readonly string[];
  role: string;
}

interface DiagramEdgeEntry {
  from: string;
  to: string;
  type: "composes" | "consumes";
}

interface TimelineEventEntry {
  date: string;
  kind: string;
  id: string;
  title?: string;
  type?: string;
  targets?: readonly string[];
  lifecycle?: string;
  finding?: string;
  source?: string;
  resolved?: boolean;
  subjects?: readonly string[];
  linkedDecision?: string;
  loopClosed?: boolean;
  prefix?: string;
  fromVersion?: string;
  toVersion?: string;
}

export function createDashboardApiRoutes(deps: DashboardApiDeps) {
  const app = new Hono();

  // ── overview ────────────────────────────────────
  app.get("/overview", (c) => {
    const graph = deps.getGraph();
    const nodes = graph.getAllNodes();

    const byKind: Record<string, number> = {};
    for (const n of nodes) byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;

    const constraints = nodes.filter((n: DkgNodePort) => n.kind === "constraint");
    const domains = nodes.filter((n: DkgNodePort) => n.kind === "domain");
    const observations = nodes.filter((n: DkgNodePort) => n.kind === "observation");
    const unresolved = observations.filter((n: DkgNodePort) => !n.resolution).length;

    return c.json({
      nodes: byKind,
      total: { nodes: nodes.length, edges: graph.edgeCount },
      health: {
        constraints: `${constraints.filter((n: DkgNodePort) => n.lifecycle === "active").length}/${constraints.length}`,
        domains: `${domains.length} domains`,
        unresolved,
      },
      observations: { total: observations.length, unresolved },
    });
  });

  // ── flow-map ────────────────────────────────────
  app.get("/flow-map", (c) => {
    const graph = deps.getGraph();
    const catalog = deps.getCatalog();
    const nodes = graph.getAllNodes();

    // Schema layer
    const schemaLayer: SchemaLayerEntry[] = [];
    for (const [id, axis] of Object.entries(catalog.axes)) {
      const versions = Object.keys(axis.versions);
      const latestKey = versions[versions.length - 1];
      const latest = axis.versions[latestKey];
      const entries = latest?.entries?.length ?? 0;
      const capacity = latest?.capacity ?? entries;
      const headroom = capacity - entries;
      schemaLayer.push({
        id, name: axis.name, version: latestKey,
        entries, capacity, headroom,
        status: headroom <= 0 ? "critical" : headroom <= 1 ? "warning" : "ok",
      });
    }

    // Prefix layer
    const prefixNodes = nodes.filter((n: DkgNodePort) => n.kind === "prefix");
    const consumerNodes = nodes.filter((n: DkgNodePort) => n.kind === "consumer");

    const prefixLayer = prefixNodes.map((pn: DkgNodePort) => {
      const composes = graph.neighbors(pn.id, "composes") as string[];
      const consumedBy = consumerNodes
        .filter((cn: DkgNodePort) => (Array.isArray(cn.consumedPrefixes) ? cn.consumedPrefixes : []).includes(pn.id))
        .map((cn: DkgNodePort) => cn.id);
      return {
        id: pn.id, name: pn.name, category: pn.category ?? "unknown",
        lifecycle: pn.lifecycle ?? "active", dimCount: composes.length,
        axes: composes, consumers: consumedBy,
      };
    });

    // Consumer layer
    const consumerLayer = consumerNodes.map((cn: DkgNodePort) => ({
      id: cn.id, name: cn.name,
      prefixes: cn.consumedPrefixes ?? [],
      role: cn.role ?? "unknown",
    }));

    // Edges
    const edges: DiagramEdgeEntry[] = [];
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

    const active = prefixNodes.filter((n: DkgNodePort) => (n.lifecycle ?? "active") === "active").length;

    return c.json({
      layers: { schema: schemaLayer, prefix: prefixLayer, consumer: consumerLayer },
      edges,
      progress: { defined: prefixNodes.length, active, draft: prefixNodes.length - active, deprecated: 0 },
    });
  });

  // ── metrics ─────────────────────────────────────
  app.get("/metrics", (c) => {
    if (!deps.collectMetrics) {
      return c.json({ error: "metrics not available (no analysis module)" }, 503);
    }

    const metrics = deps.collectMetrics();
    const graph = deps.getGraph();
    const observations = graph.getAllNodes().filter((n: DkgNodePort) => n.kind === "observation");

    const summary = { ok: 0, warning: 0, critical: 0, total: metrics.length };
    const byCategory: Record<string, { ok: number; warning: number; critical: number }> = {};

    for (const m of metrics) {
      summary[m.status as keyof typeof summary]++;
      const cat = m.id.split(":")[1] ?? "unknown";
      if (!byCategory[cat]) byCategory[cat] = { ok: 0, warning: 0, critical: 0 };
      byCategory[cat][m.status as "ok" | "warning" | "critical"]++;
    }

    return c.json({
      summary, byCategory,
      metrics: metrics.map((m) => ({
        id: m.id, name: m.name, value: m.value, status: m.status, detail: m.detail, target: m.target,
      })),
      observations: {
        total: observations.length,
        unresolved: observations.filter((o: DkgNodePort) => !o.resolution).length,
      },
    });
  });

  // ── timeline ────────────────────────────────────
  app.get("/timeline", (c) => {
    const limit = parseInt(c.req.query("limit") ?? "30");
    const graph = deps.getGraph();
    const nodes = graph.getAllNodes();

    const timelineKinds = ["decision", "observation", "version-event"];
    const events: TimelineEventEntry[] = [];

    for (const n of nodes) {
      if (!timelineKinds.includes(n.kind)) continue;
      const base: TimelineEventEntry = { date: n.date ?? "unknown", kind: n.kind, id: n.id };

      if (n.kind === "decision") {
        Object.assign(base, { title: n.title, type: n.type, targets: n.targets, lifecycle: n.lifecycle });
      } else if (n.kind === "observation") {
        Object.assign(base, {
          finding: typeof n.finding === "string" ? n.finding.slice(0, 100) : n.finding,
          source: n.source, resolved: !!n.resolution, subjects: n.subjects,
        });
        const prompted = graph.neighbors(n.id, "prompts") as string[];
        if (prompted.length > 0) { base.linkedDecision = prompted[0]; base.loopClosed = true; }
      } else if (n.kind === "version-event") {
        Object.assign(base, { prefix: n.subjectId ?? n.prefix, fromVersion: n.fromVersion, toVersion: n.toVersion });
      }
      events.push(base);
    }

    events.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
    return c.json({ events: events.slice(0, limit), total: events.length });
  });

  return app;
}
