import { describe, expect, it } from 'vitest';
import {
  createDecisionHintAdapter,
  createDefinitionGraphDiscoveryAdapter,
  createFederatedResolutionAdapter,
  mapContextObservation,
} from './adapters.js';
import { createContextUsageLedger, createProviderUsageEvent } from './usage.js';
import type { DefinitionGraphRouteNode, DiscoveryRoute, ResolutionRoute } from './types.js';

const discoveryRoute: DiscoveryRoute = {
  kind: 'discovery',
  routeKey: 'order.definition-map',
  purpose: 'Discover order definition routes',
  fromAnchor: 'order',
  relationPath: ['definition', 'relations'],
  bounds: { maxDepth: 2, maxFanOut: 10, maxItems: 50, cyclePolicy: 'stop' },
  estimatedCostTokens: 300,
  representation: 'map',
};

const resolutionRoute: ResolutionRoute = {
  kind: 'resolution',
  routeKey: 'order.inventory.status',
  purpose: 'Resolve inventory status',
  fromAnchor: 'order',
  relationPath: ['inventory', 'status'],
  bounds: { maxDepth: 2, maxFanOut: 10, maxItems: 50, cyclePolicy: 'reject' },
  estimatedCostTokens: 500,
  requiredFactKeys: ['inventory.status'],
  authority: { minimum: 'authoritative' },
};

describe('context-runtime boundary adapters', () => {
  it('[contract:context-runtime.adapters.definition-discovery.v1] maps definition graph route nodes into Discovery candidates', () => {
    const nodes: DefinitionGraphRouteNode[] = [
      {
        route: discoveryRoute,
        priority: 10,
        estimatedSize: { objectCount: 5, relationCount: 4 },
        sourceRef: 'definition:order-release',
      },
    ];
    const adapter = createDefinitionGraphDiscoveryAdapter({ listRoutes: () => nodes });

    expect(
      adapter.discover({
        taskKey: 'release-order',
        anchor: { anchorKey: 'order', ref: 'order:v1:42', kind: 'entity' },
      }),
    ).toEqual([
      {
        route: discoveryRoute,
        priority: 10,
        estimatedSize: { objectCount: 5, relationCount: 4 },
        sourceRef: 'definition:order-release',
      },
    ]);
  });

  it('[contract:context-runtime.adapters.federated-resolution.v1] maps federation records into Resolution Facts and filters undeclared facts', () => {
    const adapter = createFederatedResolutionAdapter({
      resolve: () => [
        {
          factKey: 'inventory.status',
          value: 'available',
          authority: 'authoritative',
          observedAt: '2026-07-23T00:00:00.000Z',
          revision: 'inventory:42',
          evidenceRefs: ['evidence:inventory:42'],
        },
        {
          factKey: 'inventory.secret',
          value: 'hidden',
          authority: 'authoritative',
          observedAt: '2026-07-23T00:00:00.000Z',
          revision: 'inventory:42',
          evidenceRefs: ['evidence:inventory:42'],
        },
      ],
    });

    expect(
      adapter.resolve({
        taskKey: 'release-order',
        snapshotRef: 'snapshot:orders:42',
        route: resolutionRoute,
        requiredFactKeys: ['inventory.status'],
      }),
    ).toEqual([
      {
        factKey: 'inventory.status',
        resolutionRouteKey: resolutionRoute.routeKey,
        value: 'available',
        authority: 'authoritative',
        observedAt: '2026-07-23T00:00:00.000Z',
        revision: 'inventory:42',
        evidenceRefs: ['evidence:inventory:42'],
      },
    ]);
  });

  it('[contract:context-runtime.adapters.decision-hints.v1] projects decision-flow hints as optional provenance-bearing hints', () => {
    const adapter = createDecisionHintAdapter({
      listHints: () => [
        { hintKey: 'z-last', summary: 'Later hint', sourceRevision: 'decision:2' },
        {
          hintKey: 'a-first',
          summary: 'Earlier hint',
          sourceRevision: 'decision:1',
          confidence: 0.8,
        },
      ],
    });

    expect(
      adapter.getHints({
        taskKey: 'release-order',
        anchor: { anchorKey: 'order', ref: 'order:v1:42', kind: 'entity' },
      }),
    ).toEqual([
      {
        hintKey: 'a-first',
        summary: 'Earlier hint',
        sourceRevision: 'decision:1',
        confidence: 0.8,
        provenance: 'decision-flow',
      },
      {
        hintKey: 'z-last',
        summary: 'Later hint',
        sourceRevision: 'decision:2',
        provenance: 'decision-flow',
      },
    ]);
  });

  it('[contract:context-runtime.observation.event-mapping.v1] maps observation metadata separately from Fact values', () => {
    const record = mapContextObservation({
      taskKey: 'release-order',
      stage: 'working',
      status: 'closed',
      routeKeys: ['order.z', 'order.a', 'order.z'],
      factKeys: ['inventory.status', 'inventory.status'],
      manifestDigest: 'fnv1a64:manifest',
      addressContext: { decision_path: 'decision_path:v1:7' },
    });

    expect(record).toEqual({
      eventName: 'context_runtime_observation',
      taskKey: 'release-order',
      stage: 'working',
      status: 'closed',
      routeKeys: ['order.a', 'order.z'],
      factCount: 1,
      manifestDigest: 'fnv1a64:manifest',
      addressContext: { decision_path: 'decision_path:v1:7' },
    });
    expect(record).not.toHaveProperty('facts');
    expect(JSON.stringify(record)).not.toContain('inventory.status');
  });

  it('[contract:context-runtime.usage.ledger.v1] keeps usage metadata free of Fact values when attached to observation', () => {
    const record = mapContextObservation({
      taskKey: 'release-order',
      stage: 'working',
      status: 'closed',
      routeKeys: ['order.inventory.status'],
      factKeys: ['inventory.status'],
      usage: {
        events: [
          { phase: 'discovery', tokens: 10, measurement: 'estimated', routeKey: 'order.map' },
          {
            phase: 'working',
            tokens: 20,
            measurement: 'measured',
            routeKey: 'order.inventory.status',
          },
        ],
        discoveryTokens: 10,
        workingTokens: 20,
        totalTokens: 30,
        measurement: 'mixed',
      },
    });

    expect(record.usage).toMatchObject({
      discoveryTokens: 10,
      workingTokens: 20,
      totalTokens: 30,
      measurement: 'mixed',
    });
    expect(JSON.stringify(record)).not.toContain('available');
  });

  it('[contract:context-runtime.usage.ledger.v1] rejects malformed usage metadata at the observation boundary', () => {
    expect(() =>
      mapContextObservation({
        taskKey: 'release-order',
        stage: 'working',
        status: 'closed',
        routeKeys: [],
        factKeys: [],
        usage: {
          events: [
            {
              phase: 'verification' as 'discovery',
              tokens: 1,
              measurement: 'measured',
              sourceRef: ' ',
            },
          ],
          discoveryTokens: 0,
          workingTokens: 0,
          totalTokens: 0,
          measurement: 'mixed',
        },
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid-context-adapter' }));
  });

  it('[contract:context-runtime.usage.provider-adapter.v1] retains bytes and latency in observation metadata', () => {
    const usage = createContextUsageLedger([
      createProviderUsageEvent({
        provider: 'generic',
        phase: 'discovery',
        totalTokens: 4,
        bytes: 128,
        latencyMs: 3,
      }),
    ]).snapshot();
    const record = mapContextObservation({
      taskKey: 'release-order',
      stage: 'discovery',
      status: 'discovery-capped',
      routeKeys: [],
      factKeys: [],
      usage,
    });

    expect(record.usage?.metrics).toEqual({
      bytes: 128,
      latencyMs: 3,
      measurement: 'measured',
    });
  });
});
