import {
  ContextRuntimeError,
  type DiscoveryTaskDecomposition,
  type DiscoveryTaskExecutionOptions,
  type DiscoveryTaskExecutionRecord,
  type DiscoveryTaskExecutionResult,
  type DiscoveryTaskSlice,
} from './types.js';

/**
 * Execute cap-generated child Tasks in deterministic sequence.
 *
 * The executor owns orchestration only. A composition root supplies the child
 * callback that performs source/provider work, so context-runtime remains
 * independent of I/O and SDKs. Child tasks never share a mutable context.
 */
export async function executeDiscoveryTaskDecomposition<TResult>(
  decomposition: DiscoveryTaskDecomposition,
  executeChild: (task: DiscoveryTaskSlice) => TResult | Promise<TResult>,
  options: DiscoveryTaskExecutionOptions = {},
): Promise<DiscoveryTaskExecutionResult<TResult>> {
  validateDecomposition(decomposition);
  const continueOnError = options.continueOnError ?? true;
  const records: DiscoveryTaskExecutionRecord<TResult>[] = [];
  let failed = false;

  for (const task of decomposition.children) {
    if (failed && !continueOnError) {
      records.push(Object.freeze({ task, status: 'skipped' }));
      continue;
    }

    try {
      const result = await executeChild(task);
      records.push(Object.freeze({ task, status: 'completed', result }));
    } catch (error) {
      failed = true;
      records.push(
        Object.freeze({
          task,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  const completedCount = records.filter((record) => record.status === 'completed').length;
  const failedCount = records.filter((record) => record.status === 'failed').length;
  const status =
    failedCount === 0 && completedCount === decomposition.children.length
      ? 'completed'
      : completedCount > 0
        ? 'partial'
        : 'failed';

  return Object.freeze({
    parentTaskKey: decomposition.parentTaskKey,
    status,
    children: Object.freeze(records),
  });
}

function validateDecomposition(decomposition: DiscoveryTaskDecomposition): void {
  if (!decomposition.parentTaskKey.trim()) {
    throw new ContextRuntimeError(
      'invalid-discovery-plan',
      'Discovery task decomposition parentTaskKey is required',
      [
        {
          code: 'decomposition-parent-task-key-empty',
          path: 'parentTaskKey',
          message: 'parentTaskKey is required',
        },
      ],
    );
  }
  if (decomposition.children.length === 0) {
    throw new ContextRuntimeError(
      'invalid-discovery-plan',
      'Discovery task decomposition requires at least one child',
      [
        {
          code: 'decomposition-children-empty',
          path: 'children',
          message: 'children must not be empty',
        },
      ],
    );
  }
  const taskKeys = new Set<string>();
  for (const [index, task] of decomposition.children.entries()) {
    if (!task.taskKey.trim()) {
      throw new ContextRuntimeError(
        'invalid-discovery-plan',
        'Discovery task decomposition child taskKey is required',
        [
          {
            code: 'decomposition-child-task-key-empty',
            path: `children[${index}].taskKey`,
            message: 'child taskKey is required',
          },
        ],
      );
    }
    if (taskKeys.has(task.taskKey)) {
      throw new ContextRuntimeError(
        'invalid-discovery-plan',
        'Discovery task decomposition child taskKeys must be unique',
        [
          {
            code: 'decomposition-child-task-key-duplicate',
            path: `children[${index}].taskKey`,
            message: `duplicate child taskKey: ${task.taskKey}`,
          },
        ],
      );
    }
    taskKeys.add(task.taskKey);
    if (task.routeKeys.length === 0 || task.routeKeys.some((routeKey) => !routeKey.trim())) {
      throw new ContextRuntimeError(
        'invalid-discovery-plan',
        'Discovery task decomposition child must name at least one route',
        [
          {
            code: 'decomposition-child-routes-invalid',
            path: `children[${index}].routeKeys`,
            message: 'child routeKeys must contain non-empty values',
          },
        ],
      );
    }
  }
}
