import {
  ContextRuntimeError,
  type ContextHint,
  type ContextObservationInput,
  type ContextObservationRecord,
  type ContextUsageSummary,
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
          : [
              {
                code: 'definition-source-ref-empty',
                path: `nodes[${index}].sourceRef`,
                message: 'Definition graph route node requires sourceRef',
              },
            ],
      );
      if (issues.length > 0) {
        throw invalidAdapterError('Definition graph discovery output is invalid', issues);
      }
      return Object.freeze(
        nodes.map((node) =>
          Object.freeze({
            route: node.route,
            priority: node.priority,
            estimatedSize: Object.freeze({ ...node.estimatedSize }),
            sourceRef: node.sourceRef,
          }),
        ),
      );
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
        port
          .resolve(input)
          .filter((record) => requiredFactKeys.has(record.factKey))
          .map((record) =>
            Object.freeze({
              factKey: record.factKey,
              resolutionRouteKey: input.route.routeKey,
              value: record.value,
              authority: record.authority,
              observedAt: record.observedAt,
              revision: record.revision,
              evidenceRefs: Object.freeze([...record.evidenceRefs]),
            }),
          ),
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

export function mapContextObservation(input: ContextObservationInput): ContextObservationRecord {
  const issues: ValidationIssue[] = [];
  if (!input.taskKey.trim()) {
    issues.push({
      code: 'observation-task-key-empty',
      path: 'taskKey',
      message: 'taskKey is required',
    });
  }
  if (!input.status.trim()) {
    issues.push({
      code: 'observation-status-empty',
      path: 'status',
      message: 'status is required',
    });
  }
  if (input.manifestDigest !== undefined && !input.manifestDigest.trim()) {
    issues.push({
      code: 'observation-manifest-digest-empty',
      path: 'manifestDigest',
      message: 'manifestDigest must be non-empty when provided',
    });
  }
  if (input.routeKeys.some((routeKey) => !routeKey.trim())) {
    issues.push({
      code: 'observation-route-key-invalid',
      path: 'routeKeys',
      message: 'routeKeys must not contain empty values',
    });
  }
  if (input.factKeys.some((factKey) => !factKey.trim())) {
    issues.push({
      code: 'observation-fact-key-invalid',
      path: 'factKeys',
      message: 'factKeys must not contain empty values',
    });
  }
  if (input.usage) {
    issues.push(...validateUsageSummary(input.usage));
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
    ...(input.addressContext ? { addressContext: freezeRecord(input.addressContext) } : {}),
    ...(input.usage ? { usage: freezeUsageSummary(input.usage) } : {}),
  };
  return Object.freeze(record);
}

function validateUsageSummary(usage: ContextUsageSummary): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (
    usage.measurement !== 'estimated' &&
    usage.measurement !== 'measured' &&
    usage.measurement !== 'mixed'
  ) {
    issues.push({
      code: 'observation-usage-measurement-invalid',
      path: 'usage.measurement',
      message: 'measurement must be estimated, measured, or mixed',
    });
  }
  for (const field of ['discoveryTokens', 'workingTokens', 'totalTokens'] as const) {
    if (!Number.isInteger(usage[field]) || usage[field] < 0) {
      issues.push({
        code: 'observation-usage-invalid',
        path: `usage.${field}`,
        message: `${field} must be a non-negative integer`,
      });
    }
  }
  if (usage.totalTokens !== usage.discoveryTokens + usage.workingTokens) {
    issues.push({
      code: 'observation-usage-total-mismatch',
      path: 'usage.totalTokens',
      message: 'totalTokens must equal discoveryTokens + workingTokens',
    });
  }
  if (usage.metrics) {
    if (
      usage.metrics.measurement !== 'estimated' &&
      usage.metrics.measurement !== 'measured' &&
      usage.metrics.measurement !== 'mixed'
    ) {
      issues.push({
        code: 'observation-usage-metrics-measurement-invalid',
        path: 'usage.metrics.measurement',
        message: 'metrics.measurement must be estimated, measured, or mixed',
      });
    }
    if (
      usage.metrics.bytes !== undefined &&
      (!Number.isInteger(usage.metrics.bytes) || usage.metrics.bytes < 0)
    ) {
      issues.push({
        code: 'observation-usage-bytes-invalid',
        path: 'usage.metrics.bytes',
        message: 'metrics.bytes must be a non-negative integer',
      });
    }
    if (
      usage.metrics.latencyMs !== undefined &&
      (!Number.isFinite(usage.metrics.latencyMs) || usage.metrics.latencyMs < 0)
    ) {
      issues.push({
        code: 'observation-usage-latency-invalid',
        path: 'usage.metrics.latencyMs',
        message: 'metrics.latencyMs must be a non-negative finite number',
      });
    }
  }
  if (!Array.isArray(usage.events)) {
    issues.push({
      code: 'observation-usage-events-invalid',
      path: 'usage.events',
      message: 'usage.events must be an array',
    });
    return issues;
  }
  const discoveryFromEvents = usage.events
    .filter((event) => event.phase === 'discovery')
    .reduce((total, event) => total + event.tokens, 0);
  const workingFromEvents = usage.events
    .filter((event) => event.phase === 'working')
    .reduce((total, event) => total + event.tokens, 0);
  if (discoveryFromEvents !== usage.discoveryTokens || workingFromEvents !== usage.workingTokens) {
    issues.push({
      code: 'observation-usage-events-mismatch',
      path: 'usage.events',
      message: 'usage events must sum to discoveryTokens and workingTokens',
    });
  }
  usage.events.forEach((event, index) => {
    if (event.phase !== 'discovery' && event.phase !== 'working') {
      issues.push({
        code: 'observation-usage-event-phase-invalid',
        path: `usage.events[${index}].phase`,
        message: 'usage event phase must be discovery or working',
      });
    }
    if (event.measurement !== 'estimated' && event.measurement !== 'measured') {
      issues.push({
        code: 'observation-usage-event-measurement-invalid',
        path: `usage.events[${index}].measurement`,
        message: 'usage event measurement must be estimated or measured',
      });
    }
    if (!Number.isInteger(event.tokens) || event.tokens < 0) {
      issues.push({
        code: 'observation-usage-event-invalid',
        path: `usage.events[${index}].tokens`,
        message: 'usage event tokens must be a non-negative integer',
      });
    }
    if (event.routeKey !== undefined && !event.routeKey.trim()) {
      issues.push({
        code: 'observation-usage-event-route-invalid',
        path: `usage.events[${index}].routeKey`,
        message: 'usage event routeKey must be non-empty when provided',
      });
    }
    if (event.sourceRef !== undefined && !event.sourceRef.trim()) {
      issues.push({
        code: 'observation-usage-event-source-invalid',
        path: `usage.events[${index}].sourceRef`,
        message: 'usage event sourceRef must be non-empty when provided',
      });
    }
    if (event.provider !== undefined && !event.provider.trim()) {
      issues.push({
        code: 'observation-usage-event-provider-invalid',
        path: `usage.events[${index}].provider`,
        message: 'usage event provider must be non-empty when provided',
      });
    }
    for (const [field, value] of [
      ['inputTokens', event.inputTokens],
      ['outputTokens', event.outputTokens],
      ['bytes', event.bytes],
    ] as const) {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        issues.push({
          code: `observation-usage-event-${field}-invalid`,
          path: `usage.events[${index}].${field}`,
          message: `${field} must be a non-negative integer`,
        });
      }
    }
    if (
      event.latencyMs !== undefined &&
      (!Number.isFinite(event.latencyMs) || event.latencyMs < 0)
    ) {
      issues.push({
        code: 'observation-usage-event-latency-invalid',
        path: `usage.events[${index}].latencyMs`,
        message: 'latencyMs must be a non-negative finite number',
      });
    }
    if (
      event.inputTokens !== undefined &&
      event.outputTokens !== undefined &&
      event.inputTokens + event.outputTokens !== event.tokens
    ) {
      issues.push({
        code: 'observation-usage-event-total-mismatch',
        path: `usage.events[${index}].tokens`,
        message: 'tokens must equal inputTokens + outputTokens when both are provided',
      });
    }
  });

  const metricEvents = usage.events.filter(
    (event) => event.bytes !== undefined || event.latencyMs !== undefined,
  );
  if (metricEvents.length === 0) {
    if (usage.metrics !== undefined) {
      issues.push({
        code: 'observation-usage-metrics-events-mismatch',
        path: 'usage.metrics',
        message: 'usage.metrics requires at least one metric-bearing usage event',
      });
    }
  } else {
    const metricMeasurements = new Set(metricEvents.map((event) => event.measurement));
    const metricMeasurement = metricMeasurements.size === 1 ? [...metricMeasurements][0]! : 'mixed';
    const expectedBytes = metricEvents.some((event) => event.bytes !== undefined)
      ? metricEvents.reduce((total, event) => total + (event.bytes ?? 0), 0)
      : undefined;
    const expectedLatency = metricEvents.some((event) => event.latencyMs !== undefined)
      ? metricEvents.reduce((total, event) => total + (event.latencyMs ?? 0), 0)
      : undefined;
    if (
      !usage.metrics ||
      usage.metrics.measurement !== metricMeasurement ||
      usage.metrics.bytes !== expectedBytes ||
      usage.metrics.latencyMs !== expectedLatency
    ) {
      issues.push({
        code: 'observation-usage-metrics-events-mismatch',
        path: 'usage.metrics',
        message: 'usage.metrics must match metric-bearing usage events',
      });
    }
  }
  return issues;
}

function freezeUsageSummary(usage: ContextUsageSummary): ContextUsageSummary {
  return Object.freeze({
    ...usage,
    events: Object.freeze(usage.events.map((event) => Object.freeze({ ...event }))),
  });
}

function validateResolutionRequest(input: FederatedResolutionRequest): void {
  const issues: ValidationIssue[] = [];
  if (!input.taskKey.trim()) {
    issues.push({
      code: 'resolution-task-key-empty',
      path: 'taskKey',
      message: 'taskKey is required',
    });
  }
  if (!input.snapshotRef.trim()) {
    issues.push({
      code: 'resolution-snapshot-ref-empty',
      path: 'snapshotRef',
      message: 'snapshotRef is required',
    });
  }
  if (input.requiredFactKeys.length === 0) {
    issues.push({
      code: 'resolution-facts-empty',
      path: 'requiredFactKeys',
      message: 'requiredFactKeys is required',
    });
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
    issues.push({
      code: 'decision-hint-key-empty',
      path: `hints[${index}].hintKey`,
      message: 'hintKey is required',
    });
  }
  if (!hint.summary.trim()) {
    issues.push({
      code: 'decision-hint-summary-empty',
      path: `hints[${index}].summary`,
      message: 'summary is required',
    });
  }
  if (!hint.sourceRevision.trim()) {
    issues.push({
      code: 'decision-hint-revision-empty',
      path: `hints[${index}].sourceRevision`,
      message: 'sourceRevision is required',
    });
  }
  if (
    hint.confidence !== undefined &&
    (hint.confidence < 0 || hint.confidence > 1 || !Number.isFinite(hint.confidence))
  ) {
    issues.push({
      code: 'decision-hint-confidence-invalid',
      path: `hints[${index}].confidence`,
      message: 'confidence must be between 0 and 1',
    });
  }
  return issues;
}

function invalidAdapterError(
  message: string,
  issues: readonly ValidationIssue[],
): ContextRuntimeError {
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
