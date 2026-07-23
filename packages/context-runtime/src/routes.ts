import {
  ContextRuntimeError,
  type AuthorityLevel,
  type ContextRoute,
  type DiscoveryRoute,
  type ResolutionRoute,
  type RouteBounds,
  type RouteSelection,
  type ValidationIssue,
  type ValidationResult,
} from './types.js';

const AUTHORITY_RANK: Record<AuthorityLevel, number> = {
  projection_allowed: 1,
  verified: 2,
  authoritative: 3,
};

export function validateRouteBounds(bounds: RouteBounds, path = 'bounds'): ValidationResult {
  const issues: ValidationIssue[] = [];
  const integerFields: readonly (keyof Omit<RouteBounds, 'cyclePolicy'>)[] = [
    'maxDepth',
    'maxFanOut',
    'maxItems',
  ];

  for (const field of integerFields) {
    const value = bounds[field];
    if (!Number.isInteger(value) || value < 1) {
      issues.push({
        code: 'route-bound-invalid',
        path: `${path}.${field}`,
        message: `${field} must be a positive integer`,
      });
    }
  }

  if (bounds.cyclePolicy !== 'reject' && bounds.cyclePolicy !== 'stop') {
    issues.push({
      code: 'cycle-policy-invalid',
      path: `${path}.cyclePolicy`,
      message: 'cyclePolicy must be reject or stop',
    });
  }

  return { valid: issues.length === 0, issues };
}

export function validateRoute(route: ContextRoute): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!route.routeKey.trim()) {
    issues.push({ code: 'route-key-empty', path: 'routeKey', message: 'routeKey is required' });
  }
  if (!route.purpose.trim()) {
    issues.push({ code: 'route-purpose-empty', path: 'purpose', message: 'purpose is required' });
  }
  if (!route.fromAnchor.trim()) {
    issues.push({
      code: 'route-anchor-empty',
      path: 'fromAnchor',
      message: 'fromAnchor is required',
    });
  }
  if (route.relationPath.length === 0) {
    issues.push({
      code: 'route-path-empty',
      path: 'relationPath',
      message: 'relationPath must contain at least one relation',
    });
  }
  if (!Number.isInteger(route.estimatedCostTokens) || route.estimatedCostTokens < 0) {
    issues.push({
      code: 'route-cost-invalid',
      path: 'estimatedCostTokens',
      message: 'estimatedCostTokens must be a non-negative integer',
    });
  }
  issues.push(...validateRouteBounds(route.bounds).issues);

  if (route.kind === 'resolution') {
    if (route.requiredFactKeys.length === 0) {
      issues.push({
        code: 'resolution-facts-empty',
        path: 'requiredFactKeys',
        message: 'ResolutionRoute must declare at least one required Fact',
      });
    }
    if (!route.authority || AUTHORITY_RANK[route.authority.minimum] === undefined) {
      issues.push({
        code: 'authority-requirement-invalid',
        path: 'authority.minimum',
        message: 'ResolutionRoute must declare a valid minimum authority',
      });
    }
    if (
      route.freshness &&
      (!Number.isInteger(route.freshness.maxAgeMs) || route.freshness.maxAgeMs < 0)
    ) {
      issues.push({
        code: 'freshness-requirement-invalid',
        path: 'freshness.maxAgeMs',
        message: 'freshness.maxAgeMs must be a non-negative integer',
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

export function validateRouteSet(routes: readonly ContextRoute[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  routes.forEach((route, index) => {
    const routeResult = validateRoute(route);
    issues.push(
      ...routeResult.issues.map((issue) => ({
        ...issue,
        path: `routes[${index}].${issue.path}`,
      })),
    );
    if (seen.has(route.routeKey)) {
      issues.push({
        code: 'route-key-duplicate',
        path: `routes[${index}].routeKey`,
        message: `routeKey ${route.routeKey} is declared more than once`,
      });
    }
    seen.add(route.routeKey);
  });

  return { valid: issues.length === 0, issues };
}

export function freezeRouteSelection(
  routes: readonly ContextRoute[],
  selectedRouteKeys: readonly string[],
  frozenAt: string,
  manifestDigest: string,
): RouteSelection {
  const routeMap = new Map(routes.map((route) => [route.routeKey, route]));
  const missing = selectedRouteKeys.filter((routeKey) => !routeMap.has(routeKey));
  if (missing.length > 0) {
    throw new ContextRuntimeError(
      'invalid-context-route',
      'Route selection contains unknown route keys',
      missing.map((routeKey) => ({
        code: 'route-selection-unknown',
        path: 'selectedRouteKeys',
        message: `Unknown route key: ${routeKey}`,
      })),
    );
  }
  if (!frozenAt.trim() || !manifestDigest.trim()) {
    throw new ContextRuntimeError(
      'invalid-context-route',
      'Frozen route selection requires timestamp and manifest digest',
    );
  }
  return Object.freeze({
    selectedRouteKeys: [...selectedRouteKeys],
    frozenAt,
    manifestDigest,
  });
}

export function isResolutionRoute(route: ContextRoute): route is ResolutionRoute {
  return route.kind === 'resolution';
}

export function isDiscoveryRoute(route: ContextRoute): route is DiscoveryRoute {
  return route.kind === 'discovery';
}
