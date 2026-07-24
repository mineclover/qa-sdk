import { describe, expect, it } from 'vitest';
import { createContextBudgetProfile } from './budget.js';
import { planDiscovery, projectDiscoveryCandidate } from './discovery.js';
import type {
  ContextAnchor,
  DiscoveryCandidate,
  DiscoveryRoute,
  ResolutionRoute,
  TaskIntent,
} from './types.js';

const anchor: ContextAnchor = {
  anchorKey: 'order',
  ref: 'order:v1:42',
  kind: 'entity',
};

const intent: TaskIntent = {
  taskKey: 'release-order',
  objective: 'Determine whether the order can be released',
  anchor,
};

function discoveryCandidate(
  routeKey: string,
  estimatedCostTokens: number,
  priority: number,
  estimatedSize = { objectCount: 4, relationCount: 3 },
): DiscoveryCandidate {
  const route: DiscoveryRoute = {
    kind: 'discovery',
    routeKey,
    purpose: `Discover ${routeKey}`,
    fromAnchor: anchor.anchorKey,
    relationPath: ['contains', routeKey],
    bounds: {
      maxDepth: 2,
      maxFanOut: 10,
      maxItems: 50,
      cyclePolicy: 'stop',
    },
    estimatedCostTokens,
    representation: 'summary',
  };
  return { route, priority, estimatedSize };
}

function resolutionCandidate(): DiscoveryCandidate {
  const route: ResolutionRoute = {
    kind: 'resolution',
    routeKey: 'order.inventory.status',
    purpose: 'Resolve authoritative inventory status',
    fromAnchor: anchor.anchorKey,
    relationPath: ['contains', 'inventory', 'status'],
    bounds: {
      maxDepth: 3,
      maxFanOut: 10,
      maxItems: 50,
      cyclePolicy: 'reject',
    },
    estimatedCostTokens: 800,
    requiredFactKeys: ['inventory.status'],
    authority: { minimum: 'authoritative' },
    freshness: { maxAgeMs: 5_000 },
  };
  return {
    route,
    priority: 20,
    estimatedSize: { objectCount: 1, relationCount: 3 },
  };
}

describe('context-runtime discovery planner', () => {
  it('[contract:context-runtime.discovery.plan-routes.v1] produces deterministic route projections', () => {
    const candidates = [discoveryCandidate('order.customer', 500, 5), resolutionCandidate()];

    const first = planDiscovery({
      intent,
      candidates,
      budget: createContextBudgetProfile(),
      usedTokens: 0,
    });
    const second = planDiscovery({
      intent,
      candidates: [...candidates].reverse(),
      budget: createContextBudgetProfile(),
      usedTokens: 0,
    });

    expect(first).toEqual(second);
    expect(first.selectedRouteKeys).toEqual(['order.inventory.status', 'order.customer']);
    expect(first.projections[0]).toMatchObject({
      authority: 'authoritative',
      freshness: { maxAgeMs: 5_000 },
      estimatedSize: { objectCount: 1, relationCount: 3 },
    });
    expect(first.status).toBe('planned');
    expect(first.nextAction).toBe('freeze');
  });

  it('[contract:context-runtime.discovery.plan-routes.v1] orders equal-priority candidates by cost and route key', () => {
    const result = planDiscovery({
      intent,
      candidates: [
        discoveryCandidate('order.zeta', 300, 5),
        discoveryCandidate('order.alpha', 300, 5),
        discoveryCandidate('order.beta', 100, 5),
      ],
      budget: createContextBudgetProfile(),
      usedTokens: 0,
    });

    expect(result.selectedRouteKeys).toEqual(['order.beta', 'order.alpha', 'order.zeta']);
  });

  it('[contract:context-runtime.discovery.stop-at-cap.v1] reports capped candidates without silent eviction', () => {
    const result = planDiscovery({
      intent,
      candidates: [
        discoveryCandidate('order.primary', 70_000, 30),
        discoveryCandidate('order.secondary', 50_000, 20),
        discoveryCandidate('order.tertiary', 10_000, 10),
      ],
      budget: createContextBudgetProfile(),
      usedTokens: 0,
    });

    expect(result.status).toBe('discovery-capped');
    expect(result.selectedRouteKeys).toEqual(['order.primary', 'order.tertiary']);
    expect(result.skippedRoutes).toEqual([
      {
        routeKey: 'order.secondary',
        reason: 'budget-exhausted',
        estimatedCostTokens: 50_000,
      },
    ]);
    expect(result.workingReserveTokens).toBe(100_000);
    expect(result.projectedDiscoveryTokens).toBe(80_000);
    expect(result.remainingDiscoveryTokens).toBe(20_000);
  });

  it('[contract:context-runtime.discovery.stop-on-coverage.v1] records semantic coverage and does not select lower-priority routes', () => {
    const result = planDiscovery({
      intent,
      candidates: [
        discoveryCandidate('order.topic', 100, 20),
        discoveryCandidate('order.optional', 100, 10),
      ],
      budget: createContextBudgetProfile(),
      usedTokens: 0,
      stopPolicy: { obligations: [{ kind: 'route', key: 'order.topic' }] },
    });

    expect(result.status).toBe('planned');
    expect(result.selectedRouteKeys).toEqual(['order.topic']);
    expect(result.skippedRoutes).toEqual([
      expect.objectContaining({
        routeKey: 'order.optional',
        reason: 'coverage-satisfied',
      }),
    ]);
    expect(result.stopDecision).toMatchObject({
      reason: 'coverage-satisfied',
      action: 'freeze',
      unresolvedObligations: [],
    });
  });

  it('[contract:context-runtime.discovery.stop-on-no-progress.v1] stops route expansion after repeated empty progress', () => {
    const result = planDiscovery({
      intent,
      candidates: [
        discoveryCandidate('order.first', 100, 20),
        discoveryCandidate('order.second', 100, 10),
        discoveryCandidate('order.third', 100, 5),
      ],
      budget: createContextBudgetProfile(),
      usedTokens: 0,
      stopPolicy: {
        obligations: [{ kind: 'fact', key: 'order.status' }],
        noProgressLimit: 2,
      },
      progressByRoute: {
        'order.first': { newRoutes: 0, newFacts: 0, newEvidenceRefs: 0 },
        'order.second': { newRoutes: 0, newFacts: 0, newEvidenceRefs: 0 },
      },
    });

    expect(result.selectedRouteKeys).toEqual(['order.first', 'order.second']);
    expect(result.skippedRoutes[0]).toMatchObject({
      routeKey: 'order.third',
      reason: 'no-progress',
    });
    expect(result.stopDecision).toMatchObject({ reason: 'no-progress', action: 'block' });
  });

  it('[contract:context-runtime.stop.hard-cap-precedence.v1] reports an unresolved required route as a hard budget stop', () => {
    const result = planDiscovery({
      intent,
      candidates: [discoveryCandidate('order.topic', 100, 20)],
      budget: createContextBudgetProfile(),
      usedTokens: 100_000,
      stopPolicy: { obligations: [{ kind: 'route', key: 'order.topic' }] },
    });

    expect(result.stopDecision).toMatchObject({
      reason: 'budget-exhausted',
      action: 'block',
      unresolvedObligations: [{ kind: 'route', key: 'order.topic' }],
    });
  });

  it('[contract:context-runtime.discovery.stop-at-cap.v1] decomposes when the discovery cap is already exhausted', () => {
    const result = planDiscovery({
      intent,
      candidates: [discoveryCandidate('order.primary', 1, 10)],
      budget: createContextBudgetProfile(),
      usedTokens: 100_000,
    });

    expect(result.status).toBe('discovery-capped');
    expect(result.nextAction).toBe('decompose');
    expect(result.selectedRouteKeys).toEqual([]);
    expect(result.skippedRoutes[0]?.reason).toBe('budget-exhausted');
    expect(result.workingReserveTokens).toBe(100_000);
    expect(result.decomposition).toMatchObject({
      parentTaskKey: 'release-order',
      reason: 'budget-exhausted',
      children: [
        {
          taskKey: 'release-order/discovery/order-primary',
          routeKeys: ['order.primary'],
        },
      ],
    });
  });

  it('[contract:context-runtime.discovery.stop-at-cap.v1] preserves the cap when route expansion count is bounded', () => {
    const result = planDiscovery({
      intent,
      candidates: [
        discoveryCandidate('order.primary', 1, 20),
        discoveryCandidate('order.secondary', 1, 10),
      ],
      budget: createContextBudgetProfile({ maxRouteExpansions: 1 }),
      usedTokens: 0,
    });

    expect(result.selectedRouteKeys).toEqual(['order.primary']);
    expect(result.skippedRoutes[0]).toMatchObject({
      routeKey: 'order.secondary',
      reason: 'route-expansion-limit',
    });
  });

  it('[contract:context-runtime.discovery.size-bounded.v1] enforces the object cap with an explicit skip reason', () => {
    const result = planDiscovery({
      intent,
      candidates: [
        discoveryCandidate('order.primary', 100, 20, { objectCount: 3, relationCount: 1 }),
        discoveryCandidate('order.secondary', 100, 10, { objectCount: 2, relationCount: 1 }),
      ],
      budget: createContextBudgetProfile({ maxObjects: 4 }),
      usedTokens: 0,
    });

    expect(result.selectedRouteKeys).toEqual(['order.primary']);
    expect(result.skippedRoutes).toEqual([
      {
        routeKey: 'order.secondary',
        reason: 'object-limit',
        estimatedCostTokens: 100,
      },
    ]);
    expect(result.projectedObjectCount).toBe(3);
    expect(result.projectedRelationCount).toBe(1);
  });

  it('[contract:context-runtime.discovery.size-bounded.v1] enforces the relation cap with an explicit skip reason', () => {
    const result = planDiscovery({
      intent,
      candidates: [
        discoveryCandidate('order.primary', 100, 20, { objectCount: 1, relationCount: 3 }),
        discoveryCandidate('order.secondary', 100, 10, { objectCount: 1, relationCount: 2 }),
      ],
      budget: createContextBudgetProfile({ maxRelations: 4 }),
      usedTokens: 0,
    });

    expect(result.selectedRouteKeys).toEqual(['order.primary']);
    expect(result.skippedRoutes).toEqual([
      {
        routeKey: 'order.secondary',
        reason: 'relation-limit',
        estimatedCostTokens: 100,
      },
    ]);
    expect(result.projectedObjectCount).toBe(1);
    expect(result.projectedRelationCount).toBe(3);
  });

  it('[contract:context-runtime.usage.discovery-token-counter.v1] measures candidate cost before budget selection', () => {
    const measuredInputs: unknown[] = [];
    const measuredContexts: Array<{ phase: string; routeKey?: string; factKey?: string }> = [];
    const tokenCounter = {
      measurement: 'measured' as const,
      count(
        value: unknown,
        context?: { phase: string; routeKey?: string; factKey?: string },
      ): number {
        measuredInputs.push(value);
        if (context) measuredContexts.push(context);
        const routeKey = (value as { route?: { routeKey?: unknown } }).route?.routeKey;
        return routeKey === 'order.primary' ? 90_000 : 20_000;
      },
    };
    const result = planDiscovery({
      intent,
      candidates: [
        discoveryCandidate('order.primary', 1, 20),
        discoveryCandidate('order.secondary', 1, 10),
      ],
      budget: createContextBudgetProfile(),
      usedTokens: 0,
      tokenCounter,
    });

    expect(result.selectedRouteKeys).toEqual(['order.primary']);
    expect(result.projections[0]).toMatchObject({
      routeKey: 'order.primary',
      estimatedCostTokens: 90_000,
      costMeasurement: 'measured',
    });
    expect(result.skippedRoutes[0]).toMatchObject({
      routeKey: 'order.secondary',
      estimatedCostTokens: 20_000,
      costMeasurement: 'measured',
      reason: 'budget-exhausted',
    });
    expect(measuredInputs).toHaveLength(2);
    expect(measuredContexts).toEqual([
      { phase: 'discovery', routeKey: 'order.primary' },
      { phase: 'discovery', routeKey: 'order.secondary' },
    ]);
    expect(measuredInputs.every((value) => !('estimatedCostTokens' in (value as object)))).toBe(
      true,
    );

    expect(() =>
      planDiscovery({
        intent,
        candidates: [discoveryCandidate('order.invalid', 1, 1)],
        budget: createContextBudgetProfile(),
        usedTokens: 0,
        tokenCounter: { measurement: 'measured', count: () => -1 },
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid-discovery-plan' }));
  });

  it('[contract:context-runtime.discovery.plan-routes.v1] projects discovery authority separately from resolution authority', () => {
    const projection = projectDiscoveryCandidate(discoveryCandidate('order.customer', 100, 1));

    expect(projection.authority).toBe('projection_allowed');
    expect(projection.freshness).toBeUndefined();
  });
});
