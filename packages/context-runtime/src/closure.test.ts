import { describe, expect, it } from 'vitest';
import { validateWorkingClosure } from './closure.js';
import type { RequiredFact, ResolutionRoute, ResolvedFact } from './types.js';

const route: ResolutionRoute = {
  kind: 'resolution',
  routeKey: 'order.inventory.status',
  purpose: 'Resolve inventory status for order release',
  fromAnchor: 'order',
  relationPath: ['contains_line', 'inventory_position', 'status'],
  bounds: {
    maxDepth: 3,
    maxFanOut: 20,
    maxItems: 100,
    cyclePolicy: 'reject',
  },
  estimatedCostTokens: 420,
  requiredFactKeys: ['inventory.status'],
  authority: { minimum: 'authoritative' },
  freshness: { maxAgeMs: 5_000 },
};

const requirement: RequiredFact = {
  factKey: 'inventory.status',
  resolutionRouteKey: route.routeKey,
  requiredFor: ['working'],
  authority: { minimum: 'authoritative' },
  freshness: { maxAgeMs: 5_000 },
};

function fact(overrides: Partial<ResolvedFact> = {}): ResolvedFact {
  return {
    factKey: 'inventory.status',
    resolutionRouteKey: route.routeKey,
    value: 'available',
    authority: 'authoritative',
    observedAt: '2026-07-23T00:00:00.000Z',
    revision: 'inventory:42',
    evidenceRefs: ['evidence:inventory:42'],
    ...overrides,
  };
}

describe('context-runtime working closure', () => {
  it('[contract:context-runtime.working.resolve-authoritative-facts.v1] closes with authoritative fresh facts', () => {
    const result = validateWorkingClosure({
      requiredFacts: [requirement],
      resolutionRoutes: [route],
      resolvedFacts: [fact()],
      now: '2026-07-23T00:00:04.000Z',
    });

    expect(result.status).toBe('closed');
    expect(result.diagnostics).toEqual([]);
  });

  it('[contract:context-runtime.working.reject-missing-route.v1] blocks when the resolution route is missing', () => {
    const result = validateWorkingClosure({
      requiredFacts: [requirement],
      resolutionRoutes: [],
      resolvedFacts: [],
      now: '2026-07-23T00:00:04.000Z',
    });

    expect(result.status).toBe('blocked');
    expect(result.diagnostics[0]?.code).toBe('missing-resolution-route');
  });

  it('[contract:context-runtime.working.resolve-authoritative-facts.v1] blocks stale facts before execution', () => {
    const result = validateWorkingClosure({
      requiredFacts: [requirement],
      resolutionRoutes: [route],
      resolvedFacts: [fact()],
      now: '2026-07-23T00:00:06.000Z',
    });

    expect(result.status).toBe('blocked');
    expect(result.diagnostics[0]?.code).toBe('stale-fact');
  });

  it('[contract:context-runtime.working.resolve-authoritative-facts.v1] blocks facts without evidence', () => {
    const result = validateWorkingClosure({
      requiredFacts: [requirement],
      resolutionRoutes: [route],
      resolvedFacts: [fact({ evidenceRefs: [] })],
      now: '2026-07-23T00:00:04.000Z',
    });

    expect(result.status).toBe('blocked');
    expect(result.diagnostics[0]?.code).toBe('missing-evidence');
  });
});
