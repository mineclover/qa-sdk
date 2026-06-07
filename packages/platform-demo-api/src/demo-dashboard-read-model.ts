// @def.boundary platform-demo-system
// @def.doc platform-demo-system

type Status = "ok" | "warning" | "critical";

interface SchemaEntry {
  id: string;
  name: string;
  version: string;
  entries: number;
  capacity: number;
  headroom: number;
  status: Status;
}

interface PrefixEntry {
  id: string;
  name: string;
  category: string;
  lifecycle: "active" | "draft" | "deprecated";
  dimCount: number;
  axes: string[];
  consumers: string[];
}

interface ConsumerEntry {
  id: string;
  role: string;
  prefixes: string[];
}

interface EdgeEntry {
  from: string;
  to: string;
  type: "composes" | "consumes";
}

const schema: SchemaEntry[] = [
  axis("env", 5, 32),
  axis("region", 2, 32),
  axis("service", 16, 32),
  axis("namespace", 2, 32),
  axis("event_kind", 9, 32),
  axis("flow_phase", 6, 16),
  axis("actor", 5, 16),
  axis("resource", 8, 32),
  axis("lifecycle_state", 7, 16),
  axis("quality_signal", 6, 16),
  axis("package", 14, 32),
  axis("decision_level", 4, 8),
];

const consumers: ConsumerEntry[] = [
  { id: "platform-demo", role: "visualizer", prefixes: ["page_view", "endpoint", "flow_point", "permission"] },
  { id: "ingest-server", role: "collector", prefixes: ["event", "tracking", "health_event", "metric_aggregate"] },
  { id: "registry-service", role: "registry", prefixes: ["version_state", "schema_event", "dkg_event"] },
  { id: "definition-catalog", role: "knowledge", prefixes: ["contract_check", "schema_validation"] },
];

const prefixes: PrefixEntry[] = [
  prefix("page_view", "Page View", "observation", ["env", "region", "service", "namespace"]),
  prefix("endpoint", "Endpoint", "entity", ["env", "region", "service", "namespace", "resource"]),
  prefix("flow_point", "Flow Point", "event", ["service", "flow_phase", "actor"]),
  prefix("order_event", "Order Event", "event", ["service", "event_kind", "actor"]),
  prefix("permission", "Permission", "policy", ["service", "actor", "resource"]),
  prefix("event", "Event", "event", ["service", "event_kind"]),
  prefix("deploy_event", "Deploy Event", "event", ["env", "region", "service", "lifecycle_state"]),
  prefix("health_event", "Health Event", "observation", ["env", "region", "service", "quality_signal"]),
  prefix("pattern_match", "Pattern Match", "observation", ["service", "flow_phase", "quality_signal"]),
  prefix("pattern_anomaly", "Pattern Anomaly", "observation", ["service", "flow_phase", "quality_signal"]),
  prefix("cart_event", "Cart Event", "event", ["service", "event_kind", "actor"]),
  prefix("tracking", "Tracking", "observation", ["service", "actor", "resource"]),
  prefix("dkg_event", "DKG Event", "event", ["decision_level", "service", "quality_signal"]),
  prefix("dkg_decision_event", "DKG Decision", "event", ["decision_level", "actor", "resource"]),
  prefix("dkg_observation_event", "DKG Observation", "observation", ["decision_level", "quality_signal"]),
  prefix("build_event", "Build Event", "event", ["package", "quality_signal"]),
  prefix("test_event", "Test Event", "event", ["package", "quality_signal"]),
  prefix("contract_check", "Contract Check", "policy", ["package", "quality_signal"]),
  prefix("auth_event", "Auth Event", "event", ["service", "actor"]),
  prefix("rbac", "RBAC", "policy", ["service", "actor", "resource"]),
  prefix("content", "Content", "entity", ["service", "namespace", "resource"]),
  prefix("schema_event", "Schema Event", "event", ["package", "lifecycle_state"]),
  prefix("engine_event", "Engine Event", "event", ["package", "flow_phase", "quality_signal"]),
  prefix("schema_validation", "Schema Validation", "policy", ["package", "quality_signal"]),
  prefix("pipeline_point", "Pipeline Point", "event", ["package", "flow_phase"]),
  prefix("validation_event", "Validation Event", "event", ["package", "quality_signal"]),
  prefix("version_state", "Version State", "entity", ["package", "lifecycle_state"], "draft"),
  prefix("metric_aggregate", "Metric Aggregate", "observation", ["service", "quality_signal"], "draft"),
];

export const demoDashboardOverview = {
  nodes: { axis: schema.length, prefix: prefixes.length, domain: 6, decision: 5 },
  total: { nodes: schema.length + prefixes.length + consumers.length, edges: buildEdges().length },
  health: {
    constraints: "read-model online",
    domains: "6 domains",
    unresolved: 2,
  },
  observations: { total: 9, unresolved: 2 },
  lastConvergence: "platform-demo-read-model",
  lastBootstrap: "platform-demo-api",
};

export const demoDashboardFlowMap = {
  layers: { schema, prefix: prefixes, consumer: consumers },
  edges: buildEdges(),
  progress: {
    defined: prefixes.length,
    active: prefixes.filter((item) => item.lifecycle === "active").length,
    draft: prefixes.filter((item) => item.lifecycle === "draft").length,
    deprecated: prefixes.filter((item) => item.lifecycle === "deprecated").length,
  },
};

export const demoDashboardMetrics = {
  summary: { total: 24, ok: 20, warning: 4, critical: 0 },
  byCategory: {
    headroom: { ok: 7, warning: 1, critical: 0 },
    skew: { ok: 3, warning: 1, critical: 0 },
    overlap: { ok: 4, warning: 0, critical: 0 },
    conflict: { ok: 3, warning: 0, critical: 0 },
    health: { ok: 3, warning: 2, critical: 0 },
    coverage: { ok: 2, warning: 1, critical: 0 },
  },
  observations: { unresolved: 2 },
};

export const demoDashboardTimeline = {
  total: 5,
  events: [
    timeline("decision", "D-101", "Route demo pages through same-origin API proxy.", ["platform-demo", "gateway"]),
    timeline("observation", "OBS-244", "Dashboard and diagrams fell back to demo read-model.", ["dashboard", "diagram"], true),
    timeline("version-event", "VER-37", "Service prefix demo data refreshed.", ["service", "v1", "v2"]),
    timeline("observation", "OBS-239", "Range page UI bounded to current service shape.", ["range", "service"], true),
    timeline("decision", "D-098", "Separate display data from canonical demo catalog.", ["demo-display-data"]),
  ],
};

export const demoDashboardSchema = {
  axes: schema,
  prefixes,
  consumers,
};

function axis(id: string, entries: number, capacity: number): SchemaEntry {
  const headroom = capacity - entries;
  return {
    id,
    name: id,
    version: "1",
    entries,
    capacity,
    headroom,
    status: headroom <= 0 ? "critical" : headroom <= 1 ? "warning" : "ok",
  };
}

function prefix(
  id: string,
  name: string,
  category: string,
  axes: string[],
  lifecycle: PrefixEntry["lifecycle"] = "active",
): PrefixEntry {
  return {
    id,
    name,
    category,
    lifecycle,
    dimCount: axes.length,
    axes,
    consumers: consumersForPrefix(id),
  };
}

function consumersForPrefix(prefixId: string): string[] {
  return consumers
    .filter((consumer) => consumer.prefixes.includes(prefixId))
    .map((consumer) => consumer.id);
}

function buildEdges(): EdgeEntry[] {
  const composeEdges: EdgeEntry[] = prefixes.flatMap((item) =>
    item.axes.map((axisId) => ({ from: axisId, to: item.id, type: "composes" as const })),
  );
  const consumeEdges: EdgeEntry[] = consumers.flatMap((consumer) =>
    consumer.prefixes.map((prefixId) => ({ from: consumer.id, to: prefixId, type: "consumes" as const })),
  );
  return composeEdges.concat(consumeEdges);
}

function timeline(kind: string, id: string, title: string, targets: string[], resolved = false) {
  return {
    kind,
    id,
    date: new Date().toISOString().slice(0, 10),
    title,
    targets,
    resolved,
    loopClosed: resolved,
  };
}
