import { describe, expect, it } from 'vitest';
import { freezeRouteSelection, validateRoute, validateRouteSet } from './routes.js';
import type { DiscoveryRoute, ResolutionRoute } from './types.js';

const bounds = {
  maxDepth: 2,
  maxFanOut: 5,
  maxItems: 20,
  cyclePolicy: 'stop' as const,
};

const discoveryRoute: DiscoveryRoute = {
  kind: 'discovery',
  routeKey: 'order.customer.map',
  purpose: 'Find customer-related context routes',
  fromAnchor: 'order',
  relationPath: ['placed_by'],
  bounds,
  estimatedCostTokens: 180,
  representation: 'map',
};

const resolutionRoute: ResolutionRoute = {
  kind: 'resolution',
  routeKey: 'order.customer.status',
  purpose: 'Resolve the authoritative customer status',
  fromAnchor: 'order',
  relationPath: ['placed_by', 'status'],
  bounds,
  estimatedCostTokens: 80,
  requiredFactKeys: ['customer.status'],
  authority: { minimum: 'authoritative' },
};

describe('context-runtime routes', () => {
  it('[contract:context-runtime.discovery-to-working.route-freeze.v1] distinguishes discovery from resolution routes', () => {
    expect(validateRoute(discoveryRoute).valid).toBe(true);
    expect(validateRoute(resolutionRoute).valid).toBe(true);
    expect(validateRouteSet([discoveryRoute, resolutionRoute]).valid).toBe(true);
  });

  it('[contract:context-runtime.discovery-to-working.route-freeze.v1] rejects unbounded routes', () => {
    const result = validateRoute({
      ...discoveryRoute,
      bounds: { ...bounds, maxDepth: 0 },
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('route-bound-invalid');
  });

  it('[contract:context-runtime.discovery-to-working.route-freeze.v1] freezes only declared route keys', () => {
    const selection = freezeRouteSelection(
      [discoveryRoute, resolutionRoute],
      ['order.customer.map', 'order.customer.status'],
      '2026-07-23T00:00:00.000Z',
      'sha256:route-manifest',
    );

    expect(selection.selectedRouteKeys).toEqual(['order.customer.map', 'order.customer.status']);
    expect(selection.manifestDigest).toBe('sha256:route-manifest');
  });
});
