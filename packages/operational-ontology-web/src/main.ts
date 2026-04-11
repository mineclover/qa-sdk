import {
  layoutOntologyGraph,
  operationalStoreToOntologyView,
  renderOntologyGraphSvg,
  type OntologyGraphViewModel,
  type OntologyLane,
  type OntologyViewNode,
} from "viz-core/ontology-graph";

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

type NodeLane = Extract<OntologyLane, "snapshot" | "corridor" | "checkpoint" | "traversal" | "governance">;

type ViewNode = OntologyViewNode;

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

const sampleFiles = [
  { label: "Event store", path: "/samples/event-store.json" },
  { label: "Pipe store", path: "/samples/pipe-store.json" },
  { label: "Snapshot store", path: "/samples/snapshot-store.json" },
];

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

function renderInspector(model: OntologyGraphViewModel): string {
  const selected = model.nodes.find((node) => node.id === state.selectedId) ?? model.nodes[0];
  if (!selected) {
    return `<section class="inspector"><h2>Inspector</h2><p>No ontology data loaded.</p></section>`;
  }
  return `
    <section class="inspector">
      <p class="eyebrow">${escapeHtml(selected.lane)} / ${escapeHtml(selected.status ?? "unknown")}</p>
      <h2>${escapeHtml(selected.label)}</h2>
      <p>${escapeHtml(selected.summary ?? "")}</p>
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
  const model = operationalStoreToOntologyView(state.store);
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
      ${Object.entries(model.metrics ?? {}).map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${value}</strong></div>`).join("")}
    </section>

    <nav class="filters" aria-label="Topology filter">
      ${(["all", "snapshot", "corridor", "checkpoint", "traversal", "governance"] as const).map((filter) => `
        <button type="button" class="${state.filter === filter ? "active" : ""}" data-filter="${filter}">${filter}</button>
      `).join("")}
    </nav>

    <section class="sample-row" aria-label="Sample stores">
      <span>Store JSON</span>
      ${sampleFiles.map((sample) => `<button type="button" data-sample-path="${sample.path}">${sample.label}</button>`).join("")}
    </section>

    <section class="workspace">
      <div class="map">
        <div class="source-line">Source: ${escapeHtml(state.sourceName)}</div>
        <div class="topology">${renderOntologyGraphSvg(layoutOntologyGraph(model, { laneOrder: ["snapshot", "corridor", "checkpoint", "traversal", "governance"], nodeWidth: 150 }))}</div>
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

  app.querySelectorAll<HTMLButtonElement>("[data-sample-path]").forEach((button) => {
    button.addEventListener("click", async () => {
      const path = button.dataset["samplePath"];
      if (!path) return;
      const response = await fetch(path);
      state.store = asStoreFile((await response.json()) as unknown);
      state.sourceName = path;
      state.selectedId = null;
      renderApp();
    });
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
