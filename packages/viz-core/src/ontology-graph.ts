export type OntologyLane =
  | 'snapshot'
  | 'corridor'
  | 'checkpoint'
  | 'traversal'
  | 'governance'
  | 'policy'
  | 'proxy'
  | 'application'
  | 'decision'
  | 'neutral';

export type OntologyNodeStatus = 'passed' | 'failed' | 'active' | 'observed' | 'unknown';

export interface OntologyViewNode {
  id: string;
  label: string;
  kind: string;
  lane: OntologyLane;
  status?: OntologyNodeStatus;
  summary?: string;
  raw?: unknown;
}

export interface OntologyViewEdge {
  id?: string;
  from: string;
  to: string;
  label?: string;
  kind?: string;
}

export interface OntologyGraphViewModel {
  nodes: OntologyViewNode[];
  edges: OntologyViewEdge[];
  metrics?: Record<string, number>;
}

export interface PositionedOntologyNode extends OntologyViewNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedOntologyGraph {
  nodes: PositionedOntologyNode[];
  edges: OntologyViewEdge[];
  width: number;
  height: number;
}

export interface OntologyLayoutOptions {
  laneOrder?: readonly OntologyLane[];
  laneGap?: number;
  rowGap?: number;
  nodeWidth?: number;
  nodeHeight?: number;
  paddingX?: number;
  paddingY?: number;
}

const DEFAULT_LANE_ORDER: readonly OntologyLane[] = [
  'snapshot',
  'corridor',
  'checkpoint',
  'traversal',
  'governance',
  'policy',
  'proxy',
  'application',
  'decision',
  'neutral',
];

export interface OperationalStoreLike {
  objects?: readonly {
    objectId: string;
    objectKind: string;
    canonicalKey?: string;
    schemaVersion?: string;
    lifecycle?: string;
    createdAt?: string;
    updatedAt?: string;
  }[];
  facets?: readonly {
    objectId: string;
    facetKind: string;
    version?: string;
    payloadJson?: unknown;
    recordedAt?: string;
  }[];
  observations?: readonly {
    observationId: string;
    targetObjectId: string;
    observationKind: string;
    payloadJson?: unknown;
    observedAt: string;
  }[];
  projections?: readonly {
    projectionId: string;
    projectionKind: string;
    targetScope?: string;
    payloadJson?: unknown;
    builtFrom?: readonly string[];
    builtAt?: string;
  }[];
}

export interface AuthorizationGraphLike {
  nodes?: readonly {
    nodeId: string;
    kind: string;
    coord?: {
      anchor?: string;
      taxonomies?: Record<string, string>;
    };
    metadata?: Record<string, unknown>;
  }[];
  relations?: readonly {
    relationId?: string;
    kind: string;
    fromNodeId: string;
    toNodeId: string;
  }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function payloadLabel(payload: unknown, keys: readonly string[]): string | undefined {
  if (!isRecord(payload)) return undefined;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

function operationalLaneForProjection(kind: string): OntologyLane {
  if (kind.includes('checkpoint')) return 'checkpoint';
  if (kind.includes('corridor') || kind.includes('control-flow')) return 'corridor';
  if (kind.includes('traversal')) return 'traversal';
  return 'snapshot';
}

function operationalStatusForObject(
  object: NonNullable<OperationalStoreLike['objects']>[number],
  facets: NonNullable<OperationalStoreLike['facets']>,
): OntologyNodeStatus {
  const statusFacet = facets
    .filter((facet) => facet.objectId === object.objectId && facet.facetKind === 'status')
    .at(-1);
  if (isRecord(statusFacet?.payloadJson)) {
    const state = statusFacet.payloadJson['state'];
    if (state === 'passed' || state === 'failed') return state;
  }
  return object.lifecycle === 'active' ? 'active' : 'unknown';
}

export function operationalStoreToOntologyView(store: OperationalStoreLike): OntologyGraphViewModel {
  const objects = store.objects ?? [];
  const facets = store.facets ?? [];
  const observations = store.observations ?? [];
  const projections = store.projections ?? [];
  const nodes = new Map<string, OntologyViewNode>();
  const edges: OntologyViewEdge[] = [];

  for (const projection of projections) {
    const lane = operationalLaneForProjection(projection.projectionKind);
    const label =
      payloadLabel(projection.payloadJson, ['flowId', 'rootCheckpointId', 'canonicalKey']) ??
      projection.projectionId;
    nodes.set(projection.projectionId, {
      id: projection.projectionId,
      label,
      kind: projection.projectionKind,
      lane,
      status: 'active',
      summary: `${projection.targetScope ?? 'scope'} · ${projection.builtAt ?? 'unknown'}`,
      raw: projection,
    });
    for (const source of projection.builtFrom ?? []) {
      edges.push({ from: source, to: projection.projectionId, label: 'built' });
    }
  }

  for (const object of objects) {
    if (!['governance_blueprint', 'governance_run', 'traversal'].includes(object.objectKind)) continue;
    const lane: OntologyLane = object.objectKind === 'traversal' ? 'traversal' : 'governance';
    nodes.set(object.objectId, {
      id: object.objectId,
      label: object.objectId.replace(/^governance-/, ''),
      kind: object.objectKind,
      lane,
      status: operationalStatusForObject(object, facets),
      summary: `${object.schemaVersion ?? 'schema'} · ${object.updatedAt ?? 'unknown'}`,
      raw: {
        object,
        facets: facets.filter((facet) => facet.objectId === object.objectId),
      },
    });
  }

  for (const observation of observations) {
    const target = nodes.get(observation.targetObjectId);
    if (target && !observation.observationKind.includes('governance')) target.status = 'observed';
  }

  const snapshotId = [...nodes.values()].find((node) => node.lane === 'snapshot')?.id;
  if (snapshotId) {
    for (const node of nodes.values()) {
      if (node.lane !== 'snapshot' && !edges.some((edge) => edge.to === node.id)) {
        edges.push({ from: snapshotId, to: node.id, label: 'scope' });
      }
    }
  }

  return {
    nodes: [...nodes.values()],
    edges: edges.filter((edge) => nodes.has(edge.from) && nodes.has(edge.to)),
    metrics: {
      objects: objects.length,
      projections: projections.length,
      observations: observations.length,
      governanceRuns: objects.filter((object) => object.objectKind === 'governance_run').length,
      failed: [...nodes.values()].filter((node) => node.status === 'failed').length,
    },
  };
}

function authorizationLaneForNode(node: NonNullable<AuthorizationGraphLike['nodes']>[number]): OntologyLane {
  const taxonomies = node.coord?.taxonomies ?? {};
  if (node.kind === 'policy') return 'policy';
  if (node.kind === 'decision') return 'decision';
  if (taxonomies['resource_kind'] === 'proxy_route') return 'proxy';
  if (taxonomies['resource_kind'] === 'domain_resource' || taxonomies['resource_kind'] === 'service') return 'application';
  if (node.kind === 'enforcement_point') {
    return taxonomies['enforcement_kind'] === 'service_middleware' ? 'application' : 'proxy';
  }
  return 'neutral';
}

export function authorizationGraphToOntologyView(graph: AuthorizationGraphLike): OntologyGraphViewModel {
  const nodes = (graph.nodes ?? []).map((node): OntologyViewNode => ({
    id: node.nodeId,
    label: node.coord?.anchor ?? node.nodeId,
    kind: node.kind,
    lane: authorizationLaneForNode(node),
    status: 'active',
    summary: Object.entries(node.coord?.taxonomies ?? {})
      .map(([key, value]) => `${key}=${value}`)
      .join(' · '),
    raw: node,
  }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = (graph.relations ?? [])
    .filter((relation) => nodeIds.has(relation.fromNodeId) && nodeIds.has(relation.toNodeId))
    .map((relation): OntologyViewEdge => ({
      id: relation.relationId,
      from: relation.fromNodeId,
      to: relation.toNodeId,
      label: relation.kind,
      kind: relation.kind,
    }));

  return {
    nodes,
    edges,
    metrics: {
      nodes: nodes.length,
      edges: edges.length,
      decisions: nodes.filter((node) => node.lane === 'decision').length,
      policies: nodes.filter((node) => node.lane === 'policy').length,
    },
  };
}

export function layoutOntologyGraph(
  model: OntologyGraphViewModel,
  options: OntologyLayoutOptions = {},
): PositionedOntologyGraph {
  const laneOrder = options.laneOrder ?? DEFAULT_LANE_ORDER;
  const laneGap = options.laneGap ?? 210;
  const rowGap = options.rowGap ?? 96;
  const nodeWidth = options.nodeWidth ?? 140;
  const nodeHeight = options.nodeHeight ?? 64;
  const paddingX = options.paddingX ?? 100;
  const paddingY = options.paddingY ?? 90;
  const laneCounts = new Map<OntologyLane, number>();

  const nodes = model.nodes.map((node) => {
    const laneIndex = Math.max(0, laneOrder.indexOf(node.lane));
    const row = laneCounts.get(node.lane) ?? 0;
    laneCounts.set(node.lane, row + 1);
    return {
      ...node,
      width: nodeWidth,
      height: nodeHeight,
      x: paddingX + laneIndex * laneGap,
      y: paddingY + row * rowGap,
    };
  });

  const width = Math.max(400, paddingX * 2 + laneOrder.length * laneGap);
  const height = Math.max(240, paddingY * 2 + Math.max(...[...laneCounts.values(), 1]) * rowGap);

  return { nodes, edges: model.edges, width, height };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderOntologyGraphSvg(graph: PositionedOntologyGraph): string {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const edges = graph.edges
    .filter((edge) => byId.has(edge.from) && byId.has(edge.to))
    .map((edge) => {
      const from = byId.get(edge.from)!;
      const to = byId.get(edge.to)!;
      const midX = (from.x + to.x) / 2;
      return `<path class="ontology-edge" data-kind="${escapeHtml(edge.kind ?? '')}" d="M ${from.x + from.width / 2} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x - to.width / 2} ${to.y}" />`;
    })
    .join('');
  const nodes = graph.nodes
    .map((node) => `
      <g class="ontology-node ${escapeHtml(node.lane)} ${escapeHtml(node.status ?? 'unknown')}" data-node-id="${escapeHtml(node.id)}" transform="translate(${node.x - node.width / 2} ${node.y - node.height / 2})">
        <rect width="${node.width}" height="${node.height}" rx="8" />
        <text class="ontology-node-kind" x="10" y="20">${escapeHtml(node.kind)}</text>
        <text class="ontology-node-label" x="10" y="42">${escapeHtml(node.label)}</text>
      </g>
    `)
    .join('');
  return `<svg class="ontology-graph-svg" viewBox="0 0 ${graph.width} ${graph.height}" role="img" aria-label="Ontology graph">${edges}${nodes}</svg>`;
}
