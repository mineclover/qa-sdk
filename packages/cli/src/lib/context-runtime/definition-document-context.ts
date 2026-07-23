// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { createHash } from 'node:crypto';
import type { EventRecordLike } from '@qa-sdk/core';
import type {
  DefBoundaryContextResult,
  DefDataSource,
  DefDoc,
  DefDocBody,
  DefIncomingLink,
  DefOutgoingLink,
} from 'definition-catalog';
import {
  compileWorkingContext,
  createContextUsageLedger,
  createContextBudgetProfile,
  createContextManifest,
  createTaskHandoff,
  createDefinitionGraphDiscoveryAdapter,
  createFederatedResolutionAdapter,
  executeDiscoveryTaskDecomposition,
  executeAndAggregateTaskHandoffs,
  freezeRouteSelection,
  JSON_CONTEXT_TOKEN_COUNTER,
  mapContextObservation,
  planDiscovery,
  type ContextManifest,
  type ContextObservationRecord,
  type ContextBudgetProfile,
  type ContextTokenCounter,
  type ContextTokenCountContext,
  type ContextUsageEvent,
  type ContextRoute,
  type ContextUsageMeasurement,
  type ContextUsageSummary,
  type DefinitionGraphRouteNode,
  type DiscoveryPlan,
  type DiscoveryTaskExecutionResult,
  type DiscoveryTaskDecomposition,
  type DiscoveryTaskSlice,
  type RequiredFact,
  type ResolutionRoute,
  type RouteSelection,
  type TaskIntent,
  type TaskHandoff,
  type TaskHandoffDecompositionExecutionOptions,
  type TaskHandoffDecompositionExecutionResult,
  type NextTask,
  type WorkingContext,
} from 'context-runtime';

const DEFINITION_ROUTE_BOUNDS = Object.freeze({
  maxDepth: 1,
  maxFanOut: 8,
  maxItems: 64,
  cyclePolicy: 'stop' as const,
});

export type DefinitionContextFactKey =
  | 'definition.document'
  | 'definition.boundary-context'
  | 'definition.body';

const DEFAULT_REQUIRED_DEFINITION_FACT_KEYS: readonly DefinitionContextFactKey[] = Object.freeze([
  'definition.document',
  'definition.boundary-context',
  'definition.body',
]);

export interface BoundedDefinitionContextInput {
  readonly source: Pick<
    DefDataSource,
    | 'get'
    | 'getBody'
    | 'getBoundaryContext'
    | 'getChildren'
    | 'getIncomingLinks'
    | 'getOutgoingLinks'
  >;
  readonly docId: string;
  /** 이미 composition root에서 읽은 문서가 있으면 중복 단건 조회를 피한다. */
  readonly document?: DefDoc;
  /** 테스트·상위 event adapter가 observation persistence를 명시적으로 연결하는 seam. */
  readonly observationSink?: (observation: ContextObservationRecord) => void | Promise<void>;
  readonly observationEventSink?: (event: EventRecordLike) => void | Promise<void>;
  readonly budget?: ContextBudgetProfile;
  /** Provider/model counter shared by canonical Discovery candidates and Working Facts. */
  readonly tokenCounter?: DefinitionContextTokenCounter;
  /** Working Context가 닫히기 위해 반드시 해소되어야 하는 definition Fact. */
  readonly requiredFactKeys?: readonly DefinitionContextFactKey[];
  /** 이전 discovery/working 단계의 ledger snapshot. `usedTokens`와 동시 사용하지 않는다. */
  readonly initialUsage?: ContextUsageSummary;
  readonly usedTokens?: number;
  readonly usedTokensMeasurement?: ContextUsageMeasurement;
  readonly now?: string;
}

/** CLI composition-root metadata carried by an externally supplied tokenizer. */
export interface DefinitionContextTokenCounter extends ContextTokenCounter {
  readonly provider?: string;
  readonly model?: string;
  readonly tokenizerRevision?: string;
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
  readonly observationEvent: EventRecordLike;
  readonly usage: ContextUsageSummary;
  /** Exact counter identity when a provider tokenizer was supplied. */
  readonly tokenCounter?: DefinitionTokenCounterDescriptor;
}

export interface DefinitionTokenCounterDescriptor {
  readonly provider: string;
  readonly model: string;
  readonly tokenizerRevision?: string;
}

export interface DefinitionTaskHandoffInput {
  readonly boundedContext: BoundedDefinitionContextResult;
  readonly resultRevision: string;
  readonly sourceRevision?: string;
  readonly unresolvedQuestions: readonly string[];
  readonly nextTask?: NextTask;
}

/**
 * Definition consumer seam for executing cap-generated child Tasks. The
 * composition root owns source/provider work and returns a reference-only
 * child Handoff; this adapter only orchestrates and aggregates the result.
 */
export interface DefinitionTaskDecompositionExecutionInput extends TaskHandoffDecompositionExecutionOptions {
  readonly decomposition: DiscoveryTaskDecomposition;
  readonly executeChild: (task: DiscoveryTaskSlice) => TaskHandoff | Promise<TaskHandoff>;
}

export function executeDefinitionTaskDecomposition(
  input: DefinitionTaskDecompositionExecutionInput,
): Promise<TaskHandoffDecompositionExecutionResult> {
  return executeAndAggregateTaskHandoffs(input);
}

export interface DefinitionDiscoveryReference {
  readonly taskKey: string;
  readonly routeKeys: readonly string[];
  readonly sourceRefs: readonly string[];
}

export interface DefinitionChildExecutionResult {
  readonly taskKey: string;
  readonly kind: 'discovery' | 'handoff';
  readonly routeKeys: readonly string[];
  readonly sourceRefs?: readonly string[];
  readonly unresolvedQuestions: readonly string[];
  readonly handoff?: TaskHandoff;
}

export interface DefinitionTaskDecompositionConsumerInput {
  readonly decomposition: DiscoveryTaskDecomposition;
  readonly executeChild: (
    task: DiscoveryTaskSlice,
  ) => DefinitionChildExecutionResult | Promise<DefinitionChildExecutionResult>;
  readonly sourceRevision: string;
  readonly resultRevision: string;
  readonly unresolvedQuestions: readonly string[];
  readonly nextTask?: NextTask;
  readonly continueOnError?: boolean;
}

export interface DefinitionTaskDecompositionConsumerResult {
  readonly execution: DiscoveryTaskExecutionResult<DefinitionChildExecutionResult>;
  readonly discoveryRefs: readonly DefinitionDiscoveryReference[];
  readonly unresolvedQuestions: readonly string[];
  /** Resolution child Handoffs only; discovery refs never become Facts. */
  readonly handoff?: TaskHandoff;
}

/**
 * Definition-specific decomposition policy. Discovery child results remain
 * references, while resolution child results contribute to the parent
 * reference-only Handoff. A partial execution never creates that Handoff.
 */
export async function executeDefinitionTaskDecompositionWithDiscovery(
  input: DefinitionTaskDecompositionConsumerInput,
): Promise<DefinitionTaskDecompositionConsumerResult> {
  const execution = await executeDiscoveryTaskDecomposition(
    input.decomposition,
    input.executeChild,
    { continueOnError: input.continueOnError },
  );
  const completed = execution.children.filter(
    (record): record is typeof record & { result: DefinitionChildExecutionResult } =>
      record.status === 'completed',
  );
  const normalized = completed.map((record) =>
    normalizeDefinitionChildResult(record.task, record.result),
  );
  const discoveryRefs = Object.freeze(
    normalized
      .filter((result) => result.kind === 'discovery')
      .map((result) =>
        Object.freeze({
          taskKey: result.taskKey,
          routeKeys: Object.freeze([...result.routeKeys]),
          sourceRefs: Object.freeze(sortUnique(result.sourceRefs ?? [])),
        }),
      ),
  );
  const unresolvedQuestions = Object.freeze(
    sortUnique([
      ...input.unresolvedQuestions,
      ...normalized.flatMap((result) => result.unresolvedQuestions),
    ]),
  );

  if (execution.status !== 'completed') {
    return Object.freeze({ execution, discoveryRefs, unresolvedQuestions });
  }

  const resolutionResults = normalized.filter((result) => result.kind === 'handoff');
  if (resolutionResults.length === 0) {
    return Object.freeze({ execution, discoveryRefs, unresolvedQuestions });
  }

  const resolutionChildren = input.decomposition.children.filter((task) =>
    resolutionResults.some((result) => result.taskKey === task.taskKey),
  );
  const handoff = await executeAndAggregateTaskHandoffs({
    decomposition: {
      ...input.decomposition,
      children: resolutionChildren,
    },
    executeChild: async (task) => {
      const result = resolutionResults.find((candidate) => candidate.taskKey === task.taskKey)!;
      return result.handoff!;
    },
    sourceRevision: input.sourceRevision,
    resultRevision: input.resultRevision,
    unresolvedQuestions,
    ...(input.nextTask ? { nextTask: input.nextTask } : {}),
  });
  return Object.freeze({
    execution,
    discoveryRefs,
    unresolvedQuestions,
    ...(handoff.handoff ? { handoff: handoff.handoff } : {}),
  });
}

function normalizeDefinitionChildResult(
  task: DiscoveryTaskSlice,
  result: DefinitionChildExecutionResult,
): DefinitionChildExecutionResult {
  if (result.taskKey !== task.taskKey) {
    throw new Error(`child result taskKey가 일치하지 않습니다: ${task.taskKey}`);
  }
  if (result.kind !== 'discovery' && result.kind !== 'handoff') {
    throw new Error(`child result kind이 유효하지 않습니다: ${task.taskKey}`);
  }
  if (result.routeKeys.length === 0 || result.routeKeys.some((routeKey) => !routeKey.trim())) {
    throw new Error(`child result routeKeys가 비어 있습니다: ${task.taskKey}`);
  }
  if (result.routeKeys.some((routeKey) => !task.routeKeys.includes(routeKey))) {
    throw new Error(`child result routeKeys가 decomposition과 일치하지 않습니다: ${task.taskKey}`);
  }
  if (result.unresolvedQuestions.some((question) => !question.trim())) {
    throw new Error(`child result unresolvedQuestions가 유효하지 않습니다: ${task.taskKey}`);
  }
  if (result.kind === 'discovery' && result.handoff) {
    throw new Error(`discovery child는 Handoff를 포함할 수 없습니다: ${task.taskKey}`);
  }
  if (result.kind === 'handoff' && !result.handoff) {
    throw new Error(`handoff child에 Handoff가 없습니다: ${task.taskKey}`);
  }
  return Object.freeze({
    ...result,
    routeKeys: Object.freeze([...result.routeKeys]),
    ...(result.sourceRefs ? { sourceRefs: Object.freeze(sortUnique(result.sourceRefs)) } : {}),
    unresolvedQuestions: Object.freeze(sortUnique(result.unresolvedQuestions)),
  });
}

/**
 * Compose a definition consumer result into the runtime's reference-only
 * Handoff. Persistence remains outside this adapter and is supplied by the
 * CLI composition root.
 */
export function createDefinitionTaskHandoff(input: DefinitionTaskHandoffInput): TaskHandoff {
  if (!input.boundedContext.manifest) {
    throw new Error('닫힌 Working Context가 없어 Definition Task Handoff를 만들 수 없습니다');
  }

  return createTaskHandoff({
    workingContext: input.boundedContext.workingContext,
    manifest: input.boundedContext.manifest,
    sourceRevision: input.sourceRevision ?? input.boundedContext.snapshotRef,
    resultRevision: input.resultRevision,
    unresolvedQuestions: input.unresolvedQuestions,
    ...(input.nextTask ? { nextTask: input.nextTask } : {}),
  });
}

/**
 * Definition 문서 graph를 context-runtime의 Discovery/Working 계약에 연결한다.
 *
 * Discovery는 문서 metadata와 bounded estimate만 사용한다. Route selection을
 * freeze한 뒤에 선택된 resolution route만 source 원문을 읽어 Working Fact로
 * 투영한다. 이 순서를 지켜 cap에서 source payload가 선행 로드되지 않게 한다.
 */
export async function buildBoundedDefinitionContext(
  input: BoundedDefinitionContextInput,
): Promise<BoundedDefinitionContextResult> {
  const now = input.now ?? new Date().toISOString();
  const budget = input.budget ?? createContextBudgetProfile();
  const tokenCounter: DefinitionContextTokenCounter =
    input.tokenCounter ?? JSON_CONTEXT_TOKEN_COUNTER;
  const tokenCounterDescriptor =
    tokenCounter.provider && tokenCounter.model
      ? Object.freeze({
          provider: tokenCounter.provider,
          model: tokenCounter.model,
          ...(tokenCounter.tokenizerRevision
            ? { tokenizerRevision: tokenCounter.tokenizerRevision }
            : {}),
        })
      : undefined;
  const tokenCounterUsageIdentity = toTokenCounterUsageIdentity(tokenCounter);
  const requiredFactKeys = input.requiredFactKeys ?? DEFAULT_REQUIRED_DEFINITION_FACT_KEYS;
  if (requiredFactKeys.length === 0 || new Set(requiredFactKeys).size !== requiredFactKeys.length) {
    throw new Error('requiredFactKeys는 하나 이상의 중복 없는 Fact key를 가져야 합니다');
  }
  if (input.initialUsage && input.usedTokens !== undefined) {
    throw new Error('initialUsage와 usedTokens는 동시에 사용할 수 없습니다');
  }
  const usageLedger = createContextUsageLedger(input.initialUsage?.events);
  const initialUsageSnapshot = usageLedger.snapshot();
  if (input.initialUsage) {
    assertUsageSummaryMatchesEvents(input.initialUsage, initialUsageSnapshot);
  }
  const usedTokens = input.usedTokens ?? initialUsageSnapshot.discoveryTokens;
  const doc = input.document ?? (await input.source.get(input.docId));
  if (!doc) {
    throw new Error(`문서 "${input.docId}" 없음`);
  }

  if (!input.initialUsage) {
    usageLedger.record({
      phase: 'discovery',
      tokens: usedTokens,
      measurement: input.usedTokensMeasurement ?? 'estimated',
      sourceRef: 'context-input',
      ...tokenCounterUsageIdentity,
    });
  }

  const task = createTaskIntent(doc);
  const snapshotRef = createSnapshotRef(doc);
  const resolutionRoutes = createResolutionRoutes(task, doc);
  const discoveryNodes = await createDefinitionGraphDiscoveryCandidates(input.source, task, doc);
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
      estimatedSize: estimatedRouteSize(route),
      sourceRef: `definition:${doc.docId}`,
    })),
  ];

  const discovery = planDiscovery({
    intent: task,
    candidates,
    budget,
    usedTokens,
    tokenCounter,
  });
  for (const projection of discovery.projections) {
    usageLedger.record({
      phase: 'discovery',
      tokens: projection.estimatedCostTokens,
      measurement: projection.costMeasurement ?? 'estimated',
      routeKey: projection.routeKey,
      sourceRef: projection.sourceRef,
      ...tokenCounterUsageIdentity,
    });
  }
  const routes = Object.freeze(candidates.map((candidate) => candidate.route));
  const routeManifestDigest = createRouteManifestDigest(discovery.selectedRouteKeys);
  const routeSelection = freezeRouteSelection(
    routes,
    discovery.selectedRouteKeys,
    now,
    routeManifestDigest,
  );

  const selectedRouteKeys = new Set(routeSelection.selectedRouteKeys);
  const [boundaryContext, body] = await Promise.all([
    selectedRouteKeys.has('definition.boundary-context.verified')
      ? input.source.getBoundaryContext(input.docId, 'overview', 'transitive')
      : Promise.resolve(null),
    selectedRouteKeys.has('definition.body.authoritative')
      ? input.source.getBody(input.docId)
      : Promise.resolve(null),
  ]);
  const selectedResolutionRoutes = resolutionRoutes.filter((route) =>
    selectedRouteKeys.has(route.routeKey),
  );

  const resolutionAdapter = createFederatedResolutionAdapter({
    resolve: ({ route }) => createResolutionRecords(doc, boundaryContext, body, route, now),
  });
  const resolvedFacts = selectedResolutionRoutes.flatMap((route) =>
    resolutionAdapter.resolve({
      taskKey: task.taskKey,
      snapshotRef,
      route,
      requiredFactKeys: route.requiredFactKeys,
    }),
  );
  const factByKey = new Map(resolvedFacts.map((fact) => [fact.factKey, fact]));
  for (const fact of factByKey.values()) {
    usageLedger.record({
      phase: 'working',
      tokens: tokenCounter.count(fact.value, {
        phase: 'working',
        routeKey: fact.resolutionRouteKey,
        factKey: fact.factKey,
      } satisfies ContextTokenCountContext),
      measurement: tokenCounter.measurement,
      routeKey: fact.resolutionRouteKey,
      ...tokenCounterUsageIdentity,
    });
  }
  const usage = usageLedger.snapshot();
  const requiredFacts = createRequiredFacts(doc, resolutionRoutes, requiredFactKeys);
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
    workingUsageTokens: usage.workingTokens,
    workingBudgetTokens: budget.workingReserveTokens,
    now,
  });
  const manifest =
    workingContext.status === 'closed'
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
    usage,
  });
  const observationEvent = toContextObservationEventRecord(observation, now);
  await input.observationSink?.(observation);
  await input.observationEventSink?.(observationEvent);

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
    observationEvent,
    usage,
    ...(tokenCounterDescriptor ? { tokenCounter: tokenCounterDescriptor } : {}),
  });
}

export function toContextObservationEventRecord(
  observation: ContextObservationRecord,
  timestamp: string,
): EventRecordLike {
  return Object.freeze({
    event_key: observation.eventName,
    event_version: '1',
    timestamp,
    payload: Object.freeze({
      task_key: observation.taskKey,
      stage: observation.stage,
      status: observation.status,
      route_keys: observation.routeKeys,
      fact_count: observation.factCount,
      ...(observation.manifestDigest ? { manifest_digest: observation.manifestDigest } : {}),
      ...(observation.usage
        ? {
            discovery_tokens: observation.usage.discoveryTokens,
            working_tokens: observation.usage.workingTokens,
            total_tokens: observation.usage.totalTokens,
            usage_measurement: observation.usage.measurement,
            ...(observation.usage.metrics?.bytes !== undefined
              ? { usage_bytes: observation.usage.metrics.bytes }
              : {}),
            ...(observation.usage.metrics?.latencyMs !== undefined
              ? { usage_latency_ms: observation.usage.metrics.latencyMs }
              : {}),
            ...(observation.usage.metrics
              ? { usage_metric_measurement: observation.usage.metrics.measurement }
              : {}),
          }
        : {}),
    }),
    ...(observation.addressContext ? { address_context: { ...observation.addressContext } } : {}),
  });
}

function toTokenCounterUsageIdentity(
  tokenCounter: DefinitionContextTokenCounter,
): Pick<ContextUsageEvent, 'provider' | 'model' | 'tokenizerRevision'> {
  return tokenCounter.provider && tokenCounter.model
    ? {
        provider: tokenCounter.provider,
        model: tokenCounter.model,
        ...(tokenCounter.tokenizerRevision
          ? { tokenizerRevision: tokenCounter.tokenizerRevision }
          : {}),
      }
    : {};
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

async function createDefinitionGraphDiscoveryCandidates(
  source: Pick<DefDataSource, 'getChildren' | 'getIncomingLinks' | 'getOutgoingLinks'>,
  task: TaskIntent,
  doc: DefDoc,
): Promise<readonly DefinitionGraphRouteNode[]> {
  const [children, incoming, outgoing] = await Promise.all([
    source.getChildren(doc.docId),
    source.getIncomingLinks(doc.docId),
    source.getOutgoingLinks(doc.docId),
  ]);
  const references = collectDefinitionGraphReferences(children, incoming, outgoing)
    .filter((reference) => reference.docId !== doc.docId)
    .sort(compareDefinitionGraphReferences)
    .slice(0, DEFINITION_ROUTE_BOUNDS.maxFanOut);

  const summaryRoute: DefinitionGraphRouteNode = {
    route: {
      kind: 'discovery',
      routeKey: 'definition.boundary-context.summary',
      purpose: 'Find the definition boundary, concerns, impact, and feedback context',
      fromAnchor: task.anchor.anchorKey,
      relationPath: ['definition', 'boundary-context'],
      bounds: DEFINITION_ROUTE_BOUNDS,
      estimatedCostTokens: DEFINITION_ROUTE_ESTIMATES.discovery.costTokens,
      representation: 'summary',
    },
    priority: 100,
    estimatedSize: {
      objectCount: Math.max(1, references.length),
      relationCount: references.length,
    },
    sourceRef: `definition:${task.anchor.ref}`,
  };

  const graphRoutes = references.map((reference) => {
    const routeKey = [
      'definition.graph',
      reference.direction,
      reference.type,
      encodeURIComponent(reference.docId),
    ].join('.');
    return {
      route: {
        kind: 'discovery' as const,
        routeKey,
        purpose: `Inspect ${reference.direction} ${reference.type} definition ${reference.docId}`,
        fromAnchor: task.anchor.anchorKey,
        relationPath: ['definition', 'graph', reference.direction, reference.type],
        bounds: DEFINITION_ROUTE_BOUNDS,
        estimatedCostTokens: DEFINITION_ROUTE_ESTIMATES.graph.costTokens,
        representation: 'summary' as const,
      },
      priority: graphReferencePriority(reference),
      estimatedSize: DEFINITION_ROUTE_ESTIMATES.graph.size,
      sourceRef: `definition:${reference.docId}`,
    } satisfies DefinitionGraphRouteNode;
  });

  return Object.freeze([summaryRoute, ...graphRoutes]);
}

interface DefinitionGraphReference {
  readonly docId: string;
  readonly direction: 'incoming' | 'outgoing';
  readonly type: string;
}

function collectDefinitionGraphReferences(
  children: readonly DefDoc[],
  incoming: readonly DefIncomingLink[],
  outgoing: readonly DefOutgoingLink[],
): readonly DefinitionGraphReference[] {
  const references = new Map<string, DefinitionGraphReference>();
  for (const child of children) {
    const reference = {
      docId: child.docId,
      direction: 'outgoing' as const,
      type: 'contains',
    };
    references.set(`${reference.direction}:${reference.type}:${reference.docId}`, reference);
  }
  for (const link of incoming) {
    const reference = {
      docId: link.source,
      direction: 'incoming' as const,
      type: link.type,
    };
    references.set(`${reference.direction}:${reference.type}:${reference.docId}`, reference);
  }
  for (const link of outgoing) {
    const reference = {
      docId: link.target,
      direction: 'outgoing' as const,
      type: link.type,
    };
    references.set(`${reference.direction}:${reference.type}:${reference.docId}`, reference);
  }
  return [...references.values()];
}

function compareDefinitionGraphReferences(
  left: DefinitionGraphReference,
  right: DefinitionGraphReference,
): number {
  return (
    graphReferencePriority(right) - graphReferencePriority(left) ||
    left.direction.localeCompare(right.direction) ||
    left.type.localeCompare(right.type) ||
    left.docId.localeCompare(right.docId)
  );
}

function graphReferencePriority(reference: DefinitionGraphReference): number {
  if (reference.type === 'depends_on' || reference.type === 'constrains') return 90;
  if (reference.type === 'refines' || reference.type === 'implements') return 85;
  if (reference.type === 'contains') return 80;
  return reference.direction === 'outgoing' ? 75 : 70;
}

function createResolutionRoutes(task: TaskIntent, doc: DefDoc): readonly ResolutionRoute[] {
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
  routes.push({
    kind: 'resolution',
    routeKey: 'definition.boundary-context.verified',
    purpose: 'Resolve the verified definition boundary context',
    fromAnchor: task.anchor.anchorKey,
    relationPath: ['definition', 'boundary-context', 'verified'],
    bounds: DEFINITION_ROUTE_BOUNDS,
    estimatedCostTokens: DEFINITION_ROUTE_ESTIMATES.boundary.costTokens,
    requiredFactKeys: ['definition.boundary-context'],
    authority: { minimum: 'verified' },
  });
  routes.push({
    kind: 'resolution',
    routeKey: 'definition.body.authoritative',
    purpose: 'Resolve the authoritative definition document body',
    fromAnchor: task.anchor.anchorKey,
    relationPath: ['definition', 'document', 'body'],
    bounds: DEFINITION_ROUTE_BOUNDS,
    estimatedCostTokens: DEFINITION_ROUTE_ESTIMATES.body.costTokens,
    requiredFactKeys: ['definition.body'],
    authority: { minimum: 'authoritative' },
  });
  return Object.freeze(routes);
}

function createRequiredFacts(
  doc: DefDoc,
  routes: readonly ResolutionRoute[],
  requiredFactKeys: readonly DefinitionContextFactKey[],
): readonly RequiredFact[] {
  const routeByFact = new Map(
    routes.flatMap((route) => route.requiredFactKeys.map((factKey) => [factKey, route] as const)),
  );
  return Object.freeze(
    requiredFactKeys.map((factKey) => {
      const route = routeByFact.get(factKey);
      if (!route) {
        throw new Error(`Required definition Fact route missing: ${factKey}`);
      }
      return {
        factKey,
        resolutionRouteKey: route.routeKey,
        requiredFor: ['working'] as const,
        authority: {
          minimum:
            factKey === 'definition.boundary-context'
              ? ('verified' as const)
              : ('authoritative' as const),
        },
        ...(factKey === 'definition.document' || factKey === 'definition.body'
          ? { freshness: { maxAgeMs: 86_400_000 } }
          : {}),
      };
    }),
  );
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
      ? [
          {
            factKey: 'definition.boundary-context',
            value: boundaryContext,
            authority: 'verified' as const,
            observedAt: now,
            revision,
            evidenceRefs: [`definition-graph:${doc.docId}`],
          },
        ]
      : []),
    ...(body?.body.trim()
      ? [
          {
            factKey: 'definition.body',
            value: body.body,
            authority: 'authoritative' as const,
            observedAt: now,
            revision: body.bodyHash ? `${revision}:body:${body.bodyHash}` : revision,
            evidenceRefs: [
              body.sourcePath ? `source:${body.sourcePath}` : `definition:${doc.docId}`,
            ],
          },
        ]
      : []),
  ];
  return records.filter((record) => route.requiredFactKeys.includes(record.factKey));
}

function estimatedRouteSize(route: ResolutionRoute) {
  if (route.routeKey === 'definition.boundary-context.verified') {
    return DEFINITION_ROUTE_ESTIMATES.boundary.size;
  }
  if (route.routeKey === 'definition.body.authoritative') {
    return DEFINITION_ROUTE_ESTIMATES.body.size;
  }
  return DEFINITION_ROUTE_ESTIMATES.document.size;
}

function routePriority(route: ResolutionRoute): number {
  if (route.requiredFactKeys.includes('definition.document')) return 90;
  if (route.requiredFactKeys.includes('definition.boundary-context')) return 80;
  return 70;
}

function sortUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function createRouteManifestDigest(routeKeys: readonly string[]): string {
  const canonical = JSON.stringify([...routeKeys].toSorted());
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

function estimateTokens(value: unknown): number {
  return Math.max(1, Math.ceil(JSON.stringify(value).length / 4));
}

function assertUsageSummaryMatchesEvents(
  declared: ContextUsageSummary,
  actual: ContextUsageSummary,
): void {
  if (
    declared.discoveryTokens !== actual.discoveryTokens ||
    declared.workingTokens !== actual.workingTokens ||
    declared.totalTokens !== actual.totalTokens ||
    declared.measurement !== actual.measurement ||
    JSON.stringify(declared.metrics ?? null) !== JSON.stringify(actual.metrics ?? null)
  ) {
    throw new Error(
      'initialUsage summary가 usage events의 phase 합계·measurement와 일치하지 않습니다',
    );
  }
}

const DEFINITION_ROUTE_ESTIMATES = Object.freeze({
  discovery: Object.freeze({
    costTokens: 2_000,
    size: Object.freeze({ objectCount: 8, relationCount: 16 }),
  }),
  document: Object.freeze({
    size: Object.freeze({ objectCount: 1, relationCount: 0 }),
  }),
  boundary: Object.freeze({
    costTokens: 8_000,
    size: Object.freeze({ objectCount: 16, relationCount: 32 }),
  }),
  body: Object.freeze({
    costTokens: 32_000,
    size: Object.freeze({ objectCount: 1, relationCount: 0 }),
  }),
  graph: Object.freeze({
    costTokens: 1_000,
    size: Object.freeze({ objectCount: 1, relationCount: 1 }),
  }),
});
