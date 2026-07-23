import { describe, expect, it } from 'vitest';
import {
  createContextUsageLedger,
  createJsonContextTokenCounter,
  createProviderUsageEvent,
  JSON_CONTEXT_TOKEN_COUNTER,
} from './usage.js';

describe('context-runtime usage ledger', () => {
  it('[contract:context-runtime.usage.ledger.v1] keeps discovery and working usage phase-separated', () => {
    const ledger = createContextUsageLedger([
      { phase: 'discovery', tokens: 10, measurement: 'measured', sourceRef: 'input' },
    ]);

    ledger.record({
      phase: 'discovery',
      tokens: 20,
      measurement: 'estimated',
      routeKey: 'definition.document',
    });
    ledger.record({
      phase: 'working',
      tokens: 30,
      measurement: 'measured',
      routeKey: 'definition.body',
    });

    expect(ledger.snapshot()).toEqual({
      events: [
        { phase: 'discovery', tokens: 10, measurement: 'measured', sourceRef: 'input' },
        {
          phase: 'discovery',
          tokens: 20,
          measurement: 'estimated',
          routeKey: 'definition.document',
        },
        { phase: 'working', tokens: 30, measurement: 'measured', routeKey: 'definition.body' },
      ],
      discoveryTokens: 30,
      workingTokens: 30,
      totalTokens: 60,
      measurement: 'mixed',
    });
  });

  it('[contract:context-runtime.usage.ledger.v1] provides a deterministic JSON estimator and configurable unit size', () => {
    expect(JSON_CONTEXT_TOKEN_COUNTER.measurement).toBe('estimated');
    expect(JSON_CONTEXT_TOKEN_COUNTER.count('12345678')).toBe(3);
    expect(createJsonContextTokenCounter(2).count('12345678')).toBe(5);
  });

  it('[contract:context-runtime.usage.ledger.v1] rejects negative usage', () => {
    const ledger = createContextUsageLedger();

    expect(() => ledger.record({ phase: 'working', tokens: -1, measurement: 'measured' })).toThrow(
      expect.objectContaining({ code: 'invalid-context-adapter' }),
    );
  });

  it('[contract:context-runtime.usage.ledger.v1] rejects invalid phase and empty source references', () => {
    const ledger = createContextUsageLedger();

    expect(() =>
      ledger.record({
        phase: 'verification' as 'discovery',
        tokens: 1,
        measurement: 'measured',
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid-context-adapter' }));

    expect(() =>
      ledger.record({
        phase: 'working',
        tokens: 1,
        measurement: 'measured',
        sourceRef: ' ',
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid-context-adapter' }));

    expect(() =>
      ledger.record({
        phase: 'working',
        tokens: 1,
        measurement: 'measured',
        model: ' ',
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid-context-adapter' }));
  });

  it('[contract:context-runtime.usage.provider-adapter.v1] preserves provider totals and neutral metrics', () => {
    const event = createProviderUsageEvent({
      provider: 'openai',
      phase: 'discovery',
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
      bytes: 2_048,
      latencyMs: 42.5,
      sourceRef: 'provider:response:1',
    });
    const ledger = createContextUsageLedger([event]);

    expect(event).toMatchObject({
      provider: 'openai',
      tokens: 150,
      inputTokens: 120,
      outputTokens: 30,
      bytes: 2_048,
      latencyMs: 42.5,
      measurement: 'measured',
    });
    expect(ledger.snapshot()).toMatchObject({
      discoveryTokens: 150,
      metrics: { bytes: 2_048, latencyMs: 42.5, measurement: 'measured' },
    });
  });

  it('[contract:context-runtime.usage.provider-adapter.v1] rejects a provider total mismatch', () => {
    expect(() =>
      createProviderUsageEvent({
        provider: 'anthropic',
        phase: 'working',
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 99,
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid-context-adapter' }));
  });
});
