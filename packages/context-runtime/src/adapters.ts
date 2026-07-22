import {
  ContextRuntimeError,
  type ContextHint,
  type ContextObservationInput,
  type ContextObservationRecord,
  type DecisionHintAdapter,
  type DecisionHintPort,
  type DecisionHintRequest,
  type DefinitionGraphDiscoveryAdapter,
  type DefinitionGraphDiscoveryPort,
  type DefinitionGraphDiscoveryRequest,
  type DiscoveryCandidate,
  type FederatedResolutionAdapter,
  type FederatedResolutionPort,
  type FederatedResolutionRequest,
  type ResolvedFact,
  type ValidationIssue,
} from './types.js';

export function createDefinitionGraphDiscoveryAdapter(
  port: DefinitionGraphDiscoveryPort,
): DefinitionGraphDiscoveryAdapter {
  return Object.freeze({
    discover(input: DefinitionGraphDiscoveryRequest): readonly DiscoveryCandidate[] {
      const nodes = port.listRoutes(input);
      const issues = nodes.flatMap((node, index) =>
        node.sourceRef.trim()
          ? []
          : [{
              code: 'definition-source-ref-empty',
              path: `nodes[${index}].sourceRef`,
              message: 'Definition graph route node requires sourceRef',
            }],
      );
      if (issues.length > 0) {
        throw invalidAdapterError('Definition graph discovery output is invalid', issues);
      }
      return Object.freeze(nodes.map((node) => Object.freeze({
        route: node.route,
        priority: node.priority,
        estimatedSize: Object.freeze({ ...node.estimatedSize }),
        sourceRef: node.sourceRef,
      })));
    },
  });
}

export function createFederatedResolutionAdapter(
  port: FederatedResolutionPort,
): FederatedResolutionAdapter {
  return Object.freeze({
    resolve(input: FederatedResolutionRequest): readonly ResolvedFact[] {
      validateResolutionRequest(input);
      const requiredFactKeys = new Set(input.requiredFactKeys);
      return Object.freeze(
        port.resolve(input)
          .filter((record) => requiredFactKeys.has(record.factKey))
          .map((record) => Object.freeze({
            factKey: record.factKey,
            resolutionRouteKey: input.route.routeKey,
            value: record.value,
            authority: record.authority,
            observedAt: record.observedAt,
            revision: record.revision,
            evidenceRefs: Object.freeze([...record.evidenceRefs]),
          })),
      );
    },
  });
}

export function createDecisionHintAdapter(port: DecisionHintPort): DecisionHintAdapter {
  return Object.freeze({
    getHints(input: DecisionHintRequest): readonly ContextHint[] {
      const hints = port.listHints(input);
      const issues = hints.flatMap((hint, index) => validateHint(hint, index));
      if (issues.length > 0) {
        throw invalidAdapterError('Decision hint output is invalid', issues);
      }
      return Object.freeze(
        [...hints]
          .sort((left, right) => compareStrings(left.hintKey, right.hintKey))
          .map((hint) => Object.freeze({ ...hint, provenance: 'decision-flow' as const })),
      );
    },
  });
}

export function mapContextObservation(
  input: ContextObservationInput,
): ContextObservationRecord {
  const issues: ValidationIssue[] = [];
  if (!input.taskKey.trim()) {
    issues.push({ code: 'observation-task-key-empty', path: 'taskKey', message: 'taskKey is required' });
  }
  if (!input.status.trim()) {
    issues.push({ code: 'observation-status-empty', path: 'status', message: 'status is required' });
  }
  if (input.manifestDigest !== undefined && !input.manifestDigest.trim()) {
    issues.push({
      code: 'observation-manifest-digest-empty',
      path: 'manifestDigest',
      message: 'manifestDigest must be non-empty when provided',
    });
  }
  if (input.routeKeys.some((routeKey) => !routeKey.trim())) {
    issues.push({ code: 'observation-route-key-invalid', path: 'routeKeys', message: 'routeKeys must not contain empty values' });
  }
  if (input.factKeys.some((factKey) => !factKey.trim())) {
    issues.push({ code: 'observation-fact-key-invalid', path: 'factKeys', message: 'factKeys must not contain empty values' });
  }
  if (issues.length > 0) {
    throw invalidAdapterError('Context observation input is invalid', issues);
  }

  const routeKeys = sortUnique(input.routeKeys);
  const record: ContextObservationRecord = {
    eventName: 'context_runtime_observation',
    taskKey: input.taskKey,
    stage: input.stage,
    status: input.status,
    routeKeys: Object.freeze(routeKeys),
    factCount: new Set(input.factKeys).size,
    ...(input.manifestDigest ? { manifestDigest: input.manifestDigest } : {}),
    ...(input.addressContext
      ? { addressContext: freezeRecord(input.addressContext) }
      : {}),
  };
  return Object.freeze(record);
}

function validateResolutionRequest(input: FederatedResolutionRequest): void {
  const issues: ValidationIssue[] = [];
  if (!input.taskKey.trim()) {
    issues.push({ code: 'resolution-task-key-empty', path: 'taskKey', message: 'taskKey is required' });
  }
  if (!input.snapshotRef.trim()) {
    issues.push({ code: 'resolution-snapshot-ref-empty', path: 'snapshotRef', message: 'snapshotRef is required' });
  }
  if (input.requiredFactKeys.length === 0) {
    issues.push({ code: 'resolution-facts-empty', path: 'requiredFactKeys', message: 'requiredFactKeys is required' });
  }
  if (issues.length > 0) {
    throw invalidAdapterError('Federated resolution request is invalid', issues);
  }
}

function validateHint(
  hint: { hintKey: string; summary: string; sourceRevision: string; confidence?: number },
  index: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!hint.hintKey.trim()) {
    issues.push({ code: 'decision-hint-key-empty', path: `hints[${index}].hintKey`, message: 'hintKey is required' });
  }
  if (!hint.summary.trim()) {
    issues.push({ code: 'decision-hint-summary-empty', path: `hints[${index}].summary`, message: 'summary is required' });
  }
  if (!hint.sourceRevision.trim()) {
    issues.push({ code: 'decision-hint-revision-empty', path: `hints[${index}].sourceRevision`, message: 'sourceRevision is required' });
  }
  if (hint.confidence !== undefined && (hint.confidence < 0 || hint.confidence > 1 || !Number.isFinite(hint.confidence))) {
    issues.push({ code: 'decision-hint-confidence-invalid', path: `hints[${index}].confidence`, message: 'confidence must be between 0 and 1' });
  }
  return issues;
}

function invalidAdapterError(message: string, issues: readonly ValidationIssue[]): ContextRuntimeError {
  return new ContextRuntimeError('invalid-context-adapter', message, issues);
}

function sortUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function freezeRecord(record: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(record).sort(([left], [right]) => compareStrings(left, right)),
    ),
  );
}
