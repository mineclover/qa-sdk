type ObjectKind =
  | "axis_schema"
  | "taxonomy_schema"
  | "relation_category_schema"
  | "traversal_schema"
  | "node"
  | "relation_type"
  | "edge"
  | "traversal"
  | "governance_blueprint"
  | "governance_run";

interface OntologyObjectRecord {
  objectId: string;
  objectKind: ObjectKind | string;
  canonicalKey: string;
  schemaVersion: string;
  lifecycle: string;
  createdAt: string;
  updatedAt: string;
}

interface OntologyFacetRecord {
  objectId: string;
  facetKind: string;
  version: string;
  payloadJson: unknown;
  sourceRef?: string;
  recordedAt: string;
}

interface OntologyObservationRecord {
  observationId: string;
  targetObjectId: string;
  observationKind: string;
  rawContext?: Record<string, string>;
  payloadJson: unknown;
  observedAt: string;
}

interface OntologyProjectionRecord {
  projectionId: string;
  projectionKind: string;
  targetScope: string;
  payloadJson: unknown;
  builtFrom: string[];
  builtAt: string;
}

interface OntologyStoreFile {
  objects: OntologyObjectRecord[];
  facets: OntologyFacetRecord[];
  observations: OntologyObservationRecord[];
  projections: OntologyProjectionRecord[];
}

type NodeLane = "snapshot" | "corridor" | "checkpoint" | "traversal" | "governance";

interface ViewNode {
  id: string;
  label: string;
  kind: string;
  lane: NodeLane;
  status: "passed" | "failed" | "active" | "observed" | "unknown";
  summary: string;
  raw: unknown;
}

interface ViewEdge {
  from: string;
  to: string;
  label: string;
}

interface ViewModel {
  nodes: ViewNode[];
  edges: ViewEdge[];
  metrics: Record<string, number>;
}

interface UiState {
  store: OntologyStoreFile;
  selectedId: string | null;
  filter: "all" | NodeLane;
  sourceName: string;
}

const sampleStore: OntologyStoreFile = {
  objects: [
    {
      objectId: "governance-blueprint:event-ingest",
      objectKind: "governance_blueprint",
      canonicalKey: "governance-blueprint:corridor:event-ingest",
      schemaVersion: "v1",
      lifecycle: "active",
      createdAt: "2026-04-12T00:00:00.000Z",
      updatedAt: "2026-04-12T00:00:00.000Z",
    },
    {
      objectId: "governance-run:event-ingest:001",
      objectKind: "governance_run",
      canonicalKey: "governance:corridor:event-ingest:corridor_bundle:governance-run:event-ingest:001",
      schemaVersion: "v1",
      lifecycle: "active",
      createdAt: "2026-04-12T00:01:00.000Z",
      updatedAt: "2026-04-12T00:01:00.000Z",
    },
    {
      objectId: "traversal:observe:event-record:log-1",
      objectKind: "traversal",
      canonicalKey: "traversal:observe:event-record:log-1",
      schemaVersion: "v1",
      lifecycle: "active",
      createdAt: "2026-04-12T00:02:00.000Z",
      updatedAt: "2026-04-12T00:02:00.000Z",
    },
  ],
  facets: [
    {
      objectId: "governance-run:event-ingest:001",
      facetKind: "status",
      version: "v1:status:2026-04-12T00:01:00.000Z",
      payloadJson: { state: "passed", reason: "All governance constraints passed" },
      recordedAt: "2026-04-12T00:01:00.000Z",
    },
    {
      objectId: "governance-run:event-ingest:001",
      facetKind: "evidence",
      version: "v1:evidence:2026-04-12T00:01:00.000Z",
      payloadJson: {
        implementationRefs: ["packages/operational-ontology/src/internal/event-projector.ts"],
        verificationRefs: ["packages/operational-ontology/src/projectors-event.test.ts"],
        constraintVerdicts: [],
        adjustmentRecords: [],
      },
      recordedAt: "2026-04-12T00:01:00.000Z",
    },
    {
      objectId: "traversal:observe:event-record:log-1",
      facetKind: "route",
      version: "v1",
      payloadJson: {
        purpose: "observe",
        start: "event-record:log-1",
        edges: ["edge:event-record:log-1->payload:orderId"],
        end: "payload:orderId",
      },
      recordedAt: "2026-04-12T00:02:00.000Z",
    },
  ],
  observations: [
    {
      observationId: "observation:governance-run:event-ingest:001",
      targetObjectId: "governance-run:event-ingest:001",
      observationKind: "governance_evaluated",
      payloadJson: {
        blueprintId: "event-ingest-governance",
        familyKey: "governance:corridor:event-ingest:corridor_bundle",
        state: "passed",
        adjustmentCount: 0,
      },
      observedAt: "2026-04-12T00:01:00.000Z",
    },
    {
      observationId: "observation:traversal:event-record:log-1",
      targetObjectId: "traversal:observe:event-record:log-1",
      observationKind: "traversal_observed",
      payloadJson: { reached: true },
      observedAt: "2026-04-12T00:02:00.000Z",
    },
  ],
  projections: [
    {
      projectionId: "snapshot:event-ingest:001",
      projectionKind: "runtime_snapshot",
      targetScope: "event-ingest",
      builtFrom: ["event-record:log-1"],
      builtAt: "2026-04-12T00:00:30.000Z",
      payloadJson: {
        corridors: [{ flowId: "event-record:log-1", entryNodeId: "event-record:log-1" }],
        checkpointLattices: [
          {
            rootCheckpointId: "checkpoint:event-record:log-1",
            corridorId: "event-record:log-1",
          },
        ],
        traversals: [
          {
            traversal: {
              canonicalKey: "traversal:observe:event-record:log-1",
              purpose: "observe",
            },
          },
        ],
      },
    },
    {
      projectionId: "snapshot:event-ingest:001:corridor:event-record:log-1",
      projectionKind: "corridor",
      targetScope: "event-ingest",
      builtFrom: ["snapshot:event-ingest:001"],
      builtAt: "2026-04-12T00:00:31.000Z",
      payloadJson: { flowId: "event-record:log-1", templateKind: "event_record_observed" },
    },
    {
      projectionId: "snapshot:event-ingest:001:checkpoint-lattice:checkpoint:event-record:log-1",
      projectionKind: "checkpoint_lattice",
      targetScope: "event-ingest",
      builtFrom: ["snapshot:event-ingest:001"],
      builtAt: "2026-04-12T00:00:32.000Z",
      payloadJson: { rootCheckpointId: "checkpoint:event-record:log-1", corridorId: "event-record:log-1" },
    },
  ],
};

const state: UiState = {
  store: sampleStore,
  selectedId: null,
  filter: "all",
  sourceName: "sample store",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function asStoreFile(value: unknown): OntologyStoreFile {
  if (!isRecord(value)) throw new Error("JSON root must be an object");
  return {
    objects: Array.isArray(value["objects"]) ? (value["objects"] as OntologyObjectRecord[]) : [],
    facets: Array.isArray(value["facets"]) ? (value["facets"] as OntologyFacetRecord[]) : [],
    observations: Array.isArray(value["observations"]) ? (value["observations"] as OntologyObservationRecord[]) : [],
    projections: Array.isArray(value["projections"]) ? (value["projections"] as OntologyProjectionRecord[]) : [],
  };
}

function payloadLabel(payload: unknown, keys: string[]): string | undefined {
  if (!isRecord(payload)) return undefined;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function statusForObject(object: OntologyObjectRecord, facets: OntologyFacetRecord[]): ViewNode["status"] {
  const statusFacet = facets
    .filter((facet) => facet.objectId === object.objectId && facet.facetKind === "status")
    .at(-1);
  if (isRecord(statusFacet?.payloadJson)) {
    const stateValue = statusFacet.payloadJson["state"];
    if (stateValue === "passed" || stateValue === "failed") return stateValue;
  }
  return object.lifecycle === "active" ? "active" : "unknown";
}

function laneForProjection(kind: string): NodeLane {
  if (kind.includes("checkpoint")) return "checkpoint";
  if (kind.includes("corridor") || kind.includes("control-flow")) return "corridor";
  if (kind.includes("traversal")) return "traversal";
  return "snapshot";
}

function buildViewModel(store: OntologyStoreFile): ViewModel {
  const nodes = new Map<string, ViewNode>();
  const edges: ViewEdge[] = [];

  for (const projection of store.projections) {
    const lane = laneForProjection(projection.projectionKind);
    const label =
      payloadLabel(projection.payloadJson, ["flowId", "rootCheckpointId", "canonicalKey"]) ??
      projection.projectionId;
    nodes.set(projection.projectionId, {
      id: projection.projectionId,
      label,
      kind: projection.projectionKind,
      lane,
      status: "active",
      summary: `${projection.targetScope} · ${projection.builtAt}`,
      raw: projection,
    });
    for (const source of projection.builtFrom ?? []) {
      edges.push({ from: source, to: projection.projectionId, label: "built" });
    }
  }

  for (const object of store.objects) {
    if (!["governance_blueprint", "governance_run", "traversal"].includes(object.objectKind)) continue;
    const lane: NodeLane = object.objectKind === "traversal" ? "traversal" : "governance";
    nodes.set(object.objectId, {
      id: object.objectId,
      label: object.objectId.replace(/^governance-/, ""),
      kind: object.objectKind,
      lane,
      status: statusForObject(object, store.facets),
      summary: `${object.schemaVersion} · ${object.updatedAt}`,
      raw: {
        object,
        facets: store.facets.filter((facet) => facet.objectId === object.objectId),
      },
    });
  }

  for (const observation of store.observations) {
    const target = nodes.get(observation.targetObjectId);
    if (target) {
      target.status = observation.observationKind.includes("governance") ? target.status : "observed";
    }
  }

  const snapshotIds = [...nodes.values()].filter((node) => node.lane === "snapshot").map((node) => node.id);
  for (const node of nodes.values()) {
    if (node.lane !== "snapshot" && snapshotIds.length > 0 && !edges.some((edge) => edge.to === node.id)) {
      edges.push({ from: snapshotIds[0]!, to: node.id, label: "scope" });
    }
  }

  return {
    nodes: [...nodes.values()],
    edges: edges.filter((edge) => nodes.has(edge.from) && nodes.has(edge.to)),
    metrics: {
      objects: store.objects.length,
      projections: store.projections.length,
      observations: store.observations.length,
      governanceRuns: store.objects.filter((object) => object.objectKind === "governance_run").length,
      failed: [...nodes.values()].filter((node) => node.status === "failed").length,
    },
  };
}

function visibleNodes(model: ViewModel): ViewNode[] {
  return model.nodes.filter((node) => state.filter === "all" || node.lane === state.filter);
}

function nodePosition(node: ViewNode, indexInLane: number): { x: number; y: number } {
  const lanes: NodeLane[] = ["snapshot", "corridor", "checkpoint", "traversal", "governance"];
  const laneIndex = lanes.indexOf(node.lane);
  return {
    x: 105 + laneIndex * 210,
    y: 92 + indexInLane * 96,
  };
}

function renderTopology(model: ViewModel): string {
  const visible = visibleNodes(model);
  const positions = new Map<string, { x: number; y: number }>();
  const laneCounts = new Map<NodeLane, number>();
  for (const node of visible) {
    const count = laneCounts.get(node.lane) ?? 0;
    positions.set(node.id, nodePosition(node, count));
    laneCounts.set(node.lane, count + 1);
  }

  const edges = model.edges
    .filter((edge) => positions.has(edge.from) && positions.has(edge.to))
    .map((edge) => {
      const from = positions.get(edge.from)!;
      const to = positions.get(edge.to)!;
      const midX = (from.x + to.x) / 2;
      return `<path class="edge" d="M ${from.x + 72} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x - 72} ${to.y}" />`;
    })
    .join("");

  const nodes = visible
    .map((node) => {
      const point = positions.get(node.id)!;
      const selected = state.selectedId === node.id ? " selected" : "";
      return `
        <button class="graph-node ${node.lane} ${node.status}${selected}" style="left:${point.x - 70}px; top:${point.y - 32}px" data-node-id="${escapeHtml(node.id)}">
          <span>${escapeHtml(node.kind)}</span>
          <strong>${escapeHtml(node.label)}</strong>
        </button>
      `;
    })
    .join("");

  return `
    <div class="topology">
      <svg class="edges" viewBox="0 0 980 620" preserveAspectRatio="none" aria-hidden="true">${edges}</svg>
      ${nodes}
    </div>
  `;
}

function renderInspector(model: ViewModel): string {
  const selected = model.nodes.find((node) => node.id === state.selectedId) ?? model.nodes[0];
  if (!selected) {
    return `<section class="inspector"><h2>Inspector</h2><p>No ontology data loaded.</p></section>`;
  }
  return `
    <section class="inspector">
      <p class="eyebrow">${escapeHtml(selected.lane)} / ${escapeHtml(selected.status)}</p>
      <h2>${escapeHtml(selected.label)}</h2>
      <p>${escapeHtml(selected.summary)}</p>
      <pre>${escapeHtml(JSON.stringify(selected.raw, null, 2))}</pre>
    </section>
  `;
}

function renderObservationRows(store: OntologyStoreFile): string {
  return store.observations
    .toSorted((left, right) => right.observedAt.localeCompare(left.observedAt))
    .slice(0, 8)
    .map((observation) => `
      <tr>
        <td>${escapeHtml(observation.observationKind)}</td>
        <td>${escapeHtml(observation.targetObjectId)}</td>
        <td>${escapeHtml(observation.observedAt)}</td>
      </tr>
    `)
    .join("");
}

function renderApp(): void {
  const model = buildViewModel(state.store);
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  app.innerHTML = `
    <header class="shell-header">
      <div>
        <p class="eyebrow">Operational Ontology Web</p>
        <h1>Collected topology</h1>
      </div>
      <div class="actions">
        <label class="file-action">
          Load store JSON
          <input id="file-input" type="file" accept="application/json,.json" />
        </label>
        <button id="sample-button" type="button">Sample</button>
      </div>
    </header>

    <section class="metrics" aria-label="Store metrics">
      ${Object.entries(model.metrics).map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${value}</strong></div>`).join("")}
    </section>

    <nav class="filters" aria-label="Topology filter">
      ${(["all", "snapshot", "corridor", "checkpoint", "traversal", "governance"] as const).map((filter) => `
        <button type="button" class="${state.filter === filter ? "active" : ""}" data-filter="${filter}">${filter}</button>
      `).join("")}
    </nav>

    <section class="workspace">
      <div class="map">
        <div class="source-line">Source: ${escapeHtml(state.sourceName)}</div>
        ${renderTopology(model)}
      </div>
      ${renderInspector(model)}
    </section>

    <section class="observations">
      <div>
        <p class="eyebrow">Observation log</p>
        <h2>Latest signals</h2>
      </div>
      <table>
        <thead><tr><th>Kind</th><th>Target</th><th>Observed</th></tr></thead>
        <tbody>${renderObservationRows(state.store)}</tbody>
      </table>
    </section>
  `;

  app.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset["filter"] as UiState["filter"];
      state.selectedId = null;
      renderApp();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-node-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset["nodeId"] ?? null;
      renderApp();
    });
  });

  app.querySelector<HTMLButtonElement>("#sample-button")?.addEventListener("click", () => {
    state.store = sampleStore;
    state.sourceName = "sample store";
    state.selectedId = null;
    renderApp();
  });

  app.querySelector<HTMLInputElement>("#file-input")?.addEventListener("change", async (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      state.store = asStoreFile(parsed);
      state.sourceName = file.name;
      state.selectedId = null;
      renderApp();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Invalid store JSON");
    }
  });
}

renderApp();
