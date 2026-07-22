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
    const candidates = [
      discoveryCandidate('order.customer', 500, 5),
      resolutionCandidate(),
    ];

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
    expect(first.selectedRouteKeys).toEqual([
      'order.inventory.status',
      'order.customer',
    ]);
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

    expect(result.selectedRouteKeys).toEqual([
      'order.beta',
      'order.alpha',
      'order.zeta',
    ]);
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

  it('[contract:context-runtime.discovery.plan-routes.v1] projects discovery authority separately from resolution authority', () => {
    const projection = projectDiscoveryCandidate(
      discoveryCandidate('order.customer', 100, 1),
    );

    expect(projection.authority).toBe('projection_allowed');
    expect(projection.freshness).toBeUndefined();
  });
});
