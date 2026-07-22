import { describe, expect, it } from 'vitest';
import { createContextManifest, createTaskHandoff } from './handoff.js';
import type { WorkingContext } from './types.js';

const context: WorkingContext = {
  status: 'closed',
  taskKey: 'release-order',
  routeSelection: {
    selectedRouteKeys: ['order.inventory.status'],
    frozenAt: '2026-07-23T00:00:00.000Z',
    manifestDigest: 'sha256:route-selection',
  },
  facts: [{
    factKey: 'inventory.status',
    resolutionRouteKey: 'order.inventory.status',
    value: 'available',
    authority: 'authoritative',
    observedAt: '2026-07-23T00:00:01.000Z',
    revision: 'inventory:42',
    evidenceRefs: ['evidence:inventory:42'],
  }],
  allowedOperations: ['release-order'],
  outputContract: {
    contractKey: 'order-release-result.v1',
    description: 'Order release decision',
    requiredFields: ['decision'],
  },
  diagnostics: [],
};

describe('context-runtime handoff', () => {
  it('[contract:context-runtime.handoff.reference-only.v1] creates a reference-only task handoff', () => {
    const manifest = createContextManifest({
      workingContext: context,
      snapshotRef: 'snapshot:orders:42',
    });
    const handoff = createTaskHandoff({
      workingContext: context,
      manifest,
      sourceRevision: 'order:42',
      resultRevision: 'decision:7',
      unresolvedQuestions: ['Can the customer be notified?'],
      nextTask: {
        taskKey: 'notify-customer',
        objective: 'Notify the customer about the release decision',
      },
    });

    expect(handoff).toMatchObject({
      version: 'v1',
      taskKey: 'release-order',
      sourceRevision: 'order:42',
      resultRevision: 'decision:7',
      manifestDigest: manifest.digest,
      evidenceRefs: ['evidence:inventory:42'],
      nextTask: { taskKey: 'notify-customer' },
    });
    expect(handoff).not.toHaveProperty('conversationTranscript');
    expect(JSON.stringify(handoff)).not.toContain('available');
  });

  it('[contract:context-runtime.handoff.reference-only.v1] normalizes evidence and unresolved question references', () => {
    const manifest = createContextManifest({
      workingContext: context,
      snapshotRef: 'snapshot:orders:42',
    });
    const handoff = createTaskHandoff({
      workingContext: context,
      manifest,
      sourceRevision: 'order:42',
      resultRevision: 'decision:7',
      unresolvedQuestions: ['z', 'a', 'z'],
    });

    expect(handoff.unresolvedQuestions).toEqual(['a', 'z']);
    expect(handoff.evidenceRefs).toEqual(['evidence:inventory:42']);
  });

  it('[contract:context-runtime.handoff.reference-only.v1] rejects a handoff whose manifest belongs to another task', () => {
    const manifest = createContextManifest({
      workingContext: { ...context, taskKey: 'other-task' },
      snapshotRef: 'snapshot:orders:42',
    });

    expect(() => createTaskHandoff({
      workingContext: context,
      manifest,
      sourceRevision: 'order:42',
      resultRevision: 'decision:7',
      unresolvedQuestions: [],
    })).toThrowError(expect.objectContaining({ code: 'invalid-task-handoff' }));
  });
});
