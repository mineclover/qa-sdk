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
  storeSection: StoreSectionKey;
  selectedRecordKey: string | null;
}

type StoreSectionKey = "objects" | "facets" | "observations" | "projections";

interface StoreSectionInfo {
  key: StoreSectionKey;
  label: string;
  summary: string;
  reads: string;
}

interface SampleFile {
  label: string;
  description: string;
  path: string;
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
  storeSection: "projections",
  selectedRecordKey: null,
};

const sampleFiles: SampleFile[] = [
  {
    label: "Event observation",
    description: "EventRecord payload and address_context bindings.",
    path: "/samples/event-store.json",
  },
  {
    label: "Pipe execution",
    description: "PipeGraph steps, conditions, transmissions, and junctions.",
    path: "/samples/pipe-store.json",
  },
  {
    label: "Complete snapshot",
    description: "Corridor, checkpoint, traversal, and validation bundles.",
    path: "/samples/snapshot-store.json",
  },
];

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

function projectionInsight(record: unknown): RecordInsight {
  const kind = stringField(record, "projectionKind") ?? "projection";
  const scope = stringField(record, "targetScope") ?? "unknown scope";
  const builtFrom = isRecord(record) && Array.isArray(record["builtFrom"]) ? record["builtFrom"].filter((value): value is string => typeof value === "string") : [];
  const validation = nestedPayloadBoolean(record, "topologyValidation", "valid");
  const counts = [
    ["Corridors", payloadArrayLength(record, "corridors")],
    ["Control flows", payloadArrayLength(record, "controlFlows")],
    ["Checkpoints", payloadArrayLength(record, "checkpoints")],
    ["Checkpoint lattices", payloadArrayLength(record, "checkpointLattices")],
    ["Traversals", payloadArrayLength(record, "traversals")],
    ["Transmissions", payloadArrayLength(record, "transmissions")],
    ["Junctions", payloadArrayLength(record, "junctions")],
    ["Route decisions", payloadArrayLength(record, "routeDecisions")],
  ].filter(([, value]) => Number(value) > 0) as [string, number][];
  const topologyKind = payloadString(record, "topologyTemplateKind");
  const projectionRole = kind.includes("snapshot")
    ? "scope 전체를 하나의 operational topology로 다시 조립한 조회 결과입니다."
    : kind.includes("corridor")
      ? "하나의 흐름 corridor를 중심으로 관련 control-flow와 route 정보를 묶은 조회 결과입니다."
      : kind.includes("checkpoint")
        ? "checkpoint 구조와 검증 깊이를 확인하기 위한 조회 결과입니다."
        : kind.includes("traversal")
          ? "관측된 이동 경로와 도달 결과를 확인하기 위한 조회 결과입니다."
          : "원본 store 기록에서 다시 만들 수 있는 조회 결과입니다.";

  return {
    title: `${humanizeKind(kind)} for ${scope}`,
    description: projectionRole,
    facts: [
      { label: "Scope", value: scope },
      { label: "Kind", value: humanizeKind(kind) },
      { label: "Template", value: topologyKind ? humanizeKind(topologyKind) : "not declared" },
      { label: "Built from", value: formatList(builtFrom) },
      { label: "Validation", value: validation === undefined ? "not reported" : validation ? "valid" : "needs attention" },
      { label: "Payload", value: counts.length > 0 ? counts.map(([label, value]) => formatCount(value, label.toLowerCase())).join(" · ") : "raw projection payload" },
    ],
    interpretation: [
      "Projection은 원본 사실이 아니라, store에 쌓인 기록을 운영자가 조회하기 좋게 다시 조립한 view입니다.",
      "그래프는 주로 projection의 corridor, checkpoint, traversal 정보를 읽어 topology로 렌더링합니다.",
      validation === false
        ? "validation이 실패했으므로 missing corridor, checkpoint depth, route reference 같은 항목을 먼저 확인해야 합니다."
        : "validation이 통과했거나 아직 기록되지 않았으므로, 포함된 bundle 수와 builtFrom 경로를 먼저 보면 됩니다.",
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

function renderStoreBrowser(store: OntologyStoreFile): string {
  const section = storeSections.find((entry) => entry.key === state.storeSection) ?? storeSections[0];
  const records = store[section.key] as readonly unknown[];
  const rows = records.map((record, index) => {
    const key = storeRecordKey(section.key, record, index);
    return {
      key,
      record,
      title: storeRecordTitle(section.key, record),
      kind: storeRecordKind(section.key, record),
      detail: storeRecordDetail(section.key, record),
      timestamp: storeRecordTimestamp(section.key, record),
    };
  });
  const selected = rows.find((row) => row.key === state.selectedRecordKey) ?? rows[0];
  const insight = selected ? recordInsight(section.key, selected.record) : null;

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
      <div class="record-grid">
        <div class="record-list" role="list">
          ${rows.length === 0 ? `<p class="empty-records">No ${escapeHtml(section.label.toLowerCase())} in this store.</p>` : rows.map((row) => `
            <button type="button" role="listitem" class="${selected?.key === row.key ? "selected" : ""}" data-store-record-key="${escapeHtml(row.key)}">
              <span>${escapeHtml(row.kind)}</span>
              <strong>${escapeHtml(row.title)}</strong>
              <small>${escapeHtml(row.detail)}</small>
            </button>
          `).join("")}
        </div>
        <div class="record-detail">
          ${selected ? `
            <div class="record-detail-head">
              <span>${escapeHtml(selected.kind)}</span>
              <strong>${escapeHtml(selected.title)}</strong>
              <small>${escapeHtml(selected.timestamp)}</small>
            </div>
            ${insight ? renderRecordInsight(insight) : ""}
            <p class="raw-label">Raw JSON</p>
            <pre>${escapeHtml(JSON.stringify(selected.record, null, 2))}</pre>
          ` : `
            <p>No record selected.</p>
          `}
        </div>
      </div>
    </section>
  `;
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

    <nav class="filters" aria-label="Topology filter">
      ${(["all", "snapshot", "corridor", "checkpoint", "traversal", "governance"] as const).map((filter) => `
        <button type="button" class="${state.filter === filter ? "active" : ""}" data-filter="${filter}">${filter}</button>
      `).join("")}
    </nav>

    <section class="sample-row" aria-label="Sample stores">
      <span>Sample scenarios</span>
      ${sampleFiles.map((sample) => `
        <button type="button" data-sample-path="${sample.path}">
          <strong>${escapeHtml(sample.label)}</strong>
          <small>${escapeHtml(sample.description)}</small>
        </button>
      `).join("")}
    </section>

    ${renderStorePrimer(state.store)}

    ${renderReadPath()}

    ${renderStoreBrowser(state.store)}

    <section class="workspace">
      <div class="map">
        <div class="source-line">Source: ${escapeHtml(state.sourceName)}</div>
        <div class="topology">${renderOntologyGraphSvg(layoutOntologyGraph(visibleModel, { laneOrder: ["snapshot", "corridor", "checkpoint", "traversal", "governance"], nodeWidth: 150 }), { selectedNodeId: state.selectedId })}</div>
      </div>
      ${renderInspector(visibleModel)}
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

  app.querySelectorAll<HTMLButtonElement>("[data-store-section]").forEach((button) => {
    button.addEventListener("click", () => {
      state.storeSection = button.dataset["storeSection"] as StoreSectionKey;
      state.selectedRecordKey = null;
      renderApp();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-store-record-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedRecordKey = button.dataset["storeRecordKey"] ?? null;
      renderApp();
    });
  });

  app.querySelector<HTMLButtonElement>("#sample-button")?.addEventListener("click", () => {
    state.store = sampleStore;
    state.sourceName = "sample store";
    state.selectedId = null;
    state.selectedRecordKey = null;
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
      state.selectedRecordKey = null;
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
      state.selectedRecordKey = null;
      renderApp();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Invalid store JSON");
    }
  });
}

renderApp();
