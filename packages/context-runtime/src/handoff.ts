import {
  ContextRuntimeError,
  type ContextManifest,
  type ContextManifestInput,
  type DiscoveryTaskDecomposition,
  type DiscoveryTaskSlice,
  type ManifestFactRef,
  type OutputContract,
  type TaskHandoff,
  type TaskHandoffAggregationInput,
  type TaskHandoffDecompositionExecutionOptions,
  type TaskHandoffDecompositionExecutionResult,
  type TaskHandoffInput,
  type ValidationIssue,
} from './types.js';
import { executeDiscoveryTaskDecomposition } from './decomposition.js';

export function createContextManifest(input: ContextManifestInput): ContextManifest {
  const issues = validateManifestInput(input);
  if (issues.length > 0) {
    throw new ContextRuntimeError(
      'invalid-context-manifest',
      'Context Manifest input is invalid',
      issues,
    );
  }

  const factRefs = toFactRefs(input.workingContext.facts);
  const payload = {
    version: 'v1' as const,
    taskKey: input.workingContext.taskKey,
    snapshotRef: input.snapshotRef,
    selectedRouteKeys: [...input.workingContext.routeSelection.selectedRouteKeys],
    routeManifestDigest: input.workingContext.routeSelection.manifestDigest,
    factRefs,
    allowedOperations: sortUnique(input.workingContext.allowedOperations),
    outputContract: canonicalOutputContract(input.workingContext.outputContract),
  };
  const canonicalJson = canonicalize(payload);
  const digest = stableDigest(canonicalJson);

  return Object.freeze({
    ...payload,
    selectedRouteKeys: Object.freeze([...payload.selectedRouteKeys]),
    factRefs: Object.freeze(factRefs),
    allowedOperations: Object.freeze([...payload.allowedOperations]),
    outputContract: freezeOutputContract(payload.outputContract),
    canonicalJson,
    digest,
  });
}

export function createTaskHandoff(input: TaskHandoffInput): TaskHandoff {
  const issues = validateHandoffInput(input);
  if (issues.length > 0) {
    throw new ContextRuntimeError('invalid-task-handoff', 'Task Handoff input is invalid', issues);
  }

  const factRefs = Object.freeze(input.manifest.factRefs.map(freezeFactRef));
  const evidenceRefs = Object.freeze(
    sortUnique(factRefs.flatMap((factRef) => factRef.evidenceRefs)),
  );
  const unresolvedQuestions = Object.freeze(sortUnique(input.unresolvedQuestions));
  const nextTask = input.nextTask ? Object.freeze({ ...input.nextTask }) : undefined;

  return Object.freeze({
    version: 'v1',
    taskKey: input.workingContext.taskKey,
    sourceRevision: input.sourceRevision,
    resultRevision: input.resultRevision,
    manifestDigest: input.manifest.digest,
    factRefs,
    evidenceRefs,
    unresolvedQuestions,
    ...(nextTask ? { nextTask } : {}),
  });
}

/**
 * Assemble a parent Handoff from one completed reference-only Handoff per
 * decomposition child. This is intentionally reference-only: no child Fact
 * values, transcripts, or provider payloads cross the aggregation boundary.
 */
export function aggregateTaskHandoffs(input: TaskHandoffAggregationInput): TaskHandoff {
  const issues = validateAggregationInput(input);
  if (issues.length > 0) {
    throw new ContextRuntimeError(
      'invalid-task-handoff',
      'Parent Task Handoff aggregation input is invalid',
      issues,
    );
  }

  const childTaskKeys = input.decomposition.children.map((child) => child.taskKey);
  const childByTaskKey = new Map(input.childHandoffs.map((handoff) => [handoff.taskKey, handoff]));
  const mergedFacts = new Map<
    string,
    { factKey: string; revision: string; evidenceRefs: string[] }
  >();

  for (const childTaskKey of childTaskKeys) {
    const handoff = childByTaskKey.get(childTaskKey)!;
    for (const factRef of handoff.factRefs) {
      const existing = mergedFacts.get(factRef.factKey);
      if (!existing) {
        mergedFacts.set(factRef.factKey, {
          factKey: factRef.factKey,
          revision: factRef.revision,
          evidenceRefs: sortUnique(factRef.evidenceRefs),
        });
        continue;
      }
      if (existing.revision !== factRef.revision) {
        throw new ContextRuntimeError(
          'invalid-task-handoff',
          'Parent Task Handoff cannot merge conflicting Fact revisions',
          [
            {
              code: 'handoff-fact-revision-conflict',
              path: `childHandoffs.${childTaskKey}.factRefs.${factRef.factKey}`,
              message: `Fact ${factRef.factKey} has conflicting revisions: ${existing.revision} and ${factRef.revision}`,
            },
          ],
        );
      }
      existing.evidenceRefs = sortUnique([...existing.evidenceRefs, ...factRef.evidenceRefs]);
    }
  }

  const factRefs = Object.freeze(
    [...mergedFacts.values()]
      .sort((left, right) => compareStrings(left.factKey, right.factKey))
      .map(freezeFactRef),
  );
  const evidenceRefs = Object.freeze(
    sortUnique(factRefs.flatMap((factRef) => factRef.evidenceRefs)),
  );
  const unresolvedQuestions = Object.freeze(
    sortUnique([
      ...input.unresolvedQuestions,
      ...input.childHandoffs.flatMap((handoff) => handoff.unresolvedQuestions),
    ]),
  );
  const nextTask = input.nextTask ? Object.freeze({ ...input.nextTask }) : undefined;
  const manifestDigest = stableDigest(
    canonicalize({
      version: 'v1',
      taskKey: input.decomposition.parentTaskKey,
      sourceRevision: input.sourceRevision,
      resultRevision: input.resultRevision,
      childTaskKeys,
      childManifestDigests: childTaskKeys.map(
        (taskKey) => childByTaskKey.get(taskKey)!.manifestDigest,
      ),
      factRefs,
      evidenceRefs,
      unresolvedQuestions,
      nextTask: nextTask ?? null,
    }),
  );

  return Object.freeze({
    version: 'v1',
    taskKey: input.decomposition.parentTaskKey,
    sourceRevision: input.sourceRevision,
    resultRevision: input.resultRevision,
    manifestDigest,
    factRefs,
    evidenceRefs,
    unresolvedQuestions,
    childTaskKeys: Object.freeze([...childTaskKeys]),
    ...(nextTask ? { nextTask } : {}),
  });
}

/**
 * Execute child Handoff producers in deterministic sequence and aggregate
 * only a fully completed decomposition. A partial or failed execution keeps
 * the parent Handoff absent, so callers cannot accidentally promote partial
 * discovery into a completed parent result.
 */
export async function executeAndAggregateTaskHandoffs(
  input: TaskHandoffDecompositionExecutionOptions & {
    readonly decomposition: DiscoveryTaskDecomposition;
    readonly executeChild: (task: DiscoveryTaskSlice) => TaskHandoff | Promise<TaskHandoff>;
  },
): Promise<TaskHandoffDecompositionExecutionResult> {
  const execution = await executeDiscoveryTaskDecomposition(
    input.decomposition,
    input.executeChild,
    {
      continueOnError: input.continueOnError,
    },
  );
  if (execution.status !== 'completed') {
    return Object.freeze({ execution });
  }

  const handoff = aggregateTaskHandoffs({
    decomposition: input.decomposition,
    childHandoffs: execution.children.map((record) => record.result!),
    sourceRevision: input.sourceRevision,
    resultRevision: input.resultRevision,
    unresolvedQuestions: input.unresolvedQuestions,
    ...(input.nextTask ? { nextTask: input.nextTask } : {}),
  });
  return Object.freeze({ execution, handoff });
}

function validateManifestInput(input: ContextManifestInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (input.workingContext.status !== 'closed') {
    issues.push({
      code: 'working-context-not-closed',
      path: 'workingContext.status',
      message: 'Context Manifest requires a closed Working Context',
    });
  }
  if (!input.snapshotRef.trim()) {
    issues.push({
      code: 'snapshot-ref-empty',
      path: 'snapshotRef',
      message: 'snapshotRef is required',
    });
  }
  return issues;
}

function validateHandoffInput(input: TaskHandoffInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (input.workingContext.status !== 'closed') {
    issues.push({
      code: 'working-context-not-closed',
      path: 'workingContext.status',
      message: 'Task Handoff requires a closed Working Context',
    });
  }
  if (input.manifest.taskKey !== input.workingContext.taskKey) {
    issues.push({
      code: 'manifest-task-mismatch',
      path: 'manifest.taskKey',
      message: 'Manifest taskKey must match Working Context taskKey',
    });
  }
  for (const [field, value] of [
    ['sourceRevision', input.sourceRevision],
    ['resultRevision', input.resultRevision],
  ] as const) {
    if (!value.trim()) {
      issues.push({
        code: 'handoff-revision-empty',
        path: field,
        message: `${field} is required`,
      });
    }
  }
  if (input.unresolvedQuestions.some((question) => !question.trim())) {
    issues.push({
      code: 'handoff-question-invalid',
      path: 'unresolvedQuestions',
      message: 'unresolvedQuestions must not contain empty values',
    });
  }
  if (input.nextTask && (!input.nextTask.taskKey.trim() || !input.nextTask.objective.trim())) {
    issues.push({
      code: 'handoff-next-task-invalid',
      path: 'nextTask',
      message: 'nextTask requires taskKey and objective',
    });
  }
  return issues;
}

function validateAggregationInput(input: TaskHandoffAggregationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const decomposition = input.decomposition;
  if (!decomposition.parentTaskKey.trim()) {
    issues.push({
      code: 'handoff-parent-task-key-empty',
      path: 'decomposition.parentTaskKey',
      message: 'decomposition.parentTaskKey is required',
    });
  }
  if (decomposition.children.length === 0) {
    issues.push({
      code: 'handoff-child-tasks-empty',
      path: 'decomposition.children',
      message: 'decomposition.children must not be empty',
    });
  }

  const expectedTaskKeys = decomposition.children.map((child) => child.taskKey);
  const expectedTaskKeySet = new Set<string>();
  expectedTaskKeys.forEach((taskKey, index) => {
    if (!taskKey.trim()) {
      issues.push({
        code: 'handoff-child-task-key-empty',
        path: `decomposition.children[${index}].taskKey`,
        message: 'child taskKey is required',
      });
    }
    if (expectedTaskKeySet.has(taskKey)) {
      issues.push({
        code: 'handoff-child-task-key-duplicate',
        path: `decomposition.children[${index}].taskKey`,
        message: `duplicate child taskKey: ${taskKey}`,
      });
    }
    expectedTaskKeySet.add(taskKey);
  });

  if (input.childHandoffs.length !== expectedTaskKeys.length) {
    issues.push({
      code: 'handoff-child-count-mismatch',
      path: 'childHandoffs',
      message: `expected ${expectedTaskKeys.length} child Handoffs, received ${input.childHandoffs.length}`,
    });
  }

  const actualTaskKeys = new Set<string>();
  input.childHandoffs.forEach((handoff, index) => {
    if (!handoff.taskKey.trim()) {
      issues.push({
        code: 'handoff-child-task-key-empty',
        path: `childHandoffs[${index}].taskKey`,
        message: 'child Handoff taskKey is required',
      });
    }
    if (actualTaskKeys.has(handoff.taskKey)) {
      issues.push({
        code: 'handoff-child-task-key-duplicate',
        path: `childHandoffs[${index}].taskKey`,
        message: `duplicate child Handoff taskKey: ${handoff.taskKey}`,
      });
    }
    actualTaskKeys.add(handoff.taskKey);
    if (!expectedTaskKeySet.has(handoff.taskKey)) {
      issues.push({
        code: 'handoff-child-task-unexpected',
        path: `childHandoffs[${index}].taskKey`,
        message: `unexpected child Handoff taskKey: ${handoff.taskKey}`,
      });
    }
    issues.push(...validateChildHandoff(handoff, index));
  });

  expectedTaskKeys.forEach((taskKey, index) => {
    if (!actualTaskKeys.has(taskKey)) {
      issues.push({
        code: 'handoff-child-task-missing',
        path: `decomposition.children[${index}].taskKey`,
        message: `missing child Handoff for taskKey: ${taskKey}`,
      });
    }
  });

  for (const [field, value] of [
    ['sourceRevision', input.sourceRevision],
    ['resultRevision', input.resultRevision],
  ] as const) {
    if (!value.trim()) {
      issues.push({
        code: 'handoff-revision-empty',
        path: field,
        message: `${field} is required`,
      });
    }
  }
  if (input.unresolvedQuestions.some((question) => !question.trim())) {
    issues.push({
      code: 'handoff-question-invalid',
      path: 'unresolvedQuestions',
      message: 'unresolvedQuestions must not contain empty values',
    });
  }
  if (input.nextTask && (!input.nextTask.taskKey.trim() || !input.nextTask.objective.trim())) {
    issues.push({
      code: 'handoff-next-task-invalid',
      path: 'nextTask',
      message: 'nextTask requires taskKey and objective',
    });
  }
  return issues;
}

function validateChildHandoff(handoff: TaskHandoff, index: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [field, value] of [
    ['manifestDigest', handoff.manifestDigest],
    ['sourceRevision', handoff.sourceRevision],
    ['resultRevision', handoff.resultRevision],
  ] as const) {
    if (!value.trim()) {
      issues.push({
        code: 'handoff-child-field-empty',
        path: `childHandoffs[${index}].${field}`,
        message: `${field} is required on child Handoff`,
      });
    }
  }
  if (handoff.nextTask) {
    issues.push({
      code: 'handoff-child-next-task-unsupported',
      path: `childHandoffs[${index}].nextTask`,
      message: 'child nextTask requires an explicit consumer-level aggregation policy',
    });
  }
  if (handoff.unresolvedQuestions.some((question) => !question.trim())) {
    issues.push({
      code: 'handoff-child-question-invalid',
      path: `childHandoffs[${index}].unresolvedQuestions`,
      message: 'child unresolvedQuestions must not contain empty values',
    });
  }

  const factRefs = handoff.factRefs.map((factRef, factIndex) => {
    if (!factRef.factKey.trim() || !factRef.revision.trim()) {
      issues.push({
        code: 'handoff-child-fact-invalid',
        path: `childHandoffs[${index}].factRefs[${factIndex}]`,
        message: 'child Fact reference requires factKey and revision',
      });
    }
    if (factRef.evidenceRefs.some((evidenceRef) => !evidenceRef.trim())) {
      issues.push({
        code: 'handoff-child-evidence-invalid',
        path: `childHandoffs[${index}].factRefs[${factIndex}].evidenceRefs`,
        message: 'child evidence references must not contain empty values',
      });
    }
    return factRef.evidenceRefs;
  });
  const expectedEvidenceRefs = sortUnique(factRefs.flat());
  if (JSON.stringify(sortUnique(handoff.evidenceRefs)) !== JSON.stringify(expectedEvidenceRefs)) {
    issues.push({
      code: 'handoff-child-evidence-mismatch',
      path: `childHandoffs[${index}].evidenceRefs`,
      message: 'child evidenceRefs must equal the union of Fact evidenceRefs',
    });
  }
  return issues;
}

function toFactRefs(
  facts: readonly { factKey: string; revision: string; evidenceRefs: readonly string[] }[],
): ManifestFactRef[] {
  return [...facts]
    .map((fact) => ({
      factKey: fact.factKey,
      revision: fact.revision,
      evidenceRefs: sortUnique(fact.evidenceRefs),
    }))
    .sort((left, right) => compareStrings(left.factKey, right.factKey))
    .map(freezeFactRef);
}

function canonicalOutputContract(contract: OutputContract): OutputContract {
  return {
    contractKey: contract.contractKey,
    description: contract.description,
    requiredFields: sortUnique(contract.requiredFields),
  };
}

function freezeOutputContract(contract: OutputContract): OutputContract {
  return Object.freeze({
    contractKey: contract.contractKey,
    description: contract.description,
    requiredFields: Object.freeze([...contract.requiredFields]),
  });
}

function freezeFactRef(factRef: ManifestFactRef): ManifestFactRef {
  return Object.freeze({
    factKey: factRef.factKey,
    revision: factRef.revision,
    evidenceRefs: Object.freeze([...factRef.evidenceRefs]),
  });
}

function sortUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalize(value: unknown): string {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort(compareStrings)
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(',')}}`;
  }
  throw new TypeError('Unsupported value in canonical JSON');
}

function stableDigest(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}
