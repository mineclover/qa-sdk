import { describe, expect, it } from 'vitest';
import { createContextManifest } from './handoff.js';
import type { WorkingContext } from './types.js';

function workingContext(overrides: Partial<WorkingContext> = {}): WorkingContext {
  return {
    status: 'closed',
    taskKey: 'release-order',
    routeSelection: {
      selectedRouteKeys: ['order.inventory.status'],
      frozenAt: '2026-07-23T00:00:00.000Z',
      manifestDigest: 'sha256:route-selection',
    },
    facts: [
      {
        factKey: 'inventory.status',
        resolutionRouteKey: 'order.inventory.status',
        value: 'available',
        authority: 'authoritative',
        observedAt: '2026-07-23T00:00:01.000Z',
        revision: 'inventory:42',
        evidenceRefs: ['evidence:b', 'evidence:a'],
      },
    ],
    allowedOperations: ['release-order', 'inspect-order'],
    outputContract: {
      contractKey: 'order-release-result.v1',
      description: 'Order release decision',
      requiredFields: ['reason', 'decision'],
    },
    diagnostics: [],
    ...overrides,
  };
}

describe('context-runtime manifest', () => {
  it('[contract:context-runtime.manifest.deterministic.v1] creates the same canonical manifest for the same snapshot', () => {
    const first = createContextManifest({
      workingContext: workingContext(),
      snapshotRef: 'snapshot:orders:42',
    });
    const second = createContextManifest({
      workingContext: workingContext({
        allowedOperations: ['inspect-order', 'release-order'],
        facts: [
          {
            ...workingContext().facts[0],
            evidenceRefs: ['evidence:a', 'evidence:b'],
          },
        ],
        outputContract: {
          ...workingContext().outputContract,
          requiredFields: ['decision', 'reason'],
        },
      }),
      snapshotRef: 'snapshot:orders:42',
    });

    expect(second.canonicalJson).toBe(first.canonicalJson);
    expect(second.digest).toBe(first.digest);
  });

  it('[contract:context-runtime.manifest.deterministic.v1] keeps references and revisions while excluding Fact values', () => {
    const manifest = createContextManifest({
      workingContext: workingContext(),
      snapshotRef: 'snapshot:orders:42',
    });

    expect(manifest.factRefs).toEqual([
      {
        factKey: 'inventory.status',
        revision: 'inventory:42',
        evidenceRefs: ['evidence:a', 'evidence:b'],
      },
    ]);
    expect(manifest.canonicalJson).not.toContain('available');
    expect(manifest.canonicalJson).toContain('inventory:42');
  });

  it('[contract:context-runtime.manifest.deterministic.v1] refuses to manifest a blocked Working Context', () => {
    expect(() =>
      createContextManifest({
        workingContext: workingContext({ status: 'blocked' }),
        snapshotRef: 'snapshot:orders:42',
      }),
    ).toThrowError(expect.objectContaining({ code: 'invalid-context-manifest' }));
  });
});
