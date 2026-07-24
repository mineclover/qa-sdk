import { assertValidContextBudgetProfile, availableDiscoveryTokens } from './budget.js';
import {
  ContextRuntimeError,
  type ContextRoute,
  type DiscoveryCandidate,
  type DiscoveryDecompositionReason,
  type DiscoveryPlan,
  type DiscoveryPlanInput,
  type DiscoveryTaskDecomposition,
  type DiscoveryRouteProjection,
  type EstimatedRouteSize,
  type SkippedDiscoveryRoute,
  type TaskIntent,
  type ValidationIssue,
  type ContextTokenCounter,
  type ContextTokenCountContext,
  type StopDecision,
  type StopProgress,
} from './types.js';
import { validateRoute, validateRouteSet } from './routes.js';
import { assertValidStopPolicy, evaluateStopDecision, isProgressEmpty } from './stop-rules.js';

export function projectDiscoveryCandidate(
  candidate: DiscoveryCandidate,
  tokenCounter?: ContextTokenCounter,
): DiscoveryRouteProjection {
  const issues = validateCandidate(candidate);
  if (issues.length > 0) {
    throw new ContextRuntimeError(
      'invalid-discovery-plan',
      'Discovery candidate is invalid',
      issues,
    );
  }

  const route = candidate.route;
  const authority = route.kind === 'resolution' ? route.authority.minimum : 'projection_allowed';
  const costMeasurement = tokenCounter?.measurement ?? 'estimated';
  const estimatedCostTokens = tokenCounter
    ? countCandidateTokens(candidate, tokenCounter)
    : route.estimatedCostTokens;

  return Object.freeze({
    routeKey: route.routeKey,
    kind: route.kind,
    priority: candidate.priority,
    estimatedCostTokens,
    ...(tokenCounter ? { costMeasurement } : {}),
    estimatedSize: Object.freeze({ ...candidate.estimatedSize }),
    authority,
    ...(candidate.sourceRef ? { sourceRef: candidate.sourceRef } : {}),
    ...(route.kind === 'resolution' && route.freshness
      ? { freshness: Object.freeze({ ...route.freshness }) }
      : {}),
  });
}

export function planDiscovery(input: DiscoveryPlanInput): DiscoveryPlan {
  const budget = assertValidContextBudgetProfile(input.budget);
  if (input.stopPolicy) assertValidStopPolicy(input.stopPolicy, 'invalid-discovery-plan');
  const inputIssues = validatePlanInput(input);
  if (inputIssues.length > 0) {
    throw new ContextRuntimeError(
      'invalid-discovery-plan',
      'Discovery plan input is invalid',
      inputIssues,
    );
  }

  const routeSetResult = validateRouteSet(input.candidates.map(({ route }) => route));
  if (!routeSetResult.valid) {
    throw new ContextRuntimeError(
      'invalid-discovery-plan',
      'Discovery plan contains invalid routes',
      routeSetResult.issues,
    );
  }

  const projections = input.candidates.map((candidate) =>
    projectDiscoveryCandidate(candidate, input.tokenCounter),
  );
  const candidates = input.candidates
    .map((candidate, index) => ({ candidate, projection: projections[index], index }))
    .sort(compareCandidates);
  const discoveryCapacity = availableDiscoveryTokens(budget);
  const remainingCapacity = Math.max(0, discoveryCapacity - input.usedTokens);
  const selectedRouteKeys: string[] = [];
  const selectedProjections: DiscoveryRouteProjection[] = [];
  const skippedRoutes: DiscoveryPlan['skippedRoutes'][number][] = [];
  let projectedCandidateTokens = 0;
  let projectedObjectCount = 0;
  let projectedRelationCount = 0;
  let progress: StopProgress = { newRoutes: 0, newFacts: 0, newEvidenceRefs: 0 };
  let consecutiveNoProgress = 0;
  let semanticStopDecision: StopDecision | undefined;
  let semanticStopReason: 'coverage-satisfied' | 'no-progress' | undefined;

  for (const [candidateIndex, { projection }] of candidates.entries()) {
    if (
      budget.maxRouteExpansions !== undefined &&
      selectedRouteKeys.length >= budget.maxRouteExpansions
    ) {
      skippedRoutes.push(
        Object.freeze({
          routeKey: projection.routeKey,
          reason: 'route-expansion-limit',
          estimatedCostTokens: projection.estimatedCostTokens,
          ...(projection.costMeasurement ? { costMeasurement: projection.costMeasurement } : {}),
        }),
      );
      continue;
    }

    if (
      budget.maxObjects !== undefined &&
      projectedObjectCount + projection.estimatedSize.objectCount > budget.maxObjects
    ) {
      skippedRoutes.push(
        Object.freeze({
          routeKey: projection.routeKey,
          reason: 'object-limit',
          estimatedCostTokens: projection.estimatedCostTokens,
          ...(projection.costMeasurement ? { costMeasurement: projection.costMeasurement } : {}),
        }),
      );
      continue;
    }

    if (
      budget.maxRelations !== undefined &&
      projectedRelationCount + projection.estimatedSize.relationCount > budget.maxRelations
    ) {
      skippedRoutes.push(
        Object.freeze({
          routeKey: projection.routeKey,
          reason: 'relation-limit',
          estimatedCostTokens: projection.estimatedCostTokens,
          ...(projection.costMeasurement ? { costMeasurement: projection.costMeasurement } : {}),
        }),
      );
      continue;
    }

    if (projectedCandidateTokens + projection.estimatedCostTokens > remainingCapacity) {
      skippedRoutes.push(
        Object.freeze({
          routeKey: projection.routeKey,
          reason: 'budget-exhausted',
          estimatedCostTokens: projection.estimatedCostTokens,
          ...(projection.costMeasurement ? { costMeasurement: projection.costMeasurement } : {}),
        }),
      );
      continue;
    }

    selectedRouteKeys.push(projection.routeKey);
    selectedProjections.push(projection);
    projectedCandidateTokens += projection.estimatedCostTokens;
    projectedObjectCount += projection.estimatedSize.objectCount;
    projectedRelationCount += projection.estimatedSize.relationCount;

    if (input.stopPolicy) {
      const routeProgress = input.progressByRoute?.[projection.routeKey] ?? {
        newRoutes: 1,
        newFacts: 0,
        newEvidenceRefs: 0,
      };
      progress = addProgress(progress, routeProgress);
      consecutiveNoProgress = isProgressEmpty(routeProgress) ? consecutiveNoProgress + 1 : 0;

      const routeOnlyPolicy = input.stopPolicy.obligations.every(
        (obligation) => obligation.kind === 'route',
      );
      const decision = evaluateStopDecision({
        policy: input.stopPolicy,
        selectedRouteKeys,
        progress,
        consecutiveNoProgress,
      });
      if (decision?.reason === 'coverage-satisfied' && routeOnlyPolicy) {
        semanticStopDecision = decision;
        semanticStopReason = 'coverage-satisfied';
        for (const remaining of candidates.slice(candidateIndex + 1)) {
          skippedRoutes.push(createSkippedRoute(remaining.projection, 'coverage-satisfied'));
        }
        break;
      }
      if (decision?.reason === 'no-progress') {
        semanticStopDecision = decision;
        semanticStopReason = 'no-progress';
        for (const remaining of candidates.slice(candidateIndex + 1)) {
          skippedRoutes.push(createSkippedRoute(remaining.projection, 'no-progress'));
        }
        break;
      }
    }
  }

  const hardSkippedRoutes = skippedRoutes.filter(isHardSkippedRoute);
  const hardStopReason = selectHardStopReason(hardSkippedRoutes);
  const stopDecision = input.stopPolicy
    ? hardStopReason
      ? evaluateStopDecision({
          policy: input.stopPolicy,
          selectedRouteKeys,
          progress,
          consecutiveNoProgress,
          hardStopReason,
        })
      : (semanticStopDecision ??
        (semanticStopReason === 'coverage-satisfied'
          ? evaluateStopDecision({
              policy: input.stopPolicy,
              selectedRouteKeys,
              progress,
              consecutiveNoProgress,
            })
          : undefined))
    : undefined;
  const capped = hardSkippedRoutes.length > 0;
  const projectedDiscoveryTokens = input.usedTokens + projectedCandidateTokens;
  const remainingDiscoveryTokens = Math.max(0, discoveryCapacity - projectedDiscoveryTokens);
  const nextAction: DiscoveryPlan['nextAction'] =
    capped && selectedRouteKeys.length === 0 ? 'decompose' : 'freeze';
  const decomposition =
    nextAction === 'decompose'
      ? createDiscoveryTaskDecomposition({
          intent: input.intent,
          candidates: input.candidates,
          skippedRoutes: hardSkippedRoutes,
        })
      : undefined;

  return Object.freeze({
    status: capped ? 'discovery-capped' : 'planned',
    nextAction,
    taskKey: input.intent.taskKey,
    anchorKey: input.intent.anchor.anchorKey,
    selectedRouteKeys: Object.freeze([...selectedRouteKeys]),
    projections: Object.freeze([...selectedProjections]),
    skippedRoutes: Object.freeze([...skippedRoutes]),
    usedTokens: input.usedTokens,
    projectedDiscoveryTokens,
    remainingDiscoveryTokens,
    projectedObjectCount,
    projectedRelationCount,
    workingReserveTokens: budget.workingReserveTokens,
    ...(stopDecision ? { stopDecision } : {}),
    ...(decomposition ? { decomposition } : {}),
  });
}

export function createDiscoveryTaskDecomposition(input: {
  readonly intent: TaskIntent;
  readonly candidates: readonly DiscoveryCandidate[];
  readonly skippedRoutes: readonly SkippedDiscoveryRoute[];
}): DiscoveryTaskDecomposition | undefined {
  if (input.skippedRoutes.length === 0) return undefined;

  const candidateByRoute = new Map(
    input.candidates.map((candidate) => [candidate.route.routeKey, candidate] as const),
  );
  const hardSkippedRoutes = input.skippedRoutes.filter(isHardSkippedRoute);
  if (hardSkippedRoutes.length === 0) return undefined;
  const reasons = new Set<DiscoveryDecompositionReason>(
    hardSkippedRoutes.map((route) => route.reason),
  );
  const reason: DiscoveryDecompositionReason = reasons.size === 1 ? [...reasons][0]! : 'mixed-cap';
  const usedTaskKeys = new Set<string>();
  const children = hardSkippedRoutes.flatMap((skippedRoute, index) => {
    const candidate = candidateByRoute.get(skippedRoute.routeKey);
    if (!candidate) return [];
    const taskKey = uniqueDecompositionTaskKey(
      `${input.intent.taskKey}/discovery/${slugifyRouteKey(skippedRoute.routeKey)}`,
      usedTaskKeys,
      index,
    );
    return [
      Object.freeze({
        taskKey,
        objective: `${input.intent.objective} — ${candidate.route.purpose}`,
        anchor: Object.freeze({ ...input.intent.anchor }),
        routeKeys: Object.freeze([candidate.route.routeKey]),
        estimatedCostTokens: skippedRoute.estimatedCostTokens,
        ...(skippedRoute.costMeasurement ? { costMeasurement: skippedRoute.costMeasurement } : {}),
        estimatedObjectCount: candidate.estimatedSize.objectCount,
        estimatedRelationCount: candidate.estimatedSize.relationCount,
      }),
    ];
  });

  if (children.length === 0) return undefined;
  return Object.freeze({
    parentTaskKey: input.intent.taskKey,
    reason,
    children: Object.freeze(children),
  });
}

function slugifyRouteKey(routeKey: string): string {
  return routeKey.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'route';
}

type HardStopReason =
  | 'budget-exhausted'
  | 'route-expansion-limit'
  | 'object-limit'
  | 'relation-limit';

function isHardSkipReason(reason: SkippedDiscoveryRoute['reason']): reason is HardStopReason {
  return (
    reason === 'budget-exhausted' ||
    reason === 'route-expansion-limit' ||
    reason === 'object-limit' ||
    reason === 'relation-limit'
  );
}

function isHardSkippedRoute(
  route: SkippedDiscoveryRoute,
): route is SkippedDiscoveryRoute & { readonly reason: HardStopReason } {
  return isHardSkipReason(route.reason);
}

function selectHardStopReason(
  skippedRoutes: readonly SkippedDiscoveryRoute[],
): HardStopReason | undefined {
  const reasons = new Set(skippedRoutes.map((route) => route.reason));
  const precedence: readonly HardStopReason[] = [
    'budget-exhausted',
    'route-expansion-limit',
    'object-limit',
    'relation-limit',
  ];
  return precedence.find((reason) => reasons.has(reason));
}

function createSkippedRoute(
  projection: DiscoveryRouteProjection,
  reason: SkippedDiscoveryRoute['reason'],
): SkippedDiscoveryRoute {
  return Object.freeze({
    routeKey: projection.routeKey,
    reason,
    estimatedCostTokens: projection.estimatedCostTokens,
    ...(projection.costMeasurement ? { costMeasurement: projection.costMeasurement } : {}),
  });
}

function addProgress(left: StopProgress, right: StopProgress): StopProgress {
  return {
    newRoutes: left.newRoutes + right.newRoutes,
    newFacts: left.newFacts + right.newFacts,
    newEvidenceRefs: left.newEvidenceRefs + right.newEvidenceRefs,
  };
}

function countCandidateTokens(
  candidate: DiscoveryCandidate,
  tokenCounter: ContextTokenCounter,
): number {
  const context: ContextTokenCountContext = {
    phase: 'discovery',
    routeKey: candidate.route.routeKey,
  };
  const tokens = tokenCounter.count(toDiscoveryTokenInput(candidate), context);
  if (!Number.isInteger(tokens) || tokens < 0) {
    throw new ContextRuntimeError(
      'invalid-discovery-plan',
      'Discovery token counter returned an invalid token count',
      [
        {
          code: 'discovery-token-count-invalid',
          path: `candidates.${candidate.route.routeKey}.estimatedCostTokens`,
          message: 'tokenCounter.count must return a non-negative integer',
        },
      ],
    );
  }
  return tokens;
}

/**
 * Canonical, provider-neutral candidate shape used for optional pre-selection
 * token measurement. The legacy route estimate is intentionally excluded so
 * a provider counter cannot count an estimate as if it were materialized data.
 */
export function toDiscoveryTokenInput(
  candidate: DiscoveryCandidate,
): Readonly<Record<string, unknown>> {
  const route = candidate.route;
  return Object.freeze({
    route: Object.freeze({
      kind: route.kind,
      routeKey: route.routeKey,
      purpose: route.purpose,
      fromAnchor: route.fromAnchor,
      relationPath: Object.freeze([...route.relationPath]),
      bounds: Object.freeze({ ...route.bounds }),
      ...(route.kind === 'discovery'
        ? { representation: route.representation }
        : {
            requiredFactKeys: Object.freeze([...route.requiredFactKeys]),
            authority: Object.freeze({ ...route.authority }),
            ...(route.freshness ? { freshness: Object.freeze({ ...route.freshness }) } : {}),
          }),
    }),
    priority: candidate.priority,
    estimatedSize: Object.freeze({ ...candidate.estimatedSize }),
    ...(candidate.sourceRef ? { sourceRef: candidate.sourceRef } : {}),
  });
}

function uniqueDecompositionTaskKey(base: string, used: Set<string>, index: number): string {
  let taskKey = base;
  if (used.has(taskKey)) taskKey = `${base}-${index + 1}`;
  used.add(taskKey);
  return taskKey;
}

function validatePlanInput(input: DiscoveryPlanInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.intent.taskKey.trim()) {
    issues.push({
      code: 'task-key-empty',
      path: 'intent.taskKey',
      message: 'intent.taskKey is required',
    });
  }
  if (!input.intent.objective.trim()) {
    issues.push({
      code: 'task-objective-empty',
      path: 'intent.objective',
      message: 'intent.objective is required',
    });
  }
  if (!input.intent.anchor.anchorKey.trim()) {
    issues.push({
      code: 'task-anchor-empty',
      path: 'intent.anchor.anchorKey',
      message: 'intent.anchor.anchorKey is required',
    });
  }
  if (!Number.isInteger(input.usedTokens) || input.usedTokens < 0) {
    issues.push({
      code: 'discovery-used-tokens-invalid',
      path: 'usedTokens',
      message: 'usedTokens must be a non-negative integer',
    });
  }

  input.candidates.forEach((candidate, index) => {
    if (candidate.route.fromAnchor !== input.intent.anchor.anchorKey) {
      issues.push({
        code: 'route-anchor-mismatch',
        path: `candidates[${index}].route.fromAnchor`,
        message: `Route ${candidate.route.routeKey} does not start at ${input.intent.anchor.anchorKey}`,
      });
    }
  });

  return issues;
}

function validateCandidate(candidate: DiscoveryCandidate): ValidationIssue[] {
  const routeResult = validateRoute(candidate.route);
  const issues = routeResult.issues.map((issue) => ({
    ...issue,
    path: `route.${issue.path}`,
  }));
  if (!Number.isInteger(candidate.priority) || candidate.priority < 0) {
    issues.push({
      code: 'candidate-priority-invalid',
      path: 'priority',
      message: 'priority must be a non-negative integer',
    });
  }
  issues.push(...validateEstimatedSize(candidate.estimatedSize));
  return issues;
}

function validateEstimatedSize(size: EstimatedRouteSize): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const field of ['objectCount', 'relationCount'] as const) {
    if (!Number.isInteger(size[field]) || size[field] < 0) {
      issues.push({
        code: 'candidate-size-invalid',
        path: `estimatedSize.${field}`,
        message: `${field} must be a non-negative integer`,
      });
    }
  }
  return issues;
}

function compareCandidates(
  left: {
    readonly candidate: DiscoveryCandidate;
    readonly projection: DiscoveryRouteProjection;
    readonly index: number;
  },
  right: {
    readonly candidate: DiscoveryCandidate;
    readonly projection: DiscoveryRouteProjection;
    readonly index: number;
  },
): number {
  const priority = right.projection.priority - left.projection.priority;
  if (priority !== 0) return priority;

  const cost = left.projection.estimatedCostTokens - right.projection.estimatedCostTokens;
  if (cost !== 0) return cost;

  const leftKey = left.projection.routeKey;
  const rightKey = right.projection.routeKey;
  if (leftKey < rightKey) return -1;
  if (leftKey > rightKey) return 1;
  return left.index - right.index;
}
