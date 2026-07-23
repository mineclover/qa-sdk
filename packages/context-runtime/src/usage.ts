import {
  ContextRuntimeError,
  type ContextTokenCounter,
  type ContextUsageEvent,
  type ContextUsageLedger,
  type ProviderUsageSnapshot,
  type ContextUsageSummary,
} from './types.js';

export const JSON_CONTEXT_TOKEN_COUNTER: ContextTokenCounter = Object.freeze({
  measurement: 'estimated',
  count: (value: unknown) => countJsonTokens(value),
});

export function createJsonContextTokenCounter(tokensPerUnit = 4): ContextTokenCounter {
  if (!Number.isInteger(tokensPerUnit) || tokensPerUnit <= 0) {
    throw new ContextRuntimeError(
      'invalid-context-adapter',
      'tokensPerUnit must be a positive integer',
      [
        {
          code: 'token-counter-unit-invalid',
          path: 'tokensPerUnit',
          message: 'tokensPerUnit must be a positive integer',
        },
      ],
    );
  }

  return Object.freeze({
    measurement: 'estimated' as const,
    count: (value: unknown) => countJsonTokens(value, tokensPerUnit),
  });
}

export function createContextUsageLedger(
  initialEvents: readonly ContextUsageEvent[] = [],
): ContextUsageLedger {
  const events = initialEvents.map(validateAndFreezeUsageEvent);

  return Object.freeze({
    record(event: ContextUsageEvent): void {
      events.push(validateAndFreezeUsageEvent(event));
    },
    snapshot(): ContextUsageSummary {
      return summarizeUsage(events);
    },
  });
}

/**
 * Normalize a provider-reported usage payload at the composition boundary.
 *
 * The runtime does not import an SDK or know a provider response shape. A
 * provider adapter maps its response to this neutral snapshot, and this
 * function preserves the exact reported total plus optional input/output
 * breakdown and transport metrics.
 */
export function createProviderUsageEvent(input: ProviderUsageSnapshot): ContextUsageEvent {
  if (!input.provider.trim()) {
    throw new ContextRuntimeError('invalid-context-adapter', 'Provider usage provider is invalid', [
      {
        code: 'usage-provider-invalid',
        path: 'provider',
        message: 'provider must be non-empty',
      },
    ]);
  }

  const inputTokens = input.inputTokens;
  const outputTokens = input.outputTokens;
  const totalTokens = input.totalTokens;
  const hasTokenValue =
    inputTokens !== undefined || outputTokens !== undefined || totalTokens !== undefined;
  if (!hasTokenValue) {
    throw new ContextRuntimeError(
      'invalid-context-adapter',
      'Provider usage must include token usage',
      [
        {
          code: 'usage-provider-tokens-missing',
          path: 'totalTokens',
          message: 'inputTokens, outputTokens, or totalTokens is required',
        },
      ],
    );
  }

  for (const [field, value] of [
    ['inputTokens', inputTokens],
    ['outputTokens', outputTokens],
    ['totalTokens', totalTokens],
  ] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new ContextRuntimeError(
        'invalid-context-adapter',
        'Provider usage tokens must be non-negative integers',
        [
          {
            code: 'usage-provider-tokens-invalid',
            path: field,
            message: `${field} must be a non-negative integer`,
          },
        ],
      );
    }
  }

  if (inputTokens !== undefined && outputTokens !== undefined && totalTokens !== undefined) {
    if (inputTokens + outputTokens !== totalTokens) {
      throw new ContextRuntimeError(
        'invalid-context-adapter',
        'Provider usage token total does not match input/output tokens',
        [
          {
            code: 'usage-provider-total-mismatch',
            path: 'totalTokens',
            message: 'totalTokens must equal inputTokens + outputTokens',
          },
        ],
      );
    }
  }

  const tokens = totalTokens ?? (inputTokens ?? 0) + (outputTokens ?? 0);
  return Object.freeze({
    phase: input.phase,
    tokens,
    measurement: 'measured',
    ...(input.routeKey ? { routeKey: input.routeKey } : {}),
    ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}),
    ...(input.inputTokens !== undefined ? { inputTokens: input.inputTokens } : {}),
    ...(input.outputTokens !== undefined ? { outputTokens: input.outputTokens } : {}),
    ...(input.bytes !== undefined ? { bytes: input.bytes } : {}),
    ...(input.latencyMs !== undefined ? { latencyMs: input.latencyMs } : {}),
    provider: input.provider,
  });
}

function validateAndFreezeUsageEvent(event: ContextUsageEvent): ContextUsageEvent {
  if (event.phase !== 'discovery' && event.phase !== 'working') {
    throw new ContextRuntimeError('invalid-context-adapter', 'Context usage phase is invalid', [
      {
        code: 'usage-phase-invalid',
        path: 'phase',
        message: 'phase must be discovery or working',
      },
    ]);
  }
  if (!Number.isInteger(event.tokens) || event.tokens < 0) {
    throw new ContextRuntimeError(
      'invalid-context-adapter',
      'Context usage tokens must be a non-negative integer',
      [
        {
          code: 'usage-tokens-invalid',
          path: 'tokens',
          message: 'Context usage tokens must be a non-negative integer',
        },
      ],
    );
  }
  if (event.measurement !== 'estimated' && event.measurement !== 'measured') {
    throw new ContextRuntimeError(
      'invalid-context-adapter',
      'Context usage measurement is invalid',
      [
        {
          code: 'usage-measurement-invalid',
          path: 'measurement',
          message: 'measurement must be estimated or measured',
        },
      ],
    );
  }
  if (event.routeKey !== undefined && !event.routeKey.trim()) {
    throw new ContextRuntimeError(
      'invalid-context-adapter',
      'Context usage routeKey must be non-empty when provided',
      [
        {
          code: 'usage-route-key-invalid',
          path: 'routeKey',
          message: 'routeKey must be non-empty when provided',
        },
      ],
    );
  }
  if (event.sourceRef !== undefined && !event.sourceRef.trim()) {
    throw new ContextRuntimeError(
      'invalid-context-adapter',
      'Context usage sourceRef must be non-empty when provided',
      [
        {
          code: 'usage-source-ref-invalid',
          path: 'sourceRef',
          message: 'sourceRef must be non-empty when provided',
        },
      ],
    );
  }
  if (event.provider !== undefined && !event.provider.trim()) {
    throw new ContextRuntimeError(
      'invalid-context-adapter',
      'Context usage provider must be non-empty when provided',
      [
        {
          code: 'usage-provider-invalid',
          path: 'provider',
          message: 'provider must be non-empty when provided',
        },
      ],
    );
  }
  for (const [field, value] of [
    ['model', event.model],
    ['tokenizerRevision', event.tokenizerRevision],
  ] as const) {
    if (value !== undefined && !value.trim()) {
      throw new ContextRuntimeError(
        'invalid-context-adapter',
        `Context usage ${field} must be non-empty when provided`,
        [
          {
            code: `usage-${field}-invalid`,
            path: field,
            message: `${field} must be non-empty when provided`,
          },
        ],
      );
    }
  }
  for (const [field, value] of [
    ['inputTokens', event.inputTokens],
    ['outputTokens', event.outputTokens],
    ['bytes', event.bytes],
  ] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new ContextRuntimeError(
        'invalid-context-adapter',
        `Context usage ${field} must be a non-negative integer`,
        [
          {
            code: `usage-${field}-invalid`,
            path: field,
            message: `${field} must be a non-negative integer`,
          },
        ],
      );
    }
  }
  if (event.latencyMs !== undefined && (!Number.isFinite(event.latencyMs) || event.latencyMs < 0)) {
    throw new ContextRuntimeError(
      'invalid-context-adapter',
      'Context usage latencyMs must be a non-negative finite number',
      [
        {
          code: 'usage-latency-invalid',
          path: 'latencyMs',
          message: 'latencyMs must be a non-negative finite number',
        },
      ],
    );
  }
  if (
    event.inputTokens !== undefined &&
    event.outputTokens !== undefined &&
    event.inputTokens + event.outputTokens !== event.tokens
  ) {
    throw new ContextRuntimeError(
      'invalid-context-adapter',
      'Context usage token total does not match input/output tokens',
      [
        {
          code: 'usage-total-mismatch',
          path: 'tokens',
          message: 'tokens must equal inputTokens + outputTokens when both are provided',
        },
      ],
    );
  }
  return Object.freeze({ ...event });
}

function summarizeUsage(events: readonly ContextUsageEvent[]): ContextUsageSummary {
  const discoveryTokens = sumPhase(events, 'discovery');
  const workingTokens = sumPhase(events, 'working');
  const measurements = new Set(events.map((event) => event.measurement));
  const measurement: ContextUsageSummary['measurement'] =
    measurements.size === 1 ? [...measurements][0]! : 'mixed';

  const metricEvents = events.filter(
    (event) => event.bytes !== undefined || event.latencyMs !== undefined,
  );
  const metrics = summarizeMetrics(metricEvents);

  return Object.freeze({
    events: Object.freeze([...events]),
    discoveryTokens,
    workingTokens,
    totalTokens: discoveryTokens + workingTokens,
    measurement,
    ...(metrics ? { metrics } : {}),
  });
}

function summarizeMetrics(
  events: readonly ContextUsageEvent[],
): ContextUsageSummary['metrics'] | undefined {
  if (events.length === 0) return undefined;
  const measurements = new Set(events.map((event) => event.measurement));
  const measurement: NonNullable<ContextUsageSummary['metrics']>['measurement'] =
    measurements.size === 1 ? [...measurements][0]! : 'mixed';
  const hasBytes = events.some((event) => event.bytes !== undefined);
  const hasLatency = events.some((event) => event.latencyMs !== undefined);
  return Object.freeze({
    ...(hasBytes ? { bytes: events.reduce((total, event) => total + (event.bytes ?? 0), 0) } : {}),
    ...(hasLatency
      ? { latencyMs: events.reduce((total, event) => total + (event.latencyMs ?? 0), 0) }
      : {}),
    measurement,
  });
}

function sumPhase(events: readonly ContextUsageEvent[], phase: ContextUsageEvent['phase']): number {
  return events
    .filter((event) => event.phase === phase)
    .reduce((total, event) => total + event.tokens, 0);
}

function countJsonTokens(value: unknown, tokensPerUnit = 4): number {
  const serialized = JSON.stringify(value);
  return Math.max(1, Math.ceil((serialized ?? String(value)).length / tokensPerUnit));
}
