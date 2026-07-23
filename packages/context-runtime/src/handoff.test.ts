import { describe, expect, it } from 'vitest';
import { aggregateTaskHandoffs, createContextManifest, createTaskHandoff } from './handoff.js';
import type { DiscoveryTaskDecomposition, TaskHandoff, WorkingContext } from './types.js';

const context: WorkingContext = {
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
      evidenceRefs: ['evidence:inventory:42'],
    },
  ],
  allowedOperations: ['release-order'],
  outputContract: {
    contractKey: 'order-release-result.v1',
    description: 'Order release decision',
    requiredFields: ['decision'],
  },
  diagnostics: [],
};

function createChildHandoff(
  taskKey: string,
  factKey: string,
  revision: string,
  evidenceRefs: readonly string[],
): TaskHandoff {
  const childContext: WorkingContext = {
    ...context,
    taskKey,
    facts: [
      {
        ...context.facts[0]!,
        factKey,
        revision,
        evidenceRefs,
      },
    ],
  };
  const manifest = createContextManifest({
    workingContext: childContext,
    snapshotRef: `snapshot:${taskKey}`,
  });
  return createTaskHandoff({
    workingContext: childContext,
    manifest,
    sourceRevision: `source:${taskKey}`,
    resultRevision: `result:${taskKey}`,
    unresolvedQuestions: [`question:${taskKey}`],
  });
}

const decomposition: DiscoveryTaskDecomposition = {
  parentTaskKey: 'release-order',
  reason: 'mixed-cap',
  children: [
    {
      taskKey: 'release-order/discovery/one',
      objective: 'Inspect one',
      anchor: { anchorKey: 'order:42', ref: 'order:42', kind: 'entity' },
      routeKeys: ['route.one'],
      estimatedCostTokens: 10,
      estimatedObjectCount: 1,
      estimatedRelationCount: 1,
    },
    {
      taskKey: 'release-order/discovery/two',
      objective: 'Inspect two',
      anchor: { anchorKey: 'order:42', ref: 'order:42', kind: 'entity' },
      routeKeys: ['route.two'],
      estimatedCostTokens: 10,
      estimatedObjectCount: 1,
      estimatedRelationCount: 1,
    },
  ],
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

    expect(() =>
      createTaskHandoff({
        workingContext: context,
        manifest,
        sourceRevision: 'order:42',
        resultRevision: 'decision:7',
        unresolvedQuestions: [],
      }),
    ).toThrowError(expect.objectContaining({ code: 'invalid-task-handoff' }));
  });

  it('[contract:context-runtime.handoff.aggregate.v1] merges completed child references deterministically', () => {
    const firstChild = createChildHandoff(
      decomposition.children[0]!.taskKey,
      'order.status',
      'order:42',
      ['evidence:order:42'],
    );
    const secondChild = createChildHandoff(
      decomposition.children[1]!.taskKey,
      'order.status',
      'order:42',
      ['evidence:order:42', 'evidence:inventory:42'],
    );

    const input = {
      decomposition,
      childHandoffs: [firstChild, secondChild],
      sourceRevision: 'parent-source:42',
      resultRevision: 'parent-result:7',
      unresolvedQuestions: ['parent-question', 'question:release-order/discovery/one'],
    } as const;
    const handoff = aggregateTaskHandoffs(input);
    const reordered = aggregateTaskHandoffs({
      ...input,
      childHandoffs: [secondChild, firstChild],
    });

    expect(handoff).toEqual(reordered);
    expect(handoff).toMatchObject({
      taskKey: 'release-order',
      sourceRevision: 'parent-source:42',
      resultRevision: 'parent-result:7',
      childTaskKeys: decomposition.children.map((child) => child.taskKey),
      factRefs: [
        {
          factKey: 'order.status',
          revision: 'order:42',
          evidenceRefs: ['evidence:inventory:42', 'evidence:order:42'],
        },
      ],
      evidenceRefs: ['evidence:inventory:42', 'evidence:order:42'],
      unresolvedQuestions: [
        'parent-question',
        'question:release-order/discovery/one',
        'question:release-order/discovery/two',
      ],
    });
    expect(JSON.stringify(handoff)).not.toContain('available');
  });

  it('[contract:context-runtime.handoff.aggregate.v1] fails closed for missing child Handoffs', () => {
    const firstChild = createChildHandoff(
      decomposition.children[0]!.taskKey,
      'order.status',
      'order:42',
      ['evidence:order:42'],
    );

    expect(() =>
      aggregateTaskHandoffs({
        decomposition,
        childHandoffs: [firstChild],
        sourceRevision: 'parent-source:42',
        resultRevision: 'parent-result:7',
        unresolvedQuestions: [],
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-task-handoff',
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'handoff-child-count-mismatch' }),
          expect.objectContaining({ code: 'handoff-child-task-missing' }),
        ]),
      }),
    );
  });

  it('[contract:context-runtime.handoff.aggregate.v1] rejects conflicting Fact revisions', () => {
    const firstChild = createChildHandoff(
      decomposition.children[0]!.taskKey,
      'order.status',
      'order:42',
      ['evidence:order:42'],
    );
    const secondChild = createChildHandoff(
      decomposition.children[1]!.taskKey,
      'order.status',
      'order:43',
      ['evidence:order:43'],
    );

    expect(() =>
      aggregateTaskHandoffs({
        decomposition,
        childHandoffs: [firstChild, secondChild],
        sourceRevision: 'parent-source:42',
        resultRevision: 'parent-result:7',
        unresolvedQuestions: [],
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-task-handoff',
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'handoff-fact-revision-conflict' }),
        ]),
      }),
    );
  });

  it('[contract:context-runtime.handoff.aggregate.v1] rejects extra or duplicate child Handoffs', () => {
    const firstChild = createChildHandoff(
      decomposition.children[0]!.taskKey,
      'order.status',
      'order:42',
      ['evidence:order:42'],
    );
    const secondChild = createChildHandoff(
      decomposition.children[1]!.taskKey,
      'inventory.status',
      'inventory:42',
      ['evidence:inventory:42'],
    );

    expect(() =>
      aggregateTaskHandoffs({
        decomposition,
        childHandoffs: [firstChild, secondChild, secondChild],
        sourceRevision: 'parent-source:42',
        resultRevision: 'parent-result:7',
        unresolvedQuestions: [],
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-task-handoff',
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'handoff-child-count-mismatch' }),
          expect.objectContaining({ code: 'handoff-child-task-key-duplicate' }),
        ]),
      }),
    );
  });
});
