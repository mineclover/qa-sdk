import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DevDkgProvider } from "../../lib/dev-dkg-provider.js";
import type {
  CatalogPort,
  GraphRegistryPort,
  MetricValuePort,
} from "../../types/spec-core-ports.js";
import { AppError } from "@qa-sdk/core";

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
  impact?: string;
}

export interface DashboardServiceDeps {
  provider?: DevDkgProvider;
  getGraph?: () => GraphRegistryPort;
  getCatalog?: () => CatalogPort;
  collectMetrics?: () => MetricValuePort[];
  onCollect?: () => Promise<{ collected: boolean; changes: string[] }>;
  listCatalogs?: () => Promise<Array<{ id: string; name: string }>>;
}

export class DashboardService {
  private cachedHtml: string | null = null;

  constructor(private readonly deps: DashboardServiceDeps) {}

  static fromDeps(deps: DashboardServiceDeps) {
    return new DashboardService(deps);
  }

  isEnabled() {
    return Boolean(this.deps.provider || this.deps.getGraph);
  }

  getOverview() {
    const graph = this.getGraph();
    const nodes = graph.getAllNodes();

    const byKind: Record<string, number> = {};
    for (const node of nodes) {
      byKind[node.kind] = (byKind[node.kind] ?? 0) + 1;
    }

    const constraints = nodes.filter((node) => node.kind === "constraint");
    const domains = nodes.filter((node) => node.kind === "domain");
    const observations = nodes.filter((node) => node.kind === "observation");
    const unresolved = observations.filter((node) => !node.resolution).length;
    const activeConstraints = constraints.filter((node) => node.lifecycle === "active").length;
    const store = this.deps.provider?.getStore();

    return {
      nodes: byKind,
      total: { nodes: nodes.length, edges: graph.edgeCount },
      health: {
        constraints: `${activeConstraints}/${constraints.length}`,
        domains: `${domains.length} domains`,
        unresolved,
      },
      observations: { total: observations.length, unresolved },
      lastConvergence: store?.getMeta?.("last_convergence") ?? null,
      lastBootstrap: store?.getMeta?.("last_bootstrap") ?? null,
    };
  }

  getFlowMap() {
    const graph = this.getGraph();
    const catalog = this.getCatalog();
    const nodes = graph.getAllNodes();

    const schemaLayer: SchemaLayerEntry[] = [];
    for (const [id, axis] of Object.entries(catalog.axes)) {
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

    const prefixNodes = nodes.filter((node) => node.kind === "prefix");
    const consumerNodes = nodes.filter((node) => node.kind === "consumer");

    const prefixLayer: PrefixLayerEntry[] = prefixNodes.map((node) => {
      const axes = graph.neighbors(node.id, "composes") as string[];
      const consumers = consumerNodes
        .filter((consumer) => (Array.isArray(consumer.consumedPrefixes) ? consumer.consumedPrefixes : []).includes(node.id))
        .map((consumer) => consumer.id);
      return {
        id: node.id,
        name: node.name,
        category: node.category ?? "unknown",
        lifecycle: node.lifecycle ?? "active",
        dimCount: axes.length,
        axes,
        consumers,
      };
    });

    const consumerLayer: ConsumerLayerEntry[] = consumerNodes.map((node) => ({
      id: node.id,
      name: node.name,
      prefixes: node.consumedPrefixes ?? [],
      role: node.role ?? "unknown",
    }));

    const edges: DiagramEdgeEntry[] = [];
    for (const prefix of prefixNodes) {
      for (const axis of graph.neighbors(prefix.id, "composes") as string[]) {
        edges.push({ from: axis, to: prefix.id, type: "composes" });
      }
    }
    for (const consumer of consumerNodes) {
      for (const prefixId of (Array.isArray(consumer.consumedPrefixes) ? consumer.consumedPrefixes : [])) {
        edges.push({ from: consumer.id, to: prefixId, type: "consumes" });
      }
    }

    const active = prefixNodes.filter((node) => (node.lifecycle ?? "active") === "active").length;
    const draft = prefixNodes.filter((node) => node.lifecycle === "draft").length;
    const deprecated = prefixNodes.filter((node) => node.lifecycle === "deprecated").length;

    return {
      layers: { schema: schemaLayer, prefix: prefixLayer, consumer: consumerLayer },
      edges,
      progress: {
        defined: prefixNodes.length,
        active,
        draft,
        deprecated,
      },
    };
  }

  getMetrics() {
    const metrics = this.collectMetrics();
    const observations = this.getGraph().getAllNodes().filter((node) => node.kind === "observation");
    const summary = { ok: 0, warning: 0, critical: 0, total: metrics.length };
    const byCategory: Record<string, { ok: number; warning: number; critical: number }> = {};

    for (const metric of metrics) {
      summary[metric.status]++;
      const category = metric.id.split(":")[1] ?? "unknown";
      if (!byCategory[category]) {
        byCategory[category] = { ok: 0, warning: 0, critical: 0 };
      }
      byCategory[category][metric.status]++;
    }

    return {
      summary,
      byCategory,
      metrics: metrics.map((metric) => ({
        id: metric.id,
        name: metric.name,
        value: metric.value,
        status: metric.status,
        detail: metric.detail,
        target: metric.target,
      })),
      observations: {
        total: observations.length,
        unresolved: observations.filter((node) => !node.resolution).length,
      },
    };
  }

  getTimeline(limit = 30) {
    const graph = this.getGraph();
    const timelineKinds = new Set(["decision", "observation", "version-event"]);
    const events: TimelineEventEntry[] = [];

    for (const node of graph.getAllNodes()) {
      if (!timelineKinds.has(node.kind)) continue;

      const base: TimelineEventEntry = {
        date: node.date ?? "unknown",
        kind: node.kind,
        id: node.id,
      };

      if (node.kind === "decision") {
        base.title = node.title;
        base.type = node.type;
        base.targets = node.targets;
        base.lifecycle = node.lifecycle;
      } else if (node.kind === "observation") {
        base.finding = typeof node.finding === "string" ? node.finding.slice(0, 100) : node.finding;
        base.source = node.source;
        base.resolved = !!node.resolution;
        base.subjects = node.subjects;
        const prompted = graph.neighbors(node.id, "prompts") as string[];
        if (prompted.length > 0) {
          base.linkedDecision = prompted[0];
          base.loopClosed = true;
        }
      } else if (node.kind === "version-event") {
        base.prefix = node.subjectId ?? node.prefix;
        base.fromVersion = node.fromVersion;
        base.toVersion = node.toVersion;
        base.impact = node.impact;
      }

      events.push(base);
    }

    events.sort((left, right) => String(right.date ?? "").localeCompare(String(left.date ?? "")));
    return {
      events: events.slice(0, limit),
      total: events.length,
    };
  }

  getSchema() {
    const graph = this.getGraph();
    const catalog = this.getCatalog();
    const tables = graph.getNodesByKind("table");

    const deployedTables: Record<string, string> = {
      event_records: "qa-ingest",
      traces: "qa-ingest",
      qa_sessions: "qa-ingest",
      transmissions: "qa-ingest",
      verdict_reports: "qa-ingest",
      dead_letter_queue: "qa-ingest",
      insight_labels: "qa-ingest",
      prefix: "qa-registry",
      draft_lock: "qa-registry",
      axis_profile: "qa-registry",
      catalogs: "qa-registry",
      config: "qa-registry",
      service_endpoint: "qa-registry",
      event_schema: "qa-registry",
      schema_version: "qa-registry",
    };

    const result = tables.map((table) => {
      const refs = graph.getTableColumnRefs(table.id);
      const columns = ((table as { columns?: string[] }).columns ?? []).map((column) => {
        const ref = refs.find((entry) => entry.column === column);
        const definition: Record<string, unknown> = { name: column };

        if (!ref) {
          definition.type = "scalar";
        } else if (ref.refKind === "fk") {
          definition.type = "table_ref";
          definition.target = ref.targetId;
        } else if (ref.refKind === "column_axis") {
          definition.type = "axis_ref";
          definition.axis = ref.targetId;
          const axisDef = catalog.axes[ref.targetId];
          if (axisDef) {
            const versions = Object.keys(axisDef.versions);
            const latest = axisDef.versions[versions[versions.length - 1]];
            definition.entries = latest?.entries?.length ?? 0;
            definition.capacity = latest?.capacity ?? 0;
          }
        } else {
          definition.type = "prefix_ref";
          definition.prefix = ref.targetId;
        }
        return definition;
      });

      return {
        id: table.id,
        name: table.name,
        columns,
        ddlStatus: deployedTables[table.id] ? "deployed" : "catalog-only",
        d1Database: deployedTables[table.id] ?? null,
        columnCount: columns.length,
        refCount: refs.length,
        axisRefs: columns.filter((column) => column.type === "axis_ref").length,
        tableRefs: columns.filter((column) => column.type === "table_ref").length,
        prefixRefs: columns.filter((column) => column.type === "prefix_ref").length,
      };
    });

    return {
      total: result.length,
      deployed: result.filter((table) => table.ddlStatus === "deployed").length,
      catalogOnly: result.filter((table) => table.ddlStatus === "catalog-only").length,
      tables: result,
    };
  }

  async collect() {
    if (!this.deps.onCollect) {
      return { collected: false, reason: "collector not configured" };
    }
    return this.deps.onCollect();
  }

  refresh() {
    if (!this.deps.provider) {
      throw new AppError("SERVICE_UNAVAILABLE", "dev dashboard not enabled", 503);
    }
    this.deps.provider.refresh();
    return { ok: true, message: "Cache invalidated. Next request will re-bootstrap." };
  }

  async listCatalogs() {
    const catalogs = [{ id: "demo", name: "DEMO_CATALOG (기본)" }];
    try {
      const stored = await this.deps.listCatalogs?.();
      if (stored) {
        for (const catalog of stored) {
          if (catalog.id !== "demo") {
            catalogs.push(catalog);
          }
        }
      }
    } catch {
      // catalog store 실패 시 기본 카탈로그만 반환한다.
    }
    return { catalogs };
  }

  getHtml() {
    if (!this.deps.provider) {
      throw new AppError("SERVICE_UNAVAILABLE", "dev dashboard not enabled", 503);
    }
    if (!this.cachedHtml) {
      try {
        const dir = dirname(fileURLToPath(import.meta.url));
        this.cachedHtml = readFileSync(join(dir, "../../../public/dev-dashboard.html"), "utf-8");
      } catch {
        throw new AppError("NOT_FOUND", "Dashboard HTML not found", 404);
      }
    }
    return this.cachedHtml;
  }

  getRealtimeUpdate() {
    const overview = this.getOverview();
    const metrics = this.getMetrics();
    return {
      type: "update",
      data: {
        overview: {
          nodes: overview.nodes,
          observations: overview.observations,
        },
        metrics: {
          summary: metrics.summary,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  close() {
    this.deps.provider?.close();
  }

  private getGraph() {
    const graph = this.deps.provider?.getGraph() ?? this.deps.getGraph?.();
    if (!graph) {
      throw new AppError("SERVICE_UNAVAILABLE", "DKG graph not initialized", 503);
    }
    return graph;
  }

  private getCatalog() {
    const catalog = this.deps.provider?.getCatalog() ?? this.deps.getCatalog?.();
    if (!catalog) {
      throw new AppError("SERVICE_UNAVAILABLE", "catalog not available", 503);
    }
    return catalog;
  }

  private collectMetrics() {
    const metrics = this.deps.provider
      ? this.deps.provider.collectMetrics()
      : this.deps.collectMetrics?.();
    if (!metrics) {
      throw new AppError("SERVICE_UNAVAILABLE", "metrics not available (no analysis module)", 503);
    }
    return metrics;
  }
}
