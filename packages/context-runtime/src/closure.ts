import {
  ContextRuntimeError,
  type AuthorityLevel,
  type ClosureDiagnostic,
  type RequiredFact,
  type ResolutionRoute,
  type ResolvedFact,
  type WorkingClosureInput,
  type WorkingClosureResult,
} from './types.js';

const AUTHORITY_RANK: Record<AuthorityLevel, number> = {
  projection_allowed: 1,
  verified: 2,
  authoritative: 3,
};

export function validateWorkingClosure(input: WorkingClosureInput): WorkingClosureResult {
  const diagnostics: ClosureDiagnostic[] = [];
  const routes = new Map(input.resolutionRoutes.map((route) => [route.routeKey, route]));
  const facts = new Map(input.resolvedFacts.map((fact) => [fact.factKey, fact]));
  const now = parseTimestamp(input.now ?? new Date().toISOString());

  for (const requirement of input.requiredFacts) {
    const route = routes.get(requirement.resolutionRouteKey);
    if (!route) {
      diagnostics.push({
        code: 'missing-resolution-route',
        factKey: requirement.factKey,
        message: `No ResolutionRoute for required Fact ${requirement.factKey}`,
      });
      continue;
    }

    if (!route.requiredFactKeys.includes(requirement.factKey)) {
      diagnostics.push({
        code: 'route-fact-mismatch',
        factKey: requirement.factKey,
        message: `ResolutionRoute ${route.routeKey} does not declare ${requirement.factKey}`,
      });
    }

    const fact = facts.get(requirement.factKey);
    if (!fact) {
      diagnostics.push({
        code: 'missing-fact',
        factKey: requirement.factKey,
        message: `Required Fact ${requirement.factKey} was not resolved`,
      });
      continue;
    }

    validateResolvedFact(requirement, route, fact, now, diagnostics);
  }

  return {
    status: diagnostics.length === 0 ? 'closed' : 'blocked',
    diagnostics,
    resolvedFacts: input.resolvedFacts,
  };
}

export function assertWorkingClosure(input: WorkingClosureInput): WorkingClosureResult {
  const result = validateWorkingClosure(input);
  if (result.status === 'blocked') {
    throw new ContextRuntimeError(
      'context-closure-incomplete',
      'Working Context closure is incomplete',
      result.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        path: diagnostic.factKey,
        message: diagnostic.message,
      })),
    );
  }
  return result;
}

function validateResolvedFact(
  requirement: RequiredFact,
  route: ResolutionRoute,
  fact: ResolvedFact,
  now: number | undefined,
  diagnostics: ClosureDiagnostic[],
): void {
  if (fact.resolutionRouteKey !== route.routeKey) {
    diagnostics.push({
      code: 'route-fact-mismatch',
      factKey: requirement.factKey,
      message: `Resolved Fact ${fact.factKey} came from ${fact.resolutionRouteKey}, expected ${route.routeKey}`,
    });
  }

  const minimumAuthority = Math.max(
    AUTHORITY_RANK[requirement.authority.minimum],
    AUTHORITY_RANK[route.authority.minimum],
  );
  if (AUTHORITY_RANK[fact.authority] < minimumAuthority) {
    diagnostics.push({
      code: 'insufficient-authority',
      factKey: requirement.factKey,
      message: `Resolved Fact ${fact.factKey} does not meet the required authority`,
    });
  }

  if (!fact.revision.trim()) {
    diagnostics.push({
      code: 'invalid-fact-revision',
      factKey: requirement.factKey,
      message: `Resolved Fact ${fact.factKey} must preserve a revision`,
    });
  }
  if (fact.evidenceRefs.length === 0) {
    diagnostics.push({
      code: 'missing-evidence',
      factKey: requirement.factKey,
      message: `Resolved Fact ${fact.factKey} must preserve at least one evidence reference`,
    });
  }

  const freshness = requirement.freshness ?? route.freshness;
  if (freshness && isStale(fact.observedAt, freshness.maxAgeMs, now)) {
    diagnostics.push({
      code: 'stale-fact',
      factKey: requirement.factKey,
      message: `Resolved Fact ${fact.factKey} is older than its freshness requirement`,
    });
  }
}

function parseTimestamp(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function isStale(observedAt: string, maxAgeMs: number, now: number | undefined): boolean {
  const observed = parseTimestamp(observedAt);
  if (observed === undefined || now === undefined) return true;
  return now - observed > maxAgeMs;
}
