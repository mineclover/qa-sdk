import { describe, expect, it } from 'vitest';
import {
  OPENAI_GPT_4O_MODEL,
  OPENAI_GPT_4O_TOKENIZER_REVISION,
  OPENAI_PROVIDER,
  providerTokenCounter,
  serializeCanonicalContextValue,
} from './index.js';

describe('OpenAI gpt-4o provider tokenizer module', () => {
  it('exports the provider/model identity required by the registry contract', () => {
    expect(providerTokenCounter).toMatchObject({
      provider: OPENAI_PROVIDER,
      model: OPENAI_GPT_4O_MODEL,
      tokenizerRevision: OPENAI_GPT_4O_TOKENIZER_REVISION,
    });
  });

  it('counts text with the model-specific encoding and accepts phase context', () => {
    const count = providerTokenCounter.count('hello world', {
      phase: 'discovery',
      routeKey: 'definition.document',
    });

    expect(count).toBeGreaterThan(0);
    expect(Number.isInteger(count)).toBe(true);
  });

  it('serializes canonical objects deterministically before counting', () => {
    expect(serializeCanonicalContextValue({ b: 2, a: 1 })).toBe(
      serializeCanonicalContextValue({ a: 1, b: 2 }),
    );
    expect(providerTokenCounter.count({ b: 2, a: 1 })).toBe(
      providerTokenCounter.count({ a: 1, b: 2 }),
    );
  });
});
