import { describe, expect, it } from 'vitest';
import { executeDiscoveryTaskDecomposition } from './decomposition.js';
import type { DiscoveryTaskDecomposition } from './types.js';

const decomposition: DiscoveryTaskDecomposition = {
  parentTaskKey: 'definition-context:root',
  reason: 'budget-exhausted',
  children: [
    {
      taskKey: 'definition-context:root/discovery/first',
      objective: 'Resolve first route',
      anchor: { anchorKey: 'definition:root', ref: 'root', kind: 'entity' },
      routeKeys: ['definition.first'],
      estimatedCostTokens: 10,
      estimatedObjectCount: 1,
      estimatedRelationCount: 1,
    },
    {
      taskKey: 'definition-context:root/discovery/second',
      objective: 'Resolve second route',
      anchor: { anchorKey: 'definition:root', ref: 'root', kind: 'entity' },
      routeKeys: ['definition.second'],
      estimatedCostTokens: 20,
      estimatedObjectCount: 1,
      estimatedRelationCount: 1,
    },
  ],
};

describe('context-runtime decomposition executor', () => {
  it('[contract:context-runtime.decomposition.executor.v1] executes child tasks sequentially and closes only when all complete', async () => {
    const order: string[] = [];
    const result = await executeDiscoveryTaskDecomposition(decomposition, async (task) => {
      order.push(`${task.taskKey}:start`);
      await Promise.resolve();
      order.push(`${task.taskKey}:end`);
      return task.routeKeys[0];
    });

    expect(order).toEqual([
      'definition-context:root/discovery/first:start',
      'definition-context:root/discovery/first:end',
      'definition-context:root/discovery/second:start',
      'definition-context:root/discovery/second:end',
    ]);
    expect(result).toMatchObject({
      parentTaskKey: decomposition.parentTaskKey,
      status: 'completed',
      children: [
        { status: 'completed', result: 'definition.first' },
        { status: 'completed', result: 'definition.second' },
      ],
    });
  });

  it('[contract:context-runtime.decomposition.executor.v1] records failures and never claims a partial parent as completed', async () => {
    const result = await executeDiscoveryTaskDecomposition(decomposition, async (task) => {
      if (task.routeKeys[0] === 'definition.first') throw new Error('source unavailable');
      return 'ok';
    });

    expect(result.status).toBe('partial');
    expect(result.children).toEqual([
      expect.objectContaining({ status: 'failed', error: 'source unavailable' }),
      expect.objectContaining({ status: 'completed', result: 'ok' }),
    ]);
  });

  it('[contract:context-runtime.decomposition.executor.v1] can stop after a failure and marks remaining tasks skipped', async () => {
    const result = await executeDiscoveryTaskDecomposition(
      decomposition,
      async () => {
        throw new Error('blocked');
      },
      { continueOnError: false },
    );

    expect(result.status).toBe('failed');
    expect(result.children).toEqual([
      expect.objectContaining({ status: 'failed' }),
      expect.objectContaining({ status: 'skipped' }),
    ]);
  });
});
