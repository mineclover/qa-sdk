import { describe, expect, it } from 'vitest';
import { assertWorkingContext, compileWorkingContext } from './working-context.js';
import type {
  RequiredFact,
  ResolutionRoute,
  ResolvedFact,
  RouteSelection,
  WorkingContextCompileInput,
} from './types.js';

const route: ResolutionRoute = {
  kind: 'resolution',
  routeKey: 'order.inventory.status',
  purpose: 'Resolve authoritative inventory status',
  fromAnchor: 'order',
  relationPath: ['contains', 'inventory', 'status'],
  bounds: {
    maxDepth: 3,
    maxFanOut: 20,
    maxItems: 100,
    cyclePolicy: 'reject',
  },
  estimatedCostTokens: 500,
  requiredFactKeys: ['inventory.status'],
  authority: { minimum: 'authoritative' },
  freshness: { maxAgeMs: 5_000 },
};

const requiredFact: RequiredFact = {
  factKey: 'inventory.status',
  resolutionRouteKey: route.routeKey,
  requiredFor: ['working'],
  authority: { minimum: 'authoritative' },
  freshness: { maxAgeMs: 5_000 },
};

const routeSelection: RouteSelection = {
  selectedRouteKeys: [route.routeKey],
  frozenAt: '2026-07-23T00:00:00.000Z',
  manifestDigest: 'sha256:order-release',
};

function fact(overrides: Partial<ResolvedFact> = {}): ResolvedFact {
  return {
    factKey: requiredFact.factKey,
    resolutionRouteKey: route.routeKey,
    value: 'available',
    authority: 'authoritative',
    observedAt: '2026-07-23T00:00:01.000Z',
    revision: 'inventory:42',
    evidenceRefs: ['evidence:inventory:42'],
    ...overrides,
  };
}

function input(overrides: Partial<WorkingContextCompileInput> = {}): WorkingContextCompileInput {
  return {
    taskKey: 'release-order',
    routeSelection,
    routes: [route],
    requiredFacts: [requiredFact],
    resolvedFacts: [fact()],
    allowedOperations: ['release-order'],
    outputContract: {
      contractKey: 'order-release-result.v1',
      description: 'Order release decision result',
      requiredFields: ['decision', 'reason'],
    },
    now: '2026-07-23T00:00:04.000Z',
    ...overrides,
  };
}

describe('context-runtime working context compiler', () => {
  it('[contract:context-runtime.working.resolve-authoritative-facts.v1] compiles a closed envelope with facts, revisions, operations, and output contract', () => {
    const result = compileWorkingContext(input());

    expect(result.status).toBe('closed');
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]).toMatchObject({
      factKey: 'inventory.status',
      revision: 'inventory:42',
      evidenceRefs: ['evidence:inventory:42'],
    });
    expect(result.allowedOperations).toEqual(['release-order']);
    expect(result.outputContract).toMatchObject({
      contractKey: 'order-release-result.v1',
      requiredFields: ['decision', 'reason'],
    });
    expect(result.routeSelection.manifestDigest).toBe('sha256:order-release');
  });

  it('[contract:context-runtime.working.reject-missing-route.v1] blocks execution when the required route was not frozen', () => {
    const result = compileWorkingContext(input({ routeSelection: { ...routeSelection, selectedRouteKeys: [] } }));

    expect(result.status).toBe('blocked');
    expect(result.facts).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('route-not-selected');
  });

  it('[contract:context-runtime.working.reject-missing-route.v1] exposes the closure error code for blocked execution', () => {
    expect(() => assertWorkingContext(input({ resolvedFacts: [] }))).toThrowError(
      expect.objectContaining({ code: 'context-closure-incomplete' }),
    );
  });

  it('[contract:context-runtime.working.resolve-authoritative-facts.v1] excludes stale facts from the execution envelope', () => {
    const result = compileWorkingContext(input({
      resolvedFacts: [fact({ observedAt: '2026-07-22T23:00:00.000Z' })],
    }));

    expect(result.status).toBe('blocked');
    expect(result.facts).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('stale-fact');
  });

  it('[contract:context-runtime.working.resolve-authoritative-facts.v1] excludes unauthoritative facts from the execution envelope', () => {
    const result = compileWorkingContext(input({
      resolvedFacts: [fact({ authority: 'projection_allowed' })],
    }));

    expect(result.status).toBe('blocked');
    expect(result.facts).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('insufficient-authority');
  });
});
