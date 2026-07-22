import {
  ContextRuntimeError,
  type ContextManifest,
  type ContextManifestInput,
  type ManifestFactRef,
  type OutputContract,
  type TaskHandoff,
  type TaskHandoffInput,
  type ValidationIssue,
} from './types.js';

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
    throw new ContextRuntimeError(
      'invalid-task-handoff',
      'Task Handoff input is invalid',
      issues,
    );
  }

  const factRefs = Object.freeze(input.manifest.factRefs.map(freezeFactRef));
  const evidenceRefs = Object.freeze(
    sortUnique(factRefs.flatMap((factRef) => factRef.evidenceRefs)),
  );
  const unresolvedQuestions = Object.freeze(sortUnique(input.unresolvedQuestions));
  const nextTask = input.nextTask
    ? Object.freeze({ ...input.nextTask })
    : undefined;

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

function toFactRefs(facts: readonly { factKey: string; revision: string; evidenceRefs: readonly string[] }[]): ManifestFactRef[] {
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
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
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
