// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { createHash } from 'node:crypto';
import type {
  DefBoundaryContextResult,
  DefDataSource,
  DefDoc,
  DefDocBody,
} from 'definition-catalog';
import {
  compileWorkingContext,
  createContextBudgetProfile,
  createContextManifest,
  createDefinitionGraphDiscoveryAdapter,
  createFederatedResolutionAdapter,
  freezeRouteSelection,
  mapContextObservation,
  planDiscovery,
  type ContextManifest,
  type ContextObservationRecord,
  type ContextRoute,
  type DefinitionGraphRouteNode,
  type DiscoveryPlan,
  type RequiredFact,
  type ResolutionRoute,
  type RouteSelection,
  type TaskIntent,
  type WorkingContext,
} from 'context-runtime';

const DEFINITION_ROUTE_BOUNDS = Object.freeze({
  maxDepth: 1,
  maxFanOut: 8,
  maxItems: 64,
  cyclePolicy: 'stop' as const,
});

export interface BoundedDefinitionContextInput {
  readonly source: Pick<DefDataSource, 'get' | 'getBody' | 'getBoundaryContext'>;
  readonly docId: string;
  readonly usedTokens?: number;
  readonly now?: string;
}

export interface BoundedDefinitionContextResult {
  readonly mode: 'bounded';
  readonly task: TaskIntent;
  readonly snapshotRef: string;
  readonly discovery: DiscoveryPlan;
  readonly routes: readonly ContextRoute[];
  readonly routeSelection: RouteSelection;
  readonly workingContext: WorkingContext;
  readonly manifest?: ContextManifest;
  readonly observation: ContextObservationRecord;
}

/**
 * Definition 문서 graph를 context-runtime의 Discovery/Working 계약에 연결한다.
 *
 * 외부 source 조회는 이 composition-root adapter에서 먼저 끝내고,
 * context-runtime에는 이미 읽은 snapshot을 동기 port로 주입한다.
 */
export async function buildBoundedDefinitionContext(
  input: BoundedDefinitionContextInput,
): Promise<BoundedDefinitionContextResult> {
  const now = input.now ?? new Date().toISOString();
  const doc = await input.source.get(input.docId);
  if (!doc) {
    throw new Error(`문서 "${input.docId}" 없음`);
  }

  const [boundaryContext, body] = await Promise.all([
    input.source.getBoundaryContext(input.docId, 'overview', 'transitive'),
    input.source.getBody(input.docId),
  ]);

  const task = createTaskIntent(doc);
  const snapshotRef = createSnapshotRef(doc);
  const resolutionRoutes = createResolutionRoutes(task, doc, boundaryContext, body);
  const discoveryNodes = createDiscoveryNodes(task, boundaryContext);
  const discoveryAdapter = createDefinitionGraphDiscoveryAdapter({
    listRoutes: () => discoveryNodes,
  });
  const discoveryCandidates = discoveryAdapter.discover({
    taskKey: task.taskKey,
    anchor: task.anchor,
  });
  const candidates = [
    ...discoveryCandidates,
    ...resolutionRoutes.map((route) => ({
      route,
      priority: routePriority(route),
      estimatedSize: estimatedRouteSize(route, doc, boundaryContext, body),
      sourceRef: `definition:${doc.docId}`,
    })),
  ];

  const discovery = planDiscovery({
    intent: task,
    candidates,
    budget: createContextBudgetProfile(),
    usedTokens: input.usedTokens ?? 0,
  });
  const routes = Object.freeze(candidates.map((candidate) => candidate.route));
  const routeManifestDigest = createRouteManifestDigest(discovery.selectedRouteKeys);
  const routeSelection = freezeRouteSelection(
    routes,
    discovery.selectedRouteKeys,
    now,
    routeManifestDigest,
  );

  const resolutionAdapter = createFederatedResolutionAdapter({
    resolve: ({ route }) => createResolutionRecords(doc, boundaryContext, body, route, now),
  });
  const resolvedFacts = resolutionRoutes.flatMap((route) =>
    resolutionAdapter.resolve({
      taskKey: task.taskKey,
      snapshotRef,
      route,
      requiredFactKeys: route.requiredFactKeys,
    }),
  );
  const requiredFacts = createRequiredFacts(doc, boundaryContext, body, resolutionRoutes);
  const workingContext = compileWorkingContext({
    taskKey: task.taskKey,
    routeSelection,
    routes,
    requiredFacts,
    resolvedFacts,
    allowedOperations: ['read-definition-context'],
    outputContract: {
      contractKey: 'definition-context.v1',
      description: 'Bounded definition document context for authoring and review',
      requiredFields: requiredFacts.map((fact) => fact.factKey),
    },
    now,
  });
  const manifest = workingContext.status === 'closed'
    ? createContextManifest({ workingContext, snapshotRef })
    : undefined;
  const observation = mapContextObservation({
    taskKey: task.taskKey,
    stage: 'working',
    status: workingContext.status,
    routeKeys: workingContext.routeSelection.selectedRouteKeys,
    factKeys: workingContext.facts.map((fact) => fact.factKey),
    ...(manifest ? { manifestDigest: manifest.digest } : {}),
    ...(doc.address ? { addressContext: { def_document: doc.address } } : {}),
  });

  return Object.freeze({
    mode: 'bounded',
    task,
    snapshotRef,
    discovery,
    routes,
    routeSelection,
    workingContext,
    manifest,
    observation,
  });
}

function createTaskIntent(doc: DefDoc): TaskIntent {
  const anchorKey = `definition:${doc.docId}`;
  return {
    taskKey: `definition-context:${doc.docId}`,
    objective: `Collect bounded authoring context for definition ${doc.docId}`,
    anchor: {
      anchorKey,
      ref: doc.address ?? doc.docId,
      kind: 'entity',
    },
  };
}

function createSnapshotRef(doc: DefDoc): string {
  return `definition:${doc.docId}:revision:${doc.revision ?? doc.version}`;
}

function createDiscoveryNodes(
  task: TaskIntent,
  boundaryContext: DefBoundaryContextResult | null,
): readonly DefinitionGraphRouteNode[] {
  const graphRoute: DefinitionGraphRouteNode = {
    route: {
      kind: 'discovery',
      routeKey: 'definition.boundary-context.summary',
      purpose: 'Find the definition boundary, concerns, impact, and feedback context',
      fromAnchor: task.anchor.anchorKey,
      relationPath: ['definition', 'boundary-context'],
      bounds: DEFINITION_ROUTE_BOUNDS,
      estimatedCostTokens: estimateTokens(boundaryContext ?? {}),
      representation: 'summary',
    },
    priority: 100,
    estimatedSize: {
      objectCount: boundaryContext
        ? 1 + boundaryContext.boundary.members.length + boundaryContext.feedbackTrace.length
        : 1,
      relationCount: boundaryContext
        ? boundaryContext.boundary.couplings.outgoing.length
          + boundaryContext.boundary.couplings.incoming.length
          + boundaryContext.impact.impacted.length
        : 0,
    },
    sourceRef: `definition:${task.anchor.ref}`,
  };

  return Object.freeze([graphRoute]);
}

function createResolutionRoutes(
  task: TaskIntent,
  doc: DefDoc,
  boundaryContext: DefBoundaryContextResult | null,
  body: DefDocBody | null,
): readonly ResolutionRoute[] {
  const routes: ResolutionRoute[] = [
    {
      kind: 'resolution',
      routeKey: 'definition.document.authoritative',
      purpose: 'Resolve the authoritative definition document metadata',
      fromAnchor: task.anchor.anchorKey,
      relationPath: ['definition', 'document'],
      bounds: DEFINITION_ROUTE_BOUNDS,
      estimatedCostTokens: estimateTokens(doc),
      requiredFactKeys: ['definition.document'],
      authority: { minimum: 'authoritative' },
    },
  ];
  if (boundaryContext) {
    routes.push({
      kind: 'resolution',
      routeKey: 'definition.boundary-context.verified',
      purpose: 'Resolve the verified definition boundary context',
      fromAnchor: task.anchor.anchorKey,
      relationPath: ['definition', 'boundary-context', 'verified'],
      bounds: DEFINITION_ROUTE_BOUNDS,
      estimatedCostTokens: estimateTokens(boundaryContext),
      requiredFactKeys: ['definition.boundary-context'],
      authority: { minimum: 'verified' },
    });
  }
  if (body?.body.trim()) {
    routes.push({
      kind: 'resolution',
      routeKey: 'definition.body.authoritative',
      purpose: 'Resolve the authoritative definition document body',
      fromAnchor: task.anchor.anchorKey,
      relationPath: ['definition', 'document', 'body'],
      bounds: DEFINITION_ROUTE_BOUNDS,
      estimatedCostTokens: estimateTokens(body.body),
      requiredFactKeys: ['definition.body'],
      authority: { minimum: 'authoritative' },
    });
  }
  return Object.freeze(routes);
}

function createRequiredFacts(
  doc: DefDoc,
  boundaryContext: DefBoundaryContextResult | null,
  body: DefDocBody | null,
  routes: readonly ResolutionRoute[],
): readonly RequiredFact[] {
  const routeByFact = new Map(
    routes.flatMap((route) => route.requiredFactKeys.map((factKey) => [factKey, route] as const)),
  );
  const required: RequiredFact[] = [
    {
      factKey: 'definition.document',
      resolutionRouteKey: routeByFact.get('definition.document')!.routeKey,
      requiredFor: ['working'],
      authority: { minimum: 'authoritative' },
      freshness: doc.revision === undefined ? undefined : { maxAgeMs: 86_400_000 },
    },
  ];
  if (boundaryContext) {
    required.push({
      factKey: 'definition.boundary-context',
      resolutionRouteKey: routeByFact.get('definition.boundary-context')!.routeKey,
      requiredFor: ['working'],
      authority: { minimum: 'verified' },
    });
  }
  if (body?.body.trim()) {
    required.push({
      factKey: 'definition.body',
      resolutionRouteKey: routeByFact.get('definition.body')!.routeKey,
      requiredFor: ['working'],
      authority: { minimum: 'authoritative' },
      freshness: body.revision === undefined ? undefined : { maxAgeMs: 86_400_000 },
    });
  }
  return Object.freeze(required);
}

function createResolutionRecords(
  doc: DefDoc,
  boundaryContext: DefBoundaryContextResult | null,
  body: DefDocBody | null,
  route: ResolutionRoute,
  now: string,
) {
  const revision = `definition:${doc.docId}:${doc.revision ?? doc.version}`;
  const records = [
    {
      factKey: 'definition.document',
      value: doc,
      authority: 'authoritative' as const,
      observedAt: now,
      revision,
      evidenceRefs: [doc.address ? `definition:${doc.address}` : `definition:${doc.docId}`],
    },
    ...(boundaryContext
      ? [{
          factKey: 'definition.boundary-context',
          value: boundaryContext,
          authority: 'verified' as const,
          observedAt: now,
          revision,
          evidenceRefs: [`definition-graph:${doc.docId}`],
        }]
      : []),
    ...(body?.body.trim()
      ? [{
          factKey: 'definition.body',
          value: body.body,
          authority: 'authoritative' as const,
          observedAt: now,
          revision: body.bodyHash ? `${revision}:body:${body.bodyHash}` : revision,
          evidenceRefs: [body.sourcePath ? `source:${body.sourcePath}` : `definition:${doc.docId}`],
        }]
      : []),
  ];
  return records.filter((record) => route.requiredFactKeys.includes(record.factKey));
}

function estimatedRouteSize(
  route: ResolutionRoute,
  doc: DefDoc,
  boundaryContext: DefBoundaryContextResult | null,
  body: DefDocBody | null,
) {
  const value = route.requiredFactKeys.includes('definition.document')
    ? doc
    : route.requiredFactKeys.includes('definition.boundary-context')
      ? boundaryContext ?? {}
      : body?.body ?? '';
  return {
    objectCount: 1,
    relationCount: Array.isArray(value) ? value.length : 0,
  };
}

function routePriority(route: ResolutionRoute): number {
  if (route.requiredFactKeys.includes('definition.document')) return 90;
  if (route.requiredFactKeys.includes('definition.boundary-context')) return 80;
  return 70;
}

function createRouteManifestDigest(routeKeys: readonly string[]): string {
  const canonical = JSON.stringify([...routeKeys].toSorted());
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

function estimateTokens(value: unknown): number {
  return Math.max(1, Math.ceil(JSON.stringify(value).length / 4));
}
