import {
  assertValidContextBudgetProfile,
  availableDiscoveryTokens,
} from './budget.js';
import {
  ContextRuntimeError,
  type ContextRoute,
  type DiscoveryCandidate,
  type DiscoveryPlan,
  type DiscoveryPlanInput,
  type DiscoveryRouteProjection,
  type EstimatedRouteSize,
  type ValidationIssue,
} from './types.js';
import { validateRoute, validateRouteSet } from './routes.js';

export function projectDiscoveryCandidate(
  candidate: DiscoveryCandidate,
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
  const authority = route.kind === 'resolution'
    ? route.authority.minimum
    : 'projection_allowed';

  return Object.freeze({
    routeKey: route.routeKey,
    kind: route.kind,
    priority: candidate.priority,
    estimatedCostTokens: route.estimatedCostTokens,
    estimatedSize: Object.freeze({ ...candidate.estimatedSize }),
    authority,
    ...(route.kind === 'resolution' && route.freshness
      ? { freshness: Object.freeze({ ...route.freshness }) }
      : {}),
  });
}

export function planDiscovery(input: DiscoveryPlanInput): DiscoveryPlan {
  const budget = assertValidContextBudgetProfile(input.budget);
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

  const projections = input.candidates.map(projectDiscoveryCandidate);
  const candidates = input.candidates
    .map((candidate, index) => ({ candidate, projection: projections[index], index }))
    .sort(compareCandidates);
  const discoveryCapacity = availableDiscoveryTokens(budget);
  const remainingCapacity = Math.max(0, discoveryCapacity - input.usedTokens);
  const selectedRouteKeys: string[] = [];
  const selectedProjections: DiscoveryRouteProjection[] = [];
  const skippedRoutes: DiscoveryPlan['skippedRoutes'][number][] = [];
  let projectedCandidateTokens = 0;

  for (const { projection } of candidates) {
    if (
      budget.maxRouteExpansions !== undefined &&
      selectedRouteKeys.length >= budget.maxRouteExpansions
    ) {
      skippedRoutes.push(Object.freeze({
        routeKey: projection.routeKey,
        reason: 'route-expansion-limit',
        estimatedCostTokens: projection.estimatedCostTokens,
      }));
      continue;
    }

    if (projectedCandidateTokens + projection.estimatedCostTokens > remainingCapacity) {
      skippedRoutes.push(Object.freeze({
        routeKey: projection.routeKey,
        reason: 'budget-exhausted',
        estimatedCostTokens: projection.estimatedCostTokens,
      }));
      continue;
    }

    selectedRouteKeys.push(projection.routeKey);
    selectedProjections.push(projection);
    projectedCandidateTokens += projection.estimatedCostTokens;
  }

  const capped = skippedRoutes.length > 0;
  const projectedDiscoveryTokens = input.usedTokens + projectedCandidateTokens;
  const remainingDiscoveryTokens = Math.max(
    0,
    discoveryCapacity - projectedDiscoveryTokens,
  );

  return Object.freeze({
    status: capped ? 'discovery-capped' : 'planned',
    nextAction: capped && selectedRouteKeys.length === 0 ? 'decompose' : 'freeze',
    taskKey: input.intent.taskKey,
    anchorKey: input.intent.anchor.anchorKey,
    selectedRouteKeys: Object.freeze([...selectedRouteKeys]),
    projections: Object.freeze([...selectedProjections]),
    skippedRoutes: Object.freeze([...skippedRoutes]),
    usedTokens: input.usedTokens,
    projectedDiscoveryTokens,
    remainingDiscoveryTokens,
    workingReserveTokens: budget.workingReserveTokens,
  });
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
