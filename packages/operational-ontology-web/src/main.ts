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
  sampleKey: SampleScenarioKey;
  storeSection: StoreSectionKey;
  selectedRecordKey: string | null;
  recordQuery: string;
  recordFilter: RecordFilterMode;
  rawJsonExpanded: boolean;
  copyNotice: string | null;
}

type StoreSectionKey = "objects" | "facets" | "observations" | "projections";
type SampleScenarioKey = "inline" | "event" | "pipe" | "snapshot" | "custom";
type RecordFilterMode = "all" | "graph-linked" | "issues";

interface StoreSectionInfo {
  key: StoreSectionKey;
  label: string;
  summary: string;
  reads: string;
}

interface SampleFile {
  key: SampleScenarioKey;
  label: string;
  description: string;
  path: string;
}

interface SampleGuide {
  label: string;
  question: string;
  inspect: string[];
  expected: string[];
  note: string;
}

interface InsightFact {
  label: string;
  value: string;
}

interface RecordInsight {
  title: string;
  description: string;
  facts: InsightFact[];
  interpretation: string[];
  sourceRefs: string[];
}

type HealthSeverity = "ok" | "warning" | "error";

interface StoreHealthItem {
  label: string;
  value: string;
  severity: HealthSeverity;
  detail: string;
}

interface StoreIssue {
  id: string;
  severity: Exclude<HealthSeverity, "ok">;
  title: string;
  detail: string;
  row: StoreRecordRow;
}

interface ProjectionAnalysis {
  mode: "snapshot" | "corridor" | "checkpoint" | "traversal" | "generic";
  validation: boolean | undefined;
  issues: string[];
  counts: [string, number][];
  focus: InsightFact[];
}

interface StoreRecordRow {
  section: StoreSectionKey;
  index: number;
  key: string;
  record: unknown;
  title: string;
  kind: string;
  detail: string;
  timestamp: string;
}

interface RelatedRecordRow extends StoreRecordRow {
  reason: string;
  score: number;
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
  sampleKey: "inline",
  storeSection: "projections",
  selectedRecordKey: null,
  recordQuery: "",
  recordFilter: "all",
  rawJsonExpanded: false,
  copyNotice: null,
};

const sampleFiles: SampleFile[] = [
  {
    key: "event",
    label: "Event observation",
    description: "EventRecord payload and address_context bindings.",
    path: "/samples/event-store.json",
  },
  {
    key: "pipe",
    label: "Pipe execution",
    description: "PipeGraph steps, conditions, transmissions, and junctions.",
    path: "/samples/pipe-store.json",
  },
  {
    key: "snapshot",
    label: "Complete snapshot",
    description: "Corridor, checkpoint, traversal, and validation bundles.",
    path: "/samples/snapshot-store.json",
  },
];

const sampleGuides: Record<SampleScenarioKey, SampleGuide> = {
  inline: {
    label: "Inline sample",
    question: "Can a governance run, traversal record, and runtime snapshot be read as one small operational topology?",
    inspect: ["Projection summary", "Governance run object", "Traversal route facet"],
    expected: ["Graph nodes link back to store records", "Governance run status is passed", "Traversal observation targets a known object"],
    note: "This sample is intentionally small. Use it to verify the reader workflow before loading larger store files.",
  },
  event: {
    label: "Event observation",
    question: "Does an EventRecord payload and address_context become an observable corridor?",
    inspect: ["Projection validation", "Corridors", "Address binding contracts", "Observation links"],
    expected: ["Event payload fields appear as production endpoints", "address_context bindings appear as consumption endpoints", "Health may warn because this sample only includes the event side"],
    note: "A missing pipe_graph warning is expected here. This sample isolates event materialization, not full topology completeness.",
  },
  pipe: {
    label: "Pipe execution",
    question: "Does a PipeGraph produce a corridor with conditional paths and transmissions?",
    inspect: ["Control flows", "Junctions", "Transmissions", "Missing topology health"],
    expected: ["collect-order branches to validate-order", "transmissions connect production to consumption", "Health may warn because event and checkpoint material are intentionally absent"],
    note: "Use this sample to inspect implementation flow shape. It is not expected to satisfy full snapshot completeness by itself.",
  },
  snapshot: {
    label: "Complete snapshot",
    question: "Do event, pipe, checkpoint, and traversal bundles combine into a complete operational snapshot?",
    inspect: ["Store health", "Snapshot projection", "Checkpoint lattice", "Traversal signals"],
    expected: ["Projection validation is clear", "Corridor coverage includes both pipe and event sides", "Traversal reaches the expected goal without loop or recovery"],
    note: "Use this sample as the baseline for what a healthy combined store should feel like.",
  },
  custom: {
    label: "Loaded file",
    question: "What does this store file say about collected signals, materialized facts, and rebuilt views?",
    inspect: ["Store health", "Projection diagnostics", "Related records", "Graph links"],
    expected: ["Projection validation identifies missing topology", "Related records expose target/source references", "Graph-linked records highlight visible topology nodes"],
    note: "For uploaded files, start with Store health, then open the first failing or warning projection.",
  },
};

const storeSections: StoreSectionInfo[] = [
  {
    key: "objects",
    label: "Objects",
    summary: "Canonical identities for schema, graph, traversal, and governance records.",
    reads: "What exists?",
  },
  {
    key: "facets",
    label: "Facets",
    summary: "Versioned facts attached to an object: status, route, evidence, grammar, or validation.",
    reads: "What is known?",
  },
  {
    key: "observations",
    label: "Observations",
    summary: "Append-only signals that say a target object was seen, evaluated, traversed, or changed.",
    reads: "What happened?",
  },
  {
    key: "projections",
    label: "Projections",
    summary: "Derived topology views rebuilt from objects, facets, and observations.",
    reads: "What can be queried?",
  },
];

const metricLabels: Record<string, string> = {
  objects: "Objects",
  projections: "Projections",
  observations: "Observations",
  graphEdges: "Graph edges",
  governanceRuns: "Governance runs",
  failed: "Failed",
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

function stringField(record: unknown, key: string): string | undefined {
  if (!isRecord(record)) return undefined;
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function arrayLengthField(record: unknown, key: string): number {
  if (!isRecord(record)) return 0;
  const value = record[key];
  return Array.isArray(value) ? value.length : 0;
}

function payloadJson(record: unknown): unknown {
  return isRecord(record) ? record["payloadJson"] : undefined;
}

function payloadRecord(record: unknown): Record<string, unknown> | undefined {
  const payload = payloadJson(record);
  return isRecord(payload) ? payload : undefined;
}

function payloadArrayLength(record: unknown, key: string): number {
  const payload = payloadRecord(record);
  const value = payload?.[key];
  return Array.isArray(value) ? value.length : 0;
}

function payloadArray(record: unknown, key: string): unknown[] {
  const payload = payloadRecord(record);
  const value = payload?.[key];
  return Array.isArray(value) ? value : [];
}

function payloadString(record: unknown, key: string): string | undefined {
  const payload = payloadRecord(record);
  const value = payload?.[key];
  return typeof value === "string" ? value : undefined;
}

function payloadBoolean(record: unknown, key: string): boolean | undefined {
  const payload = payloadRecord(record);
  const value = payload?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function nestedPayloadBoolean(record: unknown, parentKey: string, childKey: string): boolean | undefined {
  const parent = payloadRecord(record)?.[parentKey];
  if (!isRecord(parent)) return undefined;
  const value = parent[childKey];
  return typeof value === "boolean" ? value : undefined;
}

function nestedPayloadRecord(record: unknown, parentKey: string): Record<string, unknown> | undefined {
  const parent = payloadRecord(record)?.[parentKey];
  return isRecord(parent) ? parent : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function payloadKeys(record: unknown): string[] {
  return Object.keys(payloadRecord(record) ?? {});
}

function formatCount(value: number, label: string): string {
  return `${value} ${label}`;
}

function formatList(values: readonly string[], empty = "none"): string {
  if (values.length === 0) return empty;
  return values.slice(0, 4).join(", ") + (values.length > 4 ? ` +${values.length - 4}` : "");
}

function humanizeKind(value: string): string {
  return value.replaceAll("_", " ");
}

function metricLabel(key: string): string {
  return metricLabels[key] ?? key.replace(/([A-Z])/g, " $1").toLowerCase();
}

function visibleModelForFilter(model: OntologyGraphViewModel): OntologyGraphViewModel {
  if (state.filter === "all") return model;
  const nodes = model.nodes.filter((node) => node.lane === state.filter);
  const visibleIds = new Set(nodes.map((node) => node.id));
  return {
    ...model,
    nodes,
    edges: model.edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)),
  };
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

function renderStorePrimer(store: OntologyStoreFile): string {
  return `
    <section class="store-primer" aria-label="Store shape">
      <div class="primer-copy">
        <p class="eyebrow">Store shape</p>
        <h2>Four records, one operational view</h2>
        <p>Store JSON is the read model for operational ontology collection. It keeps identity, facts, incoming signals, and rebuilt topology separate so each layer can evolve without freezing the others.</p>
      </div>
      <dl class="store-terms">
        ${storeSections.map((section) => `
          <div>
            <dt>${escapeHtml(section.label)} <span>${store[section.key].length}</span></dt>
            <dd>${escapeHtml(section.summary)}</dd>
            <dd class="reads">${escapeHtml(section.reads)}</dd>
          </div>
        `).join("")}
      </dl>
    </section>
  `;
}

function renderStoreHealth(store: OntologyStoreFile): string {
  const health = storeHealth(store);
  const summary = health.some((item) => item.severity === "error")
    ? "Action needed"
    : health.some((item) => item.severity === "warning")
      ? "Review recommended"
      : "Clear";

  return `
    <section class="health-strip" aria-label="Store health">
      <div class="health-title">
        <p class="eyebrow">Store health</p>
        <h2>${escapeHtml(summary)}</h2>
      </div>
      <div class="health-items">
        ${health.map((item) => `
          <div class="health-item ${item.severity}">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
            <p>${escapeHtml(item.detail)}</p>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderIssueQueue(store: OntologyStoreFile): string {
  const issues = storeIssues(store);
  return `
    <section class="issue-queue" aria-label="Issue queue">
      <div class="issue-copy">
        <p class="eyebrow">Issue queue</p>
        <h2>${issues.length > 0 ? `${issues.length} open` : "No open issues"}</h2>
        <p>${issues.length > 0 ? "Open a queued issue to inspect the source record with the Issues filter applied." : "Health checks did not find projection, governance, traversal, or observation-link issues in this store."}</p>
      </div>
      <div class="issue-list">
        ${issues.length === 0 ? `
          <div class="issue-empty">
            <strong>Clear</strong>
            <span>Projection validation, missing topology, governance, traversal, and observation links are clean.</span>
          </div>
        ` : issues.map((issue) => `
          <button type="button" class="${issue.severity}" data-issue-section="${issue.row.section}" data-issue-record-key="${escapeHtml(issue.row.key)}">
            <span>${escapeHtml(issue.row.section)} / ${escapeHtml(issue.row.kind)}</span>
            <strong>${escapeHtml(issue.title)}</strong>
            <small>${escapeHtml(issue.detail)}</small>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderScenarioGuide(): string {
  const guide = sampleGuides[state.sampleKey] ?? sampleGuides.custom;
  return `
    <section class="scenario-guide" aria-label="Scenario guide">
      <div class="scenario-copy">
        <p class="eyebrow">Scenario guide</p>
        <h2>${escapeHtml(guide.label)}</h2>
        <p>${escapeHtml(guide.question)}</p>
      </div>
      <div class="scenario-steps">
        <div>
          <span>Inspect</span>
          <ul>${guide.inspect.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <div>
          <span>Expected signals</span>
          <ul>${guide.expected.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <div>
          <span>Read note</span>
          <p>${escapeHtml(guide.note)}</p>
        </div>
      </div>
    </section>
  `;
}

function renderReadPath(): string {
  return `
    <section class="read-path" aria-label="Operational ontology read path">
      <div>
        <span>1</span>
        <strong>Signal enters</strong>
        <p>Observations capture evaluator, traversal, and runtime events.</p>
      </div>
      <div>
        <span>2</span>
        <strong>Identity is anchored</strong>
        <p>Objects give each schema, traversal, edge, or governance run a stable coordinate.</p>
      </div>
      <div>
        <span>3</span>
        <strong>Facts attach</strong>
        <p>Facets add status, route, evidence, aggregate, and validation details.</p>
      </div>
      <div>
        <span>4</span>
        <strong>View is rebuilt</strong>
        <p>Projections assemble the current topology for graph, search, and inspection.</p>
      </div>
    </section>
  `;
}

function storeRecordKey(section: StoreSectionKey, record: unknown, index: number): string {
  switch (section) {
    case "objects":
      return stringField(record, "objectId") ?? `${section}:${index}`;
    case "facets":
      return [
        stringField(record, "objectId"),
        stringField(record, "facetKind"),
        stringField(record, "version"),
      ].filter(Boolean).join(":") || `${section}:${index}`;
    case "observations":
      return stringField(record, "observationId") ?? `${section}:${index}`;
    case "projections":
      return stringField(record, "projectionId") ?? `${section}:${index}`;
  }
}

function storeRecordTitle(section: StoreSectionKey, record: unknown): string {
  switch (section) {
    case "objects":
      return stringField(record, "objectId") ?? "object";
    case "facets":
      return stringField(record, "objectId") ?? "facet";
    case "observations":
      return stringField(record, "observationKind") ?? "observation";
    case "projections":
      return stringField(record, "projectionId") ?? "projection";
  }
}

function storeRecordKind(section: StoreSectionKey, record: unknown): string {
  switch (section) {
    case "objects":
      return stringField(record, "objectKind") ?? "object";
    case "facets":
      return stringField(record, "facetKind") ?? "facet";
    case "observations":
      return stringField(record, "targetObjectId") ?? "target";
    case "projections":
      return stringField(record, "projectionKind") ?? "projection";
  }
}

function storeRecordDetail(section: StoreSectionKey, record: unknown): string {
  switch (section) {
    case "objects":
      return stringField(record, "canonicalKey") ?? stringField(record, "lifecycle") ?? "";
    case "facets":
      return stringField(record, "version") ?? stringField(record, "sourceRef") ?? "";
    case "observations":
      return stringField(record, "observationId") ?? "";
    case "projections": {
      const targetScope = stringField(record, "targetScope") ?? "scope";
      const builtFromCount = arrayLengthField(record, "builtFrom");
      return `${targetScope} · built from ${builtFromCount}`;
    }
  }
}

function storeRecordTimestamp(section: StoreSectionKey, record: unknown): string {
  switch (section) {
    case "objects":
      return stringField(record, "updatedAt") ?? "";
    case "facets":
      return stringField(record, "recordedAt") ?? "";
    case "observations":
      return stringField(record, "observedAt") ?? "";
    case "projections":
      return stringField(record, "builtAt") ?? "";
  }
}

function storeRecords(store: OntologyStoreFile, section: StoreSectionKey): readonly unknown[] {
  return store[section] as readonly unknown[];
}

function storeRecordRow(section: StoreSectionKey, record: unknown, index: number): StoreRecordRow {
  return {
    section,
    index,
    key: storeRecordKey(section, record, index),
    record,
    title: storeRecordTitle(section, record),
    kind: storeRecordKind(section, record),
    detail: storeRecordDetail(section, record),
    timestamp: storeRecordTimestamp(section, record),
  };
}

function storeRecordRows(store: OntologyStoreFile, section: StoreSectionKey): StoreRecordRow[] {
  return storeRecords(store, section).map((record, index) => storeRecordRow(section, record, index));
}

function allStoreRecordRows(store: OntologyStoreFile): StoreRecordRow[] {
  return storeSections.flatMap((section) => storeRecordRows(store, section.key));
}

function getActiveStoreRecord(store: OntologyStoreFile, model: OntologyGraphViewModel): StoreRecordRow | undefined {
  return (
    (state.selectedRecordKey ? visibleRecordRows(store, model, state.storeSection).find((row) => row.key === state.selectedRecordKey) : undefined) ??
    visibleRecordRows(store, model, state.storeSection)[0] ??
    storeRecordRows(store, state.storeSection)[0]
  );
}

function findStoreRecordRow(store: OntologyStoreFile, section: StoreSectionKey, key: string): StoreRecordRow | undefined {
  return storeRecordRows(store, section).find((row) => row.key === key);
}

function recordPath(row: StoreRecordRow): string {
  return `store.${row.section}[${row.index}]`;
}

function rawJsonPreview(rawJson: string): string {
  const compact = rawJson.replace(/\s+/g, " ");
  return compact.length > 260 ? `${compact.slice(0, 260)}...` : compact;
}

function normalizedQuery(): string {
  return state.recordQuery.trim().toLowerCase();
}

function graphNodeIdForStoreRecord(row: StoreRecordRow, model: OntologyGraphViewModel): string | null {
  const nodeIds = new Set(model.nodes.map((node) => node.id));
  const candidates =
    row.section === "objects"
      ? [stringField(row.record, "objectId")]
      : row.section === "projections"
        ? [stringField(row.record, "projectionId")]
        : row.section === "facets"
          ? [stringField(row.record, "objectId"), stringField(row.record, "sourceRef")]
          : [stringField(row.record, "targetObjectId"), stringField(row.record, "observationId")];
  return candidates.find((candidate): candidate is string => candidate !== undefined && nodeIds.has(candidate)) ?? null;
}

function storeRecordForGraphNode(store: OntologyStoreFile, nodeId: string): StoreRecordRow | undefined {
  const projection = storeRecordRows(store, "projections").find((row) => stringField(row.record, "projectionId") === nodeId);
  if (projection) return projection;
  const object = storeRecordRows(store, "objects").find((row) => stringField(row.record, "objectId") === nodeId);
  if (object) return object;
  const facet = storeRecordRows(store, "facets").find((row) => stringField(row.record, "objectId") === nodeId || stringField(row.record, "sourceRef") === nodeId);
  if (facet) return facet;
  return storeRecordRows(store, "observations").find((row) => stringField(row.record, "targetObjectId") === nodeId);
}

function selectStoreRecord(row: StoreRecordRow, model: OntologyGraphViewModel): void {
  state.storeSection = row.section;
  state.selectedRecordKey = row.key;
  state.rawJsonExpanded = false;
  state.copyNotice = null;
  const graphNodeId = graphNodeIdForStoreRecord(row, model);
  state.selectedId = graphNodeId;
  if (graphNodeId && state.filter !== "all") {
    const node = model.nodes.find((entry) => entry.id === graphNodeId);
    if (node && node.lane !== state.filter) state.filter = "all";
  }
}

function selectGraphNode(store: OntologyStoreFile, nodeId: string): void {
  state.selectedId = nodeId;
  const record = storeRecordForGraphNode(store, nodeId);
  if (!record) return;
  state.recordQuery = "";
  state.recordFilter = "all";
  state.storeSection = record.section;
  state.selectedRecordKey = record.key;
  state.rawJsonExpanded = false;
  state.copyNotice = null;
}

function isReferenceKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.endsWith("id") ||
    lower.endsWith("ids") ||
    lower.endsWith("key") ||
    lower.endsWith("keys") ||
    lower.includes("ref") ||
    ["start", "end", "flowid", "entrynodeid", "corridorid", "rootcheckpointid", "source", "target"].includes(lower)
  );
}

function collectStrongReferences(value: unknown, refs = new Set<string>(), parentKey = ""): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && item.length >= 3 && isReferenceKey(parentKey)) {
        refs.add(item);
      } else {
        collectStrongReferences(item, refs, parentKey);
      }
    }
    return refs;
  }
  if (!isRecord(value)) return refs;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && entry.length >= 3 && isReferenceKey(key)) {
      refs.add(entry);
    } else if (Array.isArray(entry) || isRecord(entry)) {
      collectStrongReferences(entry, refs, key);
    }
  }
  return refs;
}

function recordReferenceSet(row: Pick<StoreRecordRow, "key" | "record" | "title">): Set<string> {
  const refs = collectStrongReferences(row.record);
  refs.add(row.key);
  refs.add(row.title);
  return refs;
}

function intersection(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((value) => right.has(value));
}

function recordText(record: unknown): string {
  try {
    return JSON.stringify(record);
  } catch {
    return "";
  }
}

function relatedReason(selected: StoreRecordRow, candidate: StoreRecordRow): { reason: string; score: number } | null {
  const selectedRefs = recordReferenceSet(selected);
  const candidateRefs = recordReferenceSet(candidate);
  const selectedText = recordText(selected.record);
  const candidateText = recordText(candidate.record);
  const shared = intersection(selectedRefs, candidateRefs);
  const selectedObjectId = stringField(selected.record, "objectId");
  const selectedProjectionId = stringField(selected.record, "projectionId");
  const selectedObservationId = stringField(selected.record, "observationId");
  const selectedTargetObjectId = stringField(selected.record, "targetObjectId");
  const candidateObjectId = stringField(candidate.record, "objectId");
  const candidateProjectionId = stringField(candidate.record, "projectionId");
  const candidateObservationId = stringField(candidate.record, "observationId");
  const candidateTargetObjectId = stringField(candidate.record, "targetObjectId");
  const candidateSourceRef = stringField(candidate.record, "sourceRef");
  const selectedBuiltFrom = stringArray(isRecord(selected.record) ? selected.record["builtFrom"] : []);
  const candidateBuiltFrom = stringArray(isRecord(candidate.record) ? candidate.record["builtFrom"] : []);

  if (selected.section === "objects" && selectedObjectId) {
    if (candidate.section === "facets" && candidateObjectId === selectedObjectId) return { reason: "Facet for this object", score: 100 };
    if (candidate.section === "observations" && candidateTargetObjectId === selectedObjectId) return { reason: "Observation targets this object", score: 96 };
    if (candidate.section === "projections" && candidateText.includes(selectedObjectId)) return { reason: "Projection references this object", score: 76 };
  }

  if (selected.section === "facets" && selectedObjectId) {
    if (candidate.section === "objects" && candidateObjectId === selectedObjectId) return { reason: "Target object", score: 100 };
    if (candidate.section === "observations" && candidateTargetObjectId === selectedObjectId) return { reason: "Signal for the same object", score: 88 };
    if (candidate.section === "projections" && (candidateText.includes(selectedObjectId) || candidateProjectionId === stringField(selected.record, "sourceRef"))) {
      return { reason: "Projection carries this facet context", score: 78 };
    }
  }

  if (selected.section === "observations") {
    if (candidate.section === "objects" && candidateObjectId === selectedTargetObjectId) return { reason: "Observed object", score: 100 };
    if (candidate.section === "facets" && candidateObjectId === selectedTargetObjectId) return { reason: "Facet on observed object", score: 92 };
    if (candidate.section === "projections" && selectedObservationId && candidateText.includes(selectedObservationId)) return { reason: "Projection built from this signal", score: 84 };
    if (candidate.section === "projections" && selectedTargetObjectId && candidateText.includes(selectedTargetObjectId)) return { reason: "Projection includes observed target", score: 78 };
  }

  if (selected.section === "projections") {
    if (candidate.section === "projections" && candidateProjectionId && selectedBuiltFrom.includes(candidateProjectionId)) return { reason: "Source projection in builtFrom", score: 100 };
    if (candidate.section === "projections" && selectedProjectionId && candidateBuiltFrom.includes(selectedProjectionId)) return { reason: "Derived projection", score: 94 };
    if (candidate.section === "objects" && candidateObjectId && selectedText.includes(candidateObjectId)) return { reason: "Object referenced by projection", score: 88 };
    if (candidate.section === "facets" && candidateObjectId && selectedText.includes(candidateObjectId)) return { reason: "Facet target appears in projection", score: 78 };
    if (candidate.section === "facets" && candidateSourceRef === selectedProjectionId) return { reason: "Facet recorded from projection", score: 82 };
    if (candidate.section === "observations" && candidateObservationId && (selectedBuiltFrom.includes(candidateObservationId) || selectedText.includes(candidateObservationId))) {
      return { reason: "Source observation", score: 86 };
    }
    if (candidate.section === "observations" && candidateTargetObjectId && selectedText.includes(candidateTargetObjectId)) {
      return { reason: "Observation target appears in projection", score: 74 };
    }
  }

  if (shared.length > 0) {
    return { reason: `Shared reference: ${shared[0]}`, score: 50 };
  }
  return null;
}

function relatedRecords(store: OntologyStoreFile, selected: StoreRecordRow): RelatedRecordRow[] {
  return allStoreRecordRows(store)
    .filter((row) => !(row.section === selected.section && row.key === selected.key))
    .map((row) => {
      const relation = relatedReason(selected, row);
      return relation ? { ...row, reason: relation.reason, score: relation.score } : null;
    })
    .filter((row): row is RelatedRecordRow => Boolean(row))
    .toSorted((left, right) => right.score - left.score || left.section.localeCompare(right.section) || left.title.localeCompare(right.title))
    .slice(0, 10);
}

function recordIssueReason(store: OntologyStoreFile, row: StoreRecordRow): string | null {
  if (row.section === "projections") {
    const analysis = analyzeProjection(row.record);
    if (analysis.validation === false) return "Projection validation needs attention";
    if (analysis.issues.length > 0) return formatList(analysis.issues);
  }
  if (row.section === "objects") {
    const objectId = stringField(row.record, "objectId");
    if (objectId && stringField(row.record, "objectKind") === "governance_run" && latestStatusForObject(store, objectId) === "failed") {
      return "Governance run failed";
    }
  }
  if (row.section === "facets") {
    const payload = isRecord(row.record) && isRecord(row.record["payloadJson"]) ? row.record["payloadJson"] : {};
    if (row.kind === "status" && payload["state"] === "failed") return "Status facet failed";
  }
  if (row.section === "observations") {
    const objectIds = new Set(store.objects.map((object) => object.objectId));
    const target = stringField(row.record, "targetObjectId");
    const payload = isRecord(row.record) && isRecord(row.record["payloadJson"]) ? row.record["payloadJson"] : {};
    if (target && !objectIds.has(target)) return "Observation target is missing";
    if (arrayLengthField(payload, "unreachableGoalIds") > 0) return "Traversal has unreachable goals";
    if (payload["loopDetected"] === true) return "Traversal loop detected";
    if (payload["recoveryUsed"] === true) return "Traversal used recovery";
  }
  return null;
}

function issueSeverity(reason: string): Exclude<HealthSeverity, "ok"> {
  const lower = reason.toLowerCase();
  return lower.includes("failed") || lower.includes("validation needs attention") ? "error" : "warning";
}

function storeIssues(store: OntologyStoreFile): StoreIssue[] {
  return allStoreRecordRows(store)
    .map((row) => {
      const reason = recordIssueReason(store, row);
      if (!reason) return null;
      return {
        id: `${row.section}:${row.key}`,
        severity: issueSeverity(reason),
        title: row.title,
        detail: reason,
        row,
      };
    })
    .filter((issue): issue is StoreIssue => Boolean(issue))
    .toSorted((left, right) => {
      const severity = left.severity === right.severity ? 0 : left.severity === "error" ? -1 : 1;
      return severity || left.row.section.localeCompare(right.row.section) || left.title.localeCompare(right.title);
    });
}

function recordSearchText(row: StoreRecordRow): string {
  return [
    row.section,
    row.key,
    row.title,
    row.kind,
    row.detail,
    row.timestamp,
    recordPath(row),
    recordText(row.record),
  ].join(" ").toLowerCase();
}

function recordMatchesSearch(row: StoreRecordRow): boolean {
  const query = normalizedQuery();
  if (!query) return true;
  return recordSearchText(row).includes(query);
}

function recordMatchesFilter(store: OntologyStoreFile, model: OntologyGraphViewModel, row: StoreRecordRow): boolean {
  if (state.recordFilter === "graph-linked") return Boolean(graphNodeIdForStoreRecord(row, model));
  if (state.recordFilter === "issues") return Boolean(recordIssueReason(store, row));
  return true;
}

function visibleRecordRows(store: OntologyStoreFile, model: OntologyGraphViewModel, section: StoreSectionKey): StoreRecordRow[] {
  return storeRecordRows(store, section)
    .filter((row) => recordMatchesSearch(row))
    .filter((row) => recordMatchesFilter(store, model, row));
}

function recordFilterCounts(store: OntologyStoreFile, model: OntologyGraphViewModel, section: StoreSectionKey): Record<RecordFilterMode, number> {
  const rows = storeRecordRows(store, section).filter((row) => recordMatchesSearch(row));
  return {
    all: rows.length,
    "graph-linked": rows.filter((row) => Boolean(graphNodeIdForStoreRecord(row, model))).length,
    issues: rows.filter((row) => Boolean(recordIssueReason(store, row))).length,
  };
}

function latestStatusForObject(store: OntologyStoreFile, objectId: string): string | undefined {
  const status = store.facets
    .filter((facet) => facet.objectId === objectId && facet.facetKind === "status")
    .at(-1);
  const payload = isRecord(status?.payloadJson) ? status.payloadJson : undefined;
  const state = payload?.["state"];
  return typeof state === "string" ? state : undefined;
}

function projectionMode(record: unknown): ProjectionAnalysis["mode"] {
  const kind = (stringField(record, "projectionKind") ?? "").toLowerCase();
  const template = (payloadString(record, "topologyTemplateKind") ?? "").toLowerCase();
  if (kind.includes("snapshot") || template.includes("snapshot")) return "snapshot";
  if (kind.includes("corridor")) return "corridor";
  if (kind.includes("checkpoint")) return "checkpoint";
  if (kind.includes("traversal")) return "traversal";
  return "generic";
}

function validationIssues(record: unknown): string[] {
  const validation = nestedPayloadRecord(record, "topologyValidation");
  if (!validation) return [];
  const issues: string[] = [];
  const arrayIssueKeys = [
    ["missingCorridorKinds", "Missing corridor kinds"],
    ["missingJunctionTemplateKinds", "Missing junction templates"],
    ["missingCheckpointTemplateKinds", "Missing checkpoint templates"],
    ["routeDecisionsMissingRefs", "Route decisions missing refs"],
    ["checkpointsMissingCorridor", "Checkpoints missing corridor"],
  ] as const;
  const booleanIssueKeys = [
    ["missingCheckpointLattices", "Missing checkpoint lattices"],
    ["missingRouteDecisions", "Missing route decisions"],
    ["missingTraversals", "Missing traversals"],
    ["tooFewCorridors", "Too few corridors"],
    ["tooManyCorridors", "Too many corridors"],
    ["checkpointDepthTooShallow", "Checkpoint depth too shallow"],
  ] as const;

  for (const [key, label] of arrayIssueKeys) {
    const values = stringArray(validation[key]);
    if (values.length > 0) issues.push(`${label}: ${formatList(values)}`);
  }
  for (const [key, label] of booleanIssueKeys) {
    if (validation[key] === true) issues.push(label);
  }
  return issues;
}

function projectionCounts(record: unknown): [string, number][] {
  return [
    ["Corridors", payloadArrayLength(record, "corridors")],
    ["Control flows", payloadArrayLength(record, "controlFlows")],
    ["Checkpoints", payloadArrayLength(record, "checkpoints")],
    ["Checkpoint lattices", payloadArrayLength(record, "checkpointLattices")],
    ["Traversals", payloadArrayLength(record, "traversals")],
    ["Transmissions", payloadArrayLength(record, "transmissions")],
    ["Junctions", payloadArrayLength(record, "junctions")],
    ["Route decisions", payloadArrayLength(record, "routeDecisions")],
  ].filter(([, value]) => Number(value) > 0) as [string, number][];
}

function firstRecord(values: unknown[]): Record<string, unknown> | undefined {
  return values.find(isRecord);
}

function projectionFocus(record: unknown, mode: ProjectionAnalysis["mode"]): InsightFact[] {
  if (mode === "snapshot") {
    const validation = nestedPayloadRecord(record, "topologyValidation");
    const corridorCount = validation?.["corridorCount"];
    const depth = validation?.["maxCheckpointLatticeDepth"];
    return [
      { label: "Corridor coverage", value: typeof corridorCount === "number" ? String(corridorCount) : String(payloadArrayLength(record, "corridors")) },
      { label: "Checkpoint depth", value: typeof depth === "number" ? String(depth) : "not reported" },
      { label: "Traversal bundles", value: String(payloadArrayLength(record, "traversals")) },
    ];
  }
  if (mode === "corridor") {
    const corridor = firstRecord(payloadArray(record, "corridors")) ?? payloadRecord(record);
    return [
      { label: "Flow", value: stringField(corridor, "flowId") ?? "not declared" },
      { label: "Entry node", value: stringField(corridor, "entryNodeId") ?? "not declared" },
      { label: "Endpoints", value: String(arrayLengthField(corridor, "endpoints")) },
      { label: "Contracts", value: String(arrayLengthField(corridor, "contracts")) },
      { label: "Links", value: String(arrayLengthField(corridor, "links")) },
    ];
  }
  if (mode === "checkpoint") {
    const lattice = firstRecord(payloadArray(record, "checkpointLattices")) ?? payloadRecord(record);
    return [
      { label: "Root checkpoint", value: stringField(lattice, "rootCheckpointId") ?? "not declared" },
      { label: "Corridor", value: stringField(lattice, "corridorId") ?? "not declared" },
      { label: "Checkpoints", value: String(payloadArrayLength(record, "checkpoints")) },
    ];
  }
  if (mode === "traversal") {
    const traversalBundle = firstRecord(payloadArray(record, "traversals"));
    const traversal = isRecord(traversalBundle?.["traversal"]) ? traversalBundle["traversal"] : payloadRecord(record);
    return [
      { label: "Purpose", value: stringField(traversal, "purpose") ?? "not declared" },
      { label: "Start", value: stringField(traversal, "start") ?? "not declared" },
      { label: "End", value: stringField(traversal, "end") ?? "not declared" },
      { label: "Reached goals", value: String(arrayLengthField(record, "reachedGoalIds")) },
      { label: "Unreachable goals", value: String(arrayLengthField(record, "unreachableGoalIds")) },
    ];
  }
  return payloadKeys(record).slice(0, 5).map((key) => ({ label: key, value: "present" }));
}

function analyzeProjection(record: unknown): ProjectionAnalysis {
  const mode = projectionMode(record);
  return {
    mode,
    validation: nestedPayloadBoolean(record, "topologyValidation", "valid"),
    issues: validationIssues(record),
    counts: projectionCounts(record),
    focus: projectionFocus(record, mode),
  };
}

function storeHealth(store: OntologyStoreFile): StoreHealthItem[] {
  const invalidProjections = store.projections.filter((projection) => analyzeProjection(projection).validation === false);
  const reportedProjectionValidations = store.projections.filter((projection) => analyzeProjection(projection).validation !== undefined).length;
  const projectionIssues = store.projections.flatMap((projection) => analyzeProjection(projection).issues);
  const governanceRuns = store.objects.filter((object) => object.objectKind === "governance_run");
  const failedGovernanceRuns = governanceRuns.filter((object) => latestStatusForObject(store, object.objectId) === "failed");
  const traversalIssues = store.observations.filter((observation) => {
    const payload = isRecord(observation.payloadJson) ? observation.payloadJson : {};
    return (
      arrayLengthField(payload, "unreachableGoalIds") > 0 ||
      payload["loopDetected"] === true ||
      payload["recoveryUsed"] === true
    );
  });
  const objectIds = new Set(store.objects.map((object) => object.objectId));
  const orphanObservations = store.observations.filter((observation) => !objectIds.has(observation.targetObjectId));

  return [
    {
      label: "Projection validation",
      value: invalidProjections.length === 0 ? "clear" : `${invalidProjections.length} failing`,
      severity: invalidProjections.length > 0 ? "error" : reportedProjectionValidations === 0 ? "warning" : "ok",
      detail: reportedProjectionValidations === 0
        ? "No projection reported topologyValidation."
        : `${reportedProjectionValidations} projection validations reported.`,
    },
    {
      label: "Missing topology",
      value: projectionIssues.length === 0 ? "none" : `${projectionIssues.length} issues`,
      severity: projectionIssues.length > 0 ? "warning" : "ok",
      detail: projectionIssues.length > 0 ? formatList(projectionIssues) : "No missing corridor, checkpoint, route, or traversal issues reported.",
    },
    {
      label: "Governance runs",
      value: failedGovernanceRuns.length === 0 ? `${governanceRuns.length} clear` : `${failedGovernanceRuns.length} failed`,
      severity: failedGovernanceRuns.length > 0 ? "error" : "ok",
      detail: failedGovernanceRuns.length > 0 ? formatList(failedGovernanceRuns.map((object) => object.objectId)) : "No failed governance runs in status facets.",
    },
    {
      label: "Traversal signals",
      value: traversalIssues.length === 0 ? "complete" : `${traversalIssues.length} flagged`,
      severity: traversalIssues.length > 0 ? "warning" : "ok",
      detail: traversalIssues.length > 0 ? "Unreachable goals, loops, or recovery usage were observed." : "No unreachable goals, loops, or recovery usage observed.",
    },
    {
      label: "Observation links",
      value: orphanObservations.length === 0 ? "anchored" : `${orphanObservations.length} orphan`,
      severity: orphanObservations.length > 0 ? "warning" : "ok",
      detail: orphanObservations.length > 0 ? "Some observations target objects not present in this store file." : "All observations target known objects in this store file.",
    },
  ];
}

function projectionInsight(record: unknown): RecordInsight {
  const kind = stringField(record, "projectionKind") ?? "projection";
  const scope = stringField(record, "targetScope") ?? "unknown scope";
  const builtFrom = stringArray(isRecord(record) ? record["builtFrom"] : []);
  const analysis = analyzeProjection(record);
  const topologyKind = payloadString(record, "topologyTemplateKind");
  const projectionRole = analysis.mode === "snapshot"
    ? "scope 전체를 하나의 operational topology로 다시 조립한 조회 결과입니다."
    : analysis.mode === "corridor"
      ? "하나의 흐름 corridor를 중심으로 관련 control-flow와 route 정보를 묶은 조회 결과입니다."
      : analysis.mode === "checkpoint"
        ? "checkpoint 구조와 검증 깊이를 확인하기 위한 조회 결과입니다."
        : analysis.mode === "traversal"
          ? "관측된 이동 경로와 도달 결과를 확인하기 위한 조회 결과입니다."
          : "원본 store 기록에서 다시 만들 수 있는 조회 결과입니다.";
  const focus = analysis.focus.filter((fact) => fact.value !== "0" && fact.value !== "not declared");

  return {
    title: `${humanizeKind(kind)} for ${scope}`,
    description: projectionRole,
    facts: [
      { label: "Scope", value: scope },
      { label: "Kind", value: humanizeKind(kind) },
      { label: "Template", value: topologyKind ? humanizeKind(topologyKind) : "not declared" },
      { label: "Built from", value: formatList(builtFrom) },
      { label: "Validation", value: analysis.validation === undefined ? "not reported" : analysis.validation ? "valid" : "needs attention" },
      { label: "Payload", value: analysis.counts.length > 0 ? analysis.counts.map(([label, value]) => formatCount(value, label.toLowerCase())).join(" · ") : "raw projection payload" },
      ...focus,
    ],
    interpretation: [
      "Projection은 원본 사실이 아니라, store에 쌓인 기록을 운영자가 조회하기 좋게 다시 조립한 view입니다.",
      analysis.mode === "snapshot"
        ? "snapshot projection은 corridor, checkpoint, traversal bundle이 함께 있는지 보는 completeness 기준점입니다."
        : analysis.mode === "corridor"
          ? "corridor projection은 entry node, endpoint, contract, link가 일관되게 연결됐는지 보는 흐름 기준점입니다."
          : analysis.mode === "checkpoint"
            ? "checkpoint projection은 corridor 안의 검증 지점과 lattice 깊이가 충분한지 보는 검증 기준점입니다."
            : analysis.mode === "traversal"
              ? "traversal projection은 목표 도달, unreachable goal, loop, recovery를 보는 실행 경로 기준점입니다."
              : "그래프는 주로 projection의 corridor, checkpoint, traversal 정보를 읽어 topology로 렌더링합니다.",
      analysis.issues.length > 0
        ? `먼저 확인할 항목: ${formatList(analysis.issues)}.`
        : "validation 이슈가 없거나 아직 기록되지 않았으므로, 포함된 bundle 수와 builtFrom 경로를 먼저 보면 됩니다.",
    ],
    sourceRefs: builtFrom,
  };
}

function objectInsight(record: unknown): RecordInsight {
  const objectId = stringField(record, "objectId") ?? "object";
  const objectKind = stringField(record, "objectKind") ?? "object";
  const canonicalKey = stringField(record, "canonicalKey") ?? "not declared";
  const lifecycle = stringField(record, "lifecycle") ?? "unknown";

  return {
    title: objectId,
    description: "Object는 store 안에서 추적 가능한 대상의 canonical identity입니다.",
    facts: [
      { label: "Kind", value: humanizeKind(objectKind) },
      { label: "Lifecycle", value: lifecycle },
      { label: "Schema", value: stringField(record, "schemaVersion") ?? "unknown" },
      { label: "Canonical key", value: canonicalKey },
    ],
    interpretation: [
      "Object 자체는 많은 설명을 들고 있지 않고, facet과 observation이 이 object에 의미를 붙입니다.",
      "같은 objectId를 기준으로 facets를 찾으면 상태, route, evidence, validation 같은 세부 정보를 확인할 수 있습니다.",
      "projection 안에 이 id가 등장하면 이 object가 조회용 topology에 materialize된 것입니다.",
    ],
    sourceRefs: [],
  };
}

function facetInsight(record: unknown): RecordInsight {
  const objectId = stringField(record, "objectId") ?? "object";
  const facetKind = stringField(record, "facetKind") ?? "facet";
  const keys = payloadKeys(record);

  return {
    title: `${humanizeKind(facetKind)} on ${objectId}`,
    description: "Facet은 object에 붙는 versioned fact입니다.",
    facts: [
      { label: "Target object", value: objectId },
      { label: "Facet kind", value: humanizeKind(facetKind) },
      { label: "Version", value: stringField(record, "version") ?? "not versioned" },
      { label: "Payload keys", value: formatList(keys, "no payload keys") },
    ],
    interpretation: [
      "Facet은 새 대상이 아니라 이미 존재하는 object를 설명하는 정보 조각입니다.",
      "status facet은 현재 판정, route facet은 이동 경로, evidence facet은 구현/검증 근거를 담습니다.",
      "같은 objectId에 여러 facet이 붙으면 하나의 operational 대상이 여러 관점으로 해석됩니다.",
    ],
    sourceRefs: [stringField(record, "sourceRef")].filter((value): value is string => Boolean(value)),
  };
}

function observationInsight(record: unknown): RecordInsight {
  const observationKind = stringField(record, "observationKind") ?? "observation";
  const targetObjectId = stringField(record, "targetObjectId") ?? "target";
  const reached = payloadBoolean(record, "reached");
  const keys = payloadKeys(record);

  return {
    title: humanizeKind(observationKind),
    description: "Observation은 runtime이나 evaluator에서 들어온 append-only signal입니다.",
    facts: [
      { label: "Target", value: targetObjectId },
      { label: "Observed at", value: stringField(record, "observedAt") ?? "unknown" },
      { label: "Payload keys", value: formatList(keys, "no payload keys") },
      { label: "Reached", value: reached === undefined ? "not reported" : reached ? "yes" : "no" },
    ],
    interpretation: [
      "Observation은 store에 들어온 실제 사건입니다. 삭제/수정 대상이라기보다 이후 projection을 다시 만드는 입력입니다.",
      "targetObjectId를 기준으로 object와 facet을 연결하면 이 signal이 무엇을 갱신했는지 볼 수 있습니다.",
      "projection은 여러 observation을 묶어서 조회 가능한 topology 상태로 재구성합니다.",
    ],
    sourceRefs: [stringField(record, "observationId")].filter((value): value is string => Boolean(value)),
  };
}

function recordInsight(section: StoreSectionKey, record: unknown): RecordInsight {
  switch (section) {
    case "objects":
      return objectInsight(record);
    case "facets":
      return facetInsight(record);
    case "observations":
      return observationInsight(record);
    case "projections":
      return projectionInsight(record);
  }
}

function renderRecordInsight(insight: RecordInsight): string {
  return `
    <div class="record-insight">
      <div class="insight-copy">
        <span>Readable interpretation</span>
        <strong>${escapeHtml(insight.title)}</strong>
        <p>${escapeHtml(insight.description)}</p>
      </div>
      <dl class="insight-facts">
        ${insight.facts.map((fact) => `
          <div>
            <dt>${escapeHtml(fact.label)}</dt>
            <dd>${escapeHtml(fact.value)}</dd>
          </div>
        `).join("")}
      </dl>
      <ul class="insight-notes">
        ${insight.interpretation.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
      </ul>
      ${insight.sourceRefs.length > 0 ? `
        <div class="source-refs">
          <span>Source refs</span>
          <p>${escapeHtml(formatList(insight.sourceRefs))}</p>
        </div>
      ` : ""}
    </div>
  `;
}

function renderRelatedRecords(related: RelatedRecordRow[]): string {
  return `
    <div class="related-records">
      <div class="related-heading">
        <span>Related records</span>
        <strong>${related.length > 0 ? "Follow store links" : "No direct links found"}</strong>
        <p>${related.length > 0 ? "Jump to records sharing identity, source, target, or builtFrom references." : "This record does not share a strong reference with other records in the loaded store."}</p>
      </div>
      ${related.length > 0 ? `
        <div class="related-list">
          ${related.map((row) => `
            <button type="button" data-related-section="${row.section}" data-related-record-key="${escapeHtml(row.key)}">
              <span>${escapeHtml(row.section)} / ${escapeHtml(row.kind)}</span>
              <strong>${escapeHtml(row.title)}</strong>
              <small>${escapeHtml(row.reason)}</small>
            </button>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function recordFilterLabel(filter: RecordFilterMode): string {
  if (filter === "graph-linked") return "Graph linked";
  if (filter === "issues") return "Issues";
  return "All";
}

function renderRecordControls(
  store: OntologyStoreFile,
  model: OntologyGraphViewModel,
  section: StoreSectionKey,
  visibleCount: number,
): string {
  const counts = recordFilterCounts(store, model, section);
  return `
    <div class="record-controls">
      <label class="record-search">
        <span>Search records</span>
        <input id="record-search-input" type="search" value="${escapeHtml(state.recordQuery)}" placeholder="id, kind, scope, payload..." />
      </label>
      <div class="record-filter-group" aria-label="Record filters">
        ${(["all", "graph-linked", "issues"] as const).map((filter) => `
          <button type="button" class="${state.recordFilter === filter ? "active" : ""}" data-record-filter="${filter}">
            ${recordFilterLabel(filter)}
            <span>${counts[filter]}</span>
          </button>
        `).join("")}
      </div>
      <p>${visibleCount} matching ${visibleCount === 1 ? "record" : "records"}</p>
    </div>
  `;
}

function renderRawJsonPanel(row: StoreRecordRow): string {
  const rawJson = JSON.stringify(row.record, null, 2);
  return `
    <div class="raw-panel">
      <div class="raw-toolbar">
        <div>
          <span>Raw JSON</span>
          <strong>${escapeHtml(recordPath(row))}</strong>
          <small>${escapeHtml(row.key)}</small>
        </div>
        <div class="raw-actions">
          <button type="button" data-toggle-raw-json>${state.rawJsonExpanded ? "Collapse" : "Expand"}</button>
          <button type="button" data-copy-record-json>Copy JSON</button>
        </div>
      </div>
      ${state.copyNotice ? `<p class="copy-notice">${escapeHtml(state.copyNotice)}</p>` : ""}
      ${state.rawJsonExpanded ? `
        <pre>${escapeHtml(rawJson)}</pre>
      ` : `
        <div class="raw-preview"><code>${escapeHtml(rawJsonPreview(rawJson))}</code></div>
      `}
    </div>
  `;
}

function renderStoreBrowser(store: OntologyStoreFile, model: OntologyGraphViewModel): string {
  const section = storeSections.find((entry) => entry.key === state.storeSection) ?? storeSections[0];
  const rows = visibleRecordRows(store, model, section.key);
  const selected = rows.find((row) => row.key === state.selectedRecordKey) ?? rows[0];
  const insight = selected ? recordInsight(section.key, selected.record) : null;
  const related = selected ? relatedRecords(store, selected) : [];
  const selectedGraphNodeId = selected ? graphNodeIdForStoreRecord(selected, model) : null;

  return `
    <section class="store-browser" aria-label="Store records">
      <div class="record-header">
        <div>
          <p class="eyebrow">Store records</p>
          <h2>${escapeHtml(section.label)}</h2>
          <p>${escapeHtml(section.summary)}</p>
        </div>
        <nav class="record-tabs" aria-label="Store record type">
          ${storeSections.map((entry) => `
            <button type="button" class="${state.storeSection === entry.key ? "active" : ""}" data-store-section="${entry.key}">
              ${escapeHtml(entry.label)}
              <span>${store[entry.key].length}</span>
            </button>
          `).join("")}
        </nav>
      </div>
      ${renderRecordControls(store, model, section.key, rows.length)}
      <div class="record-grid">
        <div class="record-list" role="list">
          ${rows.length === 0 ? `<p class="empty-records">No ${escapeHtml(section.label.toLowerCase())} match the current search and filter.</p>` : rows.map((row) => {
            const graphNodeId = graphNodeIdForStoreRecord(row, model);
            const issue = recordIssueReason(store, row);
            return `
            <button type="button" role="listitem" class="${selected?.key === row.key ? "selected" : ""} ${graphNodeId ? "graph-linked" : ""} ${issue ? "issue-record" : ""}" data-store-record-key="${escapeHtml(row.key)}">
              <span>${escapeHtml(row.kind)}</span>
              <strong>${escapeHtml(row.title)}</strong>
              <small>${escapeHtml(issue ? `Issue: ${issue}` : graphNodeId ? `Graph node: ${graphNodeId}` : row.detail)}</small>
            </button>
          `;
          }).join("")}
        </div>
        <div class="record-detail">
          ${selected ? `
            <div class="record-detail-head">
              <span>${escapeHtml(selected.kind)}</span>
              <strong>${escapeHtml(selected.title)}</strong>
              <small>${escapeHtml(selected.timestamp)}</small>
              ${selectedGraphNodeId ? `<small class="graph-link-note">Linked graph node: ${escapeHtml(selectedGraphNodeId)}</small>` : ""}
            </div>
            ${insight ? renderRecordInsight(insight) : ""}
            ${renderRelatedRecords(related)}
            ${renderRawJsonPanel(selected)}
          ` : `
            <p>No record selected.</p>
          `}
        </div>
      </div>
    </section>
  `;
}

function renderInspector(model: OntologyGraphViewModel, selectedNodeId: string | null): string {
  const selected = model.nodes.find((node) => node.id === selectedNodeId) ?? model.nodes[0];
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

function renderTopologyHeader(model: OntologyGraphViewModel): string {
  const snapshotCount = model.nodes.filter((node) => node.lane === "snapshot").length;
  const projectionCount = model.nodes.filter((node) => ["snapshot", "corridor", "checkpoint", "traversal"].includes(node.lane)).length;
  return `
    <div class="map-heading">
      <p class="eyebrow">Projection topology</p>
      <strong>Snapshot roots link to rebuilt operational views.</strong>
      <span>Source: ${escapeHtml(state.sourceName)} · ${projectionCount} projection nodes · ${model.edges.length} edges · ${snapshotCount} snapshot roots</span>
    </div>
  `;
}

async function copyTextToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function renderApp(): void {
  const model = operationalStoreToOntologyView(state.store);
  const activeStoreRecord = getActiveStoreRecord(state.store, model);
  const activeGraphNodeId = state.selectedId ?? (activeStoreRecord ? graphNodeIdForStoreRecord(activeStoreRecord, model) : null);
  const visibleModel = visibleModelForFilter(model);
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  app.innerHTML = `
    <header class="shell-header">
      <div>
        <p class="eyebrow">Operational Ontology Web</p>
        <h1>Operational store reader</h1>
        <p class="header-copy">Read collected signals, materialized facts, and rebuilt topology views from one store JSON.</p>
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
      ${Object.entries(model.metrics ?? {}).map(([key, value]) => `<div><span>${escapeHtml(metricLabel(key))}</span><strong>${value}</strong></div>`).join("")}
    </section>

    ${renderStoreHealth(state.store)}

    ${renderIssueQueue(state.store)}

    <nav class="filters" aria-label="Topology filter">
      ${(["all", "snapshot", "corridor", "checkpoint", "traversal", "governance"] as const).map((filter) => `
        <button type="button" class="${state.filter === filter ? "active" : ""}" data-filter="${filter}">${filter}</button>
      `).join("")}
    </nav>

    <section class="sample-row" aria-label="Sample stores">
      <span>Sample scenarios</span>
      ${sampleFiles.map((sample) => `
        <button type="button" class="${state.sampleKey === sample.key ? "active" : ""}" data-sample-key="${sample.key}" data-sample-path="${sample.path}">
          <strong>${escapeHtml(sample.label)}</strong>
          <small>${escapeHtml(sample.description)}</small>
        </button>
      `).join("")}
    </section>

    ${renderScenarioGuide()}

    ${renderStorePrimer(state.store)}

    ${renderReadPath()}

    ${renderStoreBrowser(state.store, model)}

    <section class="workspace">
      <div class="map">
        ${renderTopologyHeader(model)}
        <div class="topology">${renderOntologyGraphSvg(layoutOntologyGraph(visibleModel, { laneOrder: ["snapshot", "corridor", "checkpoint", "traversal", "governance"], nodeWidth: 150 }), { selectedNodeId: activeGraphNodeId })}</div>
      </div>
      ${renderInspector(visibleModel, activeGraphNodeId)}
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

  app.querySelectorAll<SVGGElement>("[data-node-id]").forEach((node) => {
    node.addEventListener("click", () => {
      const nodeId = node.dataset["nodeId"];
      if (nodeId) selectGraphNode(state.store, nodeId);
      renderApp();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-store-section]").forEach((button) => {
    button.addEventListener("click", () => {
      state.storeSection = button.dataset["storeSection"] as StoreSectionKey;
      state.selectedRecordKey = null;
      state.rawJsonExpanded = false;
      state.copyNotice = null;
      renderApp();
    });
  });

  app.querySelector<HTMLInputElement>("#record-search-input")?.addEventListener("input", (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    state.recordQuery = input?.value ?? "";
    state.selectedRecordKey = null;
    state.rawJsonExpanded = false;
    state.copyNotice = null;
    renderApp();
  });

  app.querySelectorAll<HTMLButtonElement>("[data-record-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.recordFilter = button.dataset["recordFilter"] as RecordFilterMode;
      state.selectedRecordKey = null;
      state.rawJsonExpanded = false;
      state.copyNotice = null;
      renderApp();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-store-record-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset["storeRecordKey"];
      if (!key) return;
      const row = findStoreRecordRow(state.store, state.storeSection, key);
      if (row) selectStoreRecord(row, model);
      renderApp();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-related-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset["relatedSection"] as StoreSectionKey | undefined;
      const key = button.dataset["relatedRecordKey"];
      if (!section || !key) return;
      const row = findStoreRecordRow(state.store, section, key);
      state.recordQuery = "";
      state.recordFilter = "all";
      if (row) selectStoreRecord(row, model);
      renderApp();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-issue-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset["issueSection"] as StoreSectionKey | undefined;
      const key = button.dataset["issueRecordKey"];
      if (!section || !key) return;
      const row = findStoreRecordRow(state.store, section, key);
      state.recordQuery = "";
      state.recordFilter = "issues";
      if (row) selectStoreRecord(row, model);
      renderApp();
    });
  });

  app.querySelector<HTMLButtonElement>("[data-toggle-raw-json]")?.addEventListener("click", () => {
    state.rawJsonExpanded = !state.rawJsonExpanded;
    state.copyNotice = null;
    renderApp();
  });

  app.querySelector<HTMLButtonElement>("[data-copy-record-json]")?.addEventListener("click", async () => {
    const row = getActiveStoreRecord(state.store, model);
    if (!row) return;
    try {
      await copyTextToClipboard(JSON.stringify(row.record, null, 2));
      state.copyNotice = `Copied ${recordPath(row)}`;
    } catch {
      state.copyNotice = "Copy failed";
    }
    renderApp();
  });

  app.querySelector<HTMLButtonElement>("#sample-button")?.addEventListener("click", () => {
    state.store = sampleStore;
    state.sourceName = "sample store";
    state.sampleKey = "inline";
    state.selectedId = null;
    state.selectedRecordKey = null;
    state.recordQuery = "";
    state.recordFilter = "all";
    state.rawJsonExpanded = false;
    state.copyNotice = null;
    renderApp();
  });

  app.querySelectorAll<HTMLButtonElement>("[data-sample-path]").forEach((button) => {
    button.addEventListener("click", async () => {
      const path = button.dataset["samplePath"];
      if (!path) return;
      const response = await fetch(path);
      state.store = asStoreFile((await response.json()) as unknown);
      state.sourceName = path;
      state.sampleKey = (button.dataset["sampleKey"] as SampleScenarioKey | undefined) ?? "custom";
      state.selectedId = null;
      state.selectedRecordKey = null;
      state.recordQuery = "";
      state.recordFilter = "all";
      state.rawJsonExpanded = false;
      state.copyNotice = null;
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
      state.sampleKey = "custom";
      state.selectedId = null;
      state.selectedRecordKey = null;
      state.recordQuery = "";
      state.recordFilter = "all";
      state.rawJsonExpanded = false;
      state.copyNotice = null;
      renderApp();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Invalid store JSON");
    }
  });
}

renderApp();
