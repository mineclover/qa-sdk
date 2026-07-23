import { encodingForModel } from 'js-tiktoken';

export const OPENAI_PROVIDER = 'openai' as const;
export const OPENAI_GPT_4O_MODEL = 'gpt-4o' as const;
export const OPENAI_GPT_4O_TOKENIZER_REVISION = 'js-tiktoken@1.0.21' as const;

export interface ProviderTokenCountContext {
  readonly phase?: 'discovery' | 'working';
  readonly routeKey?: string;
  readonly factKey?: string;
}

export interface ProviderTokenCounterModule {
  readonly provider: typeof OPENAI_PROVIDER;
  readonly model: typeof OPENAI_GPT_4O_MODEL;
  readonly tokenizerRevision: typeof OPENAI_GPT_4O_TOKENIZER_REVISION;
  readonly count: (value: unknown, context?: ProviderTokenCountContext) => number;
}

const encoding = encodingForModel(OPENAI_GPT_4O_MODEL);

/**
 * Composition-root module for the canonical context values used by qa-sdk.
 *
 * The bounded runtime passes route metadata and resolved Fact values rather
 * than provider messages. This module therefore applies one deterministic
 * JSON serialization before using the OpenAI model encoding. Provider API
 * message framing remains outside context-runtime and must be counted by a
 * provider-specific caller when that framing is part of the input.
 */
export function serializeCanonicalContextValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(sortCanonicalValue(value)) ?? String(value);
}

export const providerTokenCounter: ProviderTokenCounterModule = Object.freeze({
  provider: OPENAI_PROVIDER,
  model: OPENAI_GPT_4O_MODEL,
  tokenizerRevision: OPENAI_GPT_4O_TOKENIZER_REVISION,
  count(value: unknown, _context?: ProviderTokenCountContext): number {
    return encoding.encode(serializeCanonicalContextValue(value)).length;
  },
});

export default providerTokenCounter;

function sortCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortCanonicalValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortCanonicalValue(entry)]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
