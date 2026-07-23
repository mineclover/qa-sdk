import { describe, expect, it } from 'vitest';
import { executeAndAggregateTaskHandoffs } from './handoff.js';
import type { DiscoveryTaskDecomposition, TaskHandoff } from './types.js';

const decomposition: DiscoveryTaskDecomposition = {
  parentTaskKey: 'definition-context:parent',
  reason: 'budget-exhausted',
  children: [
    {
      taskKey: 'definition-context:parent/discovery/a',
      objective: 'Inspect route a',
      anchor: { anchorKey: 'definition:parent', ref: 'definition:parent', kind: 'entity' },
      routeKeys: ['route.a'],
      estimatedCostTokens: 10,
      estimatedObjectCount: 1,
      estimatedRelationCount: 1,
    },
    {
      taskKey: 'definition-context:parent/discovery/b',
      objective: 'Inspect route b',
      anchor: { anchorKey: 'definition:parent', ref: 'definition:parent', kind: 'entity' },
      routeKeys: ['route.b'],
      estimatedCostTokens: 10,
      estimatedObjectCount: 1,
      estimatedRelationCount: 1,
    },
  ],
};

function childHandoff(taskKey: string, index: number): TaskHandoff {
  return {
    version: 'v1',
    taskKey,
    sourceRevision: `source:${index}`,
    resultRevision: `result:${index}`,
    manifestDigest: `fnv1a64:child-${index}`,
    factRefs: [
      {
        factKey: `definition.fact.${index}`,
        revision: 'definition:42',
        evidenceRefs: [`definition:evidence:${index}`],
      },
    ],
    evidenceRefs: [`definition:evidence:${index}`],
    unresolvedQuestions: [`question:${index}`],
  };
}

describe('context-runtime handoff decomposition execution', () => {
  it('[contract:context-runtime.handoff.execution.v1] executes all children before creating a parent Handoff', async () => {
    const executionOrder: string[] = [];
    const result = await executeAndAggregateTaskHandoffs({
      decomposition,
      executeChild: async (task) => {
        executionOrder.push(task.taskKey);
        return childHandoff(task.taskKey, executionOrder.length - 1);
      },
      sourceRevision: 'parent-source:42',
      resultRevision: 'parent-result:7',
      unresolvedQuestions: [],
    });

    expect(result.execution.status).toBe('completed');
    expect(executionOrder).toEqual(decomposition.children.map((child) => child.taskKey));
    expect(result.handoff).toMatchObject({
      taskKey: decomposition.parentTaskKey,
      childTaskKeys: decomposition.children.map((child) => child.taskKey),
      resultRevision: 'parent-result:7',
    });
  });

  it('[contract:context-runtime.handoff.execution.v1] never creates a parent Handoff for partial child execution', async () => {
    const result = await executeAndAggregateTaskHandoffs({
      decomposition,
      executeChild: async (task) => {
        if (task.taskKey.endsWith('/b')) throw new Error('child unavailable');
        return childHandoff(task.taskKey, 0);
      },
      sourceRevision: 'parent-source:42',
      resultRevision: 'parent-result:7',
      unresolvedQuestions: [],
    });

    expect(result.execution.status).toBe('partial');
    expect(result.execution.children).toEqual([
      expect.objectContaining({ status: 'completed' }),
      expect.objectContaining({ status: 'failed', error: 'child unavailable' }),
    ]);
    expect(result.handoff).toBeUndefined();
  });
});
