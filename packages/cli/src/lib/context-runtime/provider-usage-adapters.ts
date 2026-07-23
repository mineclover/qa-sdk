// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createProviderUsageEvent,
  type ContextTokenCounter,
  type ContextTokenCountContext,
  type ContextUsageEvent,
  type ContextUsagePhase,
  type ProviderUsageSnapshot,
} from 'context-runtime';

export type ProviderUsageProvider = 'openai' | 'anthropic' | 'generic';

export interface ProviderTokenCounterInput {
  readonly provider: ProviderUsageProvider;
  readonly model: string;
  readonly tokenizerRevision?: string;
  /** Provider SDK/tokenizer callback supplied by the composition root. */
  readonly count: (value: unknown, context?: ContextTokenCountContext) => number;
}

export interface ProviderTokenCounter extends ContextTokenCounter {
  readonly provider: ProviderUsageProvider;
  readonly model: string;
  readonly tokenizerRevision?: string;
}

/** Public ESM module contract for an externally supplied provider tokenizer. */
export interface ProviderTokenCounterModule {
  readonly provider: ProviderUsageProvider;
  readonly model: string;
  readonly tokenizerRevision?: string;
  readonly count: (value: unknown, context?: ContextTokenCountContext) => number;
}

export interface ProviderTokenCounterModuleSelection {
  readonly provider?: string;
  readonly model?: string;
}

export interface ProviderTokenCounterRegistryEntry {
  readonly provider: ProviderUsageProvider;
  readonly model: string;
  /** Module path relative to the registry document or an absolute path. */
  readonly module: string;
  readonly tokenizerRevision?: string;
}

export interface ProviderTokenCounterRegistryDocument {
  readonly version: 'v1';
  readonly entries: readonly ProviderTokenCounterRegistryEntry[];
}

export class ProviderTokenCounterModuleError extends Error {
  readonly code:
    | 'provider-tokenizer-module-invalid'
    | 'provider-tokenizer-module-load-failed'
    | 'provider-tokenizer-selection-mismatch';

  constructor(
    code: ProviderTokenCounterModuleError['code'],
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ProviderTokenCounterModuleError';
    this.code = code;
  }
}

interface ProviderUsageDocument extends UsageObject {
  readonly provider?: unknown;
  readonly phase?: unknown;
  readonly sourceRef?: unknown;
  readonly routeKey?: unknown;
  readonly bytes?: unknown;
  readonly latencyMs?: unknown;
  readonly latency_ms?: unknown;
  readonly requestBytes?: unknown;
  readonly responseBytes?: unknown;
  readonly usage?: unknown;
}

interface UsageObject {
  readonly input_tokens?: unknown;
  readonly output_tokens?: unknown;
  readonly total_tokens?: unknown;
  readonly prompt_tokens?: unknown;
  readonly completion_tokens?: unknown;
  readonly inputTokens?: unknown;
  readonly outputTokens?: unknown;
  readonly totalTokens?: unknown;
  readonly cache_creation_input_tokens?: unknown;
  readonly cache_read_input_tokens?: unknown;
  readonly cacheCreationInputTokens?: unknown;
  readonly cacheReadInputTokens?: unknown;
}

export interface ProviderUsageAdapterContext {
  readonly phase: ContextUsagePhase;
  readonly sourceRef?: string;
  readonly routeKey?: string;
  readonly bytes?: number;
  readonly latencyMs?: number;
}

export interface ProviderUsageAdapter {
  readonly provider: ProviderUsageProvider;
  readonly toSnapshot: (
    response: unknown,
    context: ProviderUsageAdapterContext,
  ) => ProviderUsageSnapshot;
}

/**
 * Adapt a provider/model tokenizer to the runtime's neutral token-counter
 * contract. The SDK remains outside context-runtime and is supplied by the
 * caller; malformed tokenizer output fails closed before budget accounting.
 */
export function createProviderTokenCounter(input: ProviderTokenCounterInput): ProviderTokenCounter {
  const provider = normalizeProvider(input.provider);
  if (typeof input.model !== 'string' || !input.model.trim()) {
    throw new Error('provider tokenizer에는 model이 필요합니다');
  }
  if (typeof input.count !== 'function') {
    throw new Error('provider tokenizer에는 count 함수가 필요합니다');
  }
  const model = input.model.trim();
  const tokenizerRevision = normalizeOptionalString(input.tokenizerRevision);

  return Object.freeze({
    provider,
    model,
    ...(tokenizerRevision ? { tokenizerRevision } : {}),
    measurement: 'measured' as const,
    count(value: unknown, context?: ContextTokenCountContext): number {
      const tokens = input.count(value, context);
      if (!Number.isInteger(tokens) || tokens < 0) {
        throw new Error(
          `provider tokenizer count가 유효하지 않습니다: provider=${provider}, model=${model}`,
        );
      }
      return tokens;
    },
  });
}

/**
 * Load one externally supplied tokenizer module at the CLI composition root.
 * The module owns its provider SDK dependency; context-runtime only receives
 * the resulting neutral counter. Selection flags constrain, but never
 * override, the module's declared provider/model identity.
 */
export async function loadProviderTokenCounter(
  modulePath: string,
  selection: ProviderTokenCounterModuleSelection = {},
): Promise<ProviderTokenCounter> {
  if (!modulePath || modulePath === 'true') {
    throw new ProviderTokenCounterModuleError(
      'provider-tokenizer-module-invalid',
      '--tokenizer-module에는 ESM module 경로가 필요합니다',
    );
  }

  const resolvedPath = resolve(getRootDir(), modulePath);
  let imported: unknown;
  try {
    imported = await import(pathToFileURL(resolvedPath).href);
  } catch (error) {
    throw new ProviderTokenCounterModuleError(
      'provider-tokenizer-module-load-failed',
      `provider tokenizer module을 불러올 수 없습니다: ${modulePath}`,
      { cause: error },
    );
  }

  const registration = unwrapProviderTokenCounterModule(imported);
  const provider = normalizeModuleProvider(registration.provider);
  const model = requireModuleString(registration.model, 'model');
  const tokenizerRevision = normalizeOptionalString(registration.tokenizerRevision);

  const selectedProvider =
    selection.provider === undefined ? undefined : normalizeModuleProvider(selection.provider);
  const selectedModel = selection.model === undefined ? undefined : selection.model.trim();
  if (selectedModel === '') {
    throw new ProviderTokenCounterModuleError(
      'provider-tokenizer-selection-mismatch',
      '--tokenizer-model은 비어 있을 수 없습니다',
    );
  }
  if (
    (selectedProvider !== undefined && selectedProvider !== provider) ||
    (selectedModel !== undefined && selectedModel !== model)
  ) {
    throw new ProviderTokenCounterModuleError(
      'provider-tokenizer-selection-mismatch',
      `tokenizer module 선택이 선언값과 일치하지 않습니다: declared=${provider}/${model}`,
    );
  }

  return createProviderTokenCounter({
    provider,
    model,
    ...(tokenizerRevision ? { tokenizerRevision } : {}),
    count: registration.count,
  });
}

/**
 * Resolve a provider/model tokenizer from a composition-root JSON registry.
 * Registry module paths are relative to the registry file, while the module
 * itself remains responsible for importing the provider SDK.
 */
export async function loadProviderTokenCounterFromRegistry(
  registryPath: string,
  selection: ProviderTokenCounterModuleSelection = {},
): Promise<ProviderTokenCounter> {
  if (!registryPath || registryPath === 'true') {
    throw new ProviderTokenCounterModuleError(
      'provider-tokenizer-module-invalid',
      '--tokenizer-registry에는 JSON registry 경로가 필요합니다',
    );
  }

  const resolvedRegistryPath = resolve(getRootDir(), registryPath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(resolvedRegistryPath, 'utf8')) as unknown;
  } catch (error) {
    throw new ProviderTokenCounterModuleError(
      'provider-tokenizer-module-load-failed',
      `provider tokenizer registry를 읽을 수 없습니다: ${registryPath}`,
      { cause: error },
    );
  }

  const document = unwrapProviderTokenCounterRegistry(parsed);
  const entries = document.entries.map((entry, index) =>
    normalizeProviderTokenCounterRegistryEntry(entry, index),
  );
  const selectedProvider =
    selection.provider === undefined ? undefined : normalizeModuleProvider(selection.provider);
  const selectedModel = selection.model === undefined ? undefined : selection.model.trim();
  if (selectedModel === '') {
    throw new ProviderTokenCounterModuleError(
      'provider-tokenizer-selection-mismatch',
      '--tokenizer-model은 비어 있을 수 없습니다',
    );
  }

  const matches = entries.filter(
    (entry) =>
      (selectedProvider === undefined || entry.provider === selectedProvider) &&
      (selectedModel === undefined || entry.model === selectedModel),
  );
  if (matches.length !== 1) {
    throw new ProviderTokenCounterModuleError(
      'provider-tokenizer-selection-mismatch',
      matches.length === 0
        ? 'provider tokenizer registry에 일치하는 provider/model이 없습니다'
        : 'provider tokenizer registry 선택이 모호합니다: provider와 model을 지정해야 합니다',
    );
  }

  const entry = matches[0]!;
  const modulePath = resolve(dirname(resolvedRegistryPath), entry.module);
  const counter = await loadProviderTokenCounter(modulePath, {
    provider: entry.provider,
    model: entry.model,
  });
  if (
    entry.tokenizerRevision !== undefined &&
    counter.tokenizerRevision !== entry.tokenizerRevision
  ) {
    throw new ProviderTokenCounterModuleError(
      'provider-tokenizer-module-invalid',
      `registry tokenizerRevision과 module 선언값이 일치하지 않습니다: ${entry.provider}/${entry.model}`,
    );
  }
  return counter;
}

/**
 * Read a provider response usage envelope at the CLI composition root.
 *
 * No provider SDK is imported here. The adapter accepts the provider's
 * already-recorded response envelope and converts it into the neutral
 * context-runtime event, preserving measured totals and transport metrics.
 */
export function readProviderUsageEvent(
  path: string,
  provider?: string,
  phaseOverride?: string,
): ContextUsageEvent {
  if (!path || path === 'true') {
    throw new Error('--provider-usage에는 provider response JSON 파일 경로가 필요합니다');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(resolve(getRootDir(), path), 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`provider usage response를 읽을 수 없습니다: ${path}`, { cause: error });
  }

  if (!isRecord(parsed) && !Array.isArray(parsed)) {
    throw new Error(`provider usage response는 JSON object 또는 stream array여야 합니다: ${path}`);
  }
  const document = isRecord(parsed) ? (parsed as ProviderUsageDocument) : undefined;
  const selectedProvider = normalizeProvider(provider ?? stringValue(document?.provider));
  const adapter = createProviderUsageAdapter(selectedProvider);
  const phase = normalizePhase(document?.phase, phaseOverride);
  const requestBytes = numberValue(document?.requestBytes);
  const responseBytes = numberValue(document?.responseBytes);
  const bytes =
    numberValue(document?.bytes) ??
    (requestBytes !== undefined && responseBytes !== undefined
      ? requestBytes + responseBytes
      : undefined);
  const latencyMs = numberValue(firstDefined(document?.latencyMs, document?.latency_ms));
  const sourceRef = stringValue(document?.sourceRef);
  const routeKey = stringValue(document?.routeKey);

  return createProviderUsageEvent(
    adapter.toSnapshot(parsed, {
      phase,
      ...(bytes !== undefined ? { bytes } : {}),
      ...(latencyMs !== undefined ? { latencyMs } : {}),
      ...(sourceRef ? { sourceRef } : {}),
      ...(routeKey ? { routeKey } : {}),
    }),
  );
}

/**
 * Provider-specific response parsing stays at the composition root. The
 * returned snapshot is still provider-neutral before it enters context-runtime.
 */
export function createProviderUsageAdapter(provider: ProviderUsageProvider): ProviderUsageAdapter {
  switch (provider) {
    case 'openai':
      return Object.freeze({ provider, toSnapshot: toOpenAiSnapshot });
    case 'anthropic':
      return Object.freeze({ provider, toSnapshot: toAnthropicSnapshot });
    case 'generic':
      return Object.freeze({ provider, toSnapshot: toGenericSnapshot });
  }
}

function toOpenAiSnapshot(
  response: unknown,
  context: ProviderUsageAdapterContext,
): ProviderUsageSnapshot {
  const usage = findUsageObject(response, 'openai');
  return buildSnapshot('openai', context, {
    inputTokens: numberValue(
      firstDefined(usage.input_tokens, usage.prompt_tokens, usage.inputTokens),
    ),
    outputTokens: numberValue(
      firstDefined(usage.output_tokens, usage.completion_tokens, usage.outputTokens),
    ),
    totalTokens: numberValue(firstDefined(usage.total_tokens, usage.totalTokens)),
  });
}

function toAnthropicSnapshot(
  response: unknown,
  context: ProviderUsageAdapterContext,
): ProviderUsageSnapshot {
  const usage = Array.isArray(response)
    ? mergeAnthropicStreamUsage(response)
    : findUsageObject(response, 'anthropic');
  const rawInputTokens = numberValue(firstDefined(usage.input_tokens, usage.inputTokens)) ?? 0;
  const cacheCreationInputTokens =
    numberValue(usage.cache_creation_input_tokens) ??
    numberValue(usage.cacheCreationInputTokens) ??
    0;
  const cacheReadInputTokens =
    numberValue(usage.cache_read_input_tokens) ?? numberValue(usage.cacheReadInputTokens) ?? 0;
  const outputTokens = numberValue(firstDefined(usage.output_tokens, usage.outputTokens));
  const inputTokens = rawInputTokens + cacheCreationInputTokens + cacheReadInputTokens;
  const derivedTotalTokens = inputTokens + (outputTokens ?? 0);
  const reportedTotalTokens = numberValue(firstDefined(usage.total_tokens, usage.totalTokens));
  if (reportedTotalTokens !== undefined && reportedTotalTokens !== derivedTotalTokens) {
    throw new Error(
      `anthropic usage total mismatch: total_tokens=${reportedTotalTokens}, derived=${derivedTotalTokens}`,
    );
  }

  return buildSnapshot('anthropic', context, {
    inputTokens,
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    totalTokens: reportedTotalTokens ?? derivedTotalTokens,
  });
}

function toGenericSnapshot(
  response: unknown,
  context: ProviderUsageAdapterContext,
): ProviderUsageSnapshot {
  const usage = findUsageObject(response, 'generic');
  return buildSnapshot('generic', context, {
    inputTokens: numberValue(
      firstDefined(usage.input_tokens, usage.prompt_tokens, usage.inputTokens),
    ),
    outputTokens: numberValue(
      firstDefined(usage.output_tokens, usage.completion_tokens, usage.outputTokens),
    ),
    totalTokens: numberValue(firstDefined(usage.total_tokens, usage.totalTokens)),
  });
}

function buildSnapshot(
  provider: ProviderUsageProvider,
  context: ProviderUsageAdapterContext,
  usage: Pick<ProviderUsageSnapshot, 'inputTokens' | 'outputTokens' | 'totalTokens'>,
): ProviderUsageSnapshot {
  return {
    provider,
    phase: context.phase,
    ...(usage.inputTokens !== undefined ? { inputTokens: usage.inputTokens } : {}),
    ...(usage.outputTokens !== undefined ? { outputTokens: usage.outputTokens } : {}),
    ...(usage.totalTokens !== undefined ? { totalTokens: usage.totalTokens } : {}),
    ...(context.bytes !== undefined ? { bytes: context.bytes } : {}),
    ...(context.latencyMs !== undefined ? { latencyMs: context.latencyMs } : {}),
    ...(context.sourceRef !== undefined ? { sourceRef: context.sourceRef } : {}),
    ...(context.routeKey !== undefined ? { routeKey: context.routeKey } : {}),
  };
}

function findUsageObject(response: unknown, provider: ProviderUsageProvider): UsageObject {
  if (Array.isArray(response)) {
    for (const event of [...response].reverse()) {
      try {
        return findUsageObject(event, provider);
      } catch {
        // A stream may contain many non-usage events. The last usage-bearing
        // event is the authoritative provider total for OpenAI/generic streams.
      }
    }
    throw new Error(`${provider} provider usage stream에 usage token field가 없습니다`);
  }

  const paths: readonly (readonly string[])[] =
    provider === 'anthropic'
      ? [
          [],
          ['usage'],
          ['message', 'usage'],
          ['message_delta', 'usage'],
          ['body', 'usage'],
          ['response', 'body', 'usage'],
        ]
      : [[], ['usage'], ['body', 'usage'], ['response', 'body', 'usage']];

  for (const path of paths) {
    const candidate = pathValue(response, path);
    if (isRecord(candidate) && hasUsageField(candidate, provider)) {
      return candidate as UsageObject;
    }
  }

  throw new Error(`${provider} provider usage response에 usage token field가 없습니다`);
}

function mergeAnthropicStreamUsage(events: readonly unknown[]): UsageObject {
  let messageStart: UsageObject | undefined;
  let messageDelta: UsageObject | undefined;

  for (const event of events) {
    if (!isRecord(event)) continue;
    const startUsage =
      pathValue(event, ['message', 'usage']) ||
      (event.type === 'message_start' ? pathValue(event, ['usage']) : undefined);
    if (isRecord(startUsage) && hasUsageField(startUsage, 'anthropic')) {
      messageStart = startUsage as UsageObject;
    }
    const deltaUsage =
      pathValue(event, ['message_delta', 'usage']) ||
      (event.type === 'message_delta' ? pathValue(event, ['usage']) : undefined);
    if (isRecord(deltaUsage) && hasUsageField(deltaUsage, 'anthropic')) {
      messageDelta = deltaUsage as UsageObject;
    }
  }

  if (!messageStart && !messageDelta) {
    throw new Error('anthropic provider usage stream에 message usage가 없습니다');
  }

  return {
    input_tokens: firstDefined(messageDelta?.input_tokens, messageStart?.input_tokens),
    cache_creation_input_tokens: firstDefined(
      messageDelta?.cache_creation_input_tokens,
      messageStart?.cache_creation_input_tokens,
    ),
    cache_read_input_tokens: firstDefined(
      messageDelta?.cache_read_input_tokens,
      messageStart?.cache_read_input_tokens,
    ),
    output_tokens: firstDefined(messageDelta?.output_tokens, messageStart?.output_tokens),
    total_tokens: firstDefined(messageDelta?.total_tokens, messageStart?.total_tokens),
  };
}

function hasUsageField(value: Record<string, unknown>, provider: ProviderUsageProvider): boolean {
  if (provider === 'anthropic') {
    return [
      'input_tokens',
      'output_tokens',
      'cache_creation_input_tokens',
      'cache_read_input_tokens',
      'total_tokens',
      'inputTokens',
      'outputTokens',
      'totalTokens',
    ].some((key) => key in value);
  }
  return [
    'input_tokens',
    'prompt_tokens',
    'output_tokens',
    'completion_tokens',
    'total_tokens',
    'inputTokens',
    'outputTokens',
    'totalTokens',
  ].some((key) => key in value);
}

function pathValue(value: unknown, path: readonly string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function normalizeProvider(value: string | undefined): ProviderUsageProvider {
  if (value === 'openai' || value === 'anthropic' || value === 'generic') return value;
  throw new Error('--provider-usage에는 --provider openai|anthropic|generic이 필요합니다');
}

function normalizeModuleProvider(value: unknown): ProviderUsageProvider {
  if (value === 'openai' || value === 'anthropic' || value === 'generic') return value;
  throw new ProviderTokenCounterModuleError(
    'provider-tokenizer-module-invalid',
    'provider tokenizer module의 provider는 openai|anthropic|generic이어야 합니다',
  );
}

function requireModuleString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ProviderTokenCounterModuleError(
      'provider-tokenizer-module-invalid',
      `provider tokenizer module의 ${field}은(는) 비어 있을 수 없습니다`,
    );
  }
  return value.trim();
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) {
    throw new ProviderTokenCounterModuleError(
      'provider-tokenizer-module-invalid',
      'provider tokenizer module의 tokenizerRevision은 비어 있을 수 없습니다',
    );
  }
  return value.trim();
}

function unwrapProviderTokenCounterModule(value: unknown): ProviderTokenCounterModule {
  const candidate =
    isRecord(value) && 'default' in value
      ? value.default
      : isRecord(value) && 'providerTokenCounter' in value
        ? value.providerTokenCounter
        : value;
  if (
    !isRecord(candidate) ||
    typeof candidate.provider !== 'string' ||
    typeof candidate.model !== 'string' ||
    typeof candidate.count !== 'function'
  ) {
    throw new ProviderTokenCounterModuleError(
      'provider-tokenizer-module-invalid',
      'provider tokenizer module은 provider, model, count를 export해야 합니다',
    );
  }
  return candidate as unknown as ProviderTokenCounterModule;
}

function unwrapProviderTokenCounterRegistry(value: unknown): ProviderTokenCounterRegistryDocument {
  if (
    !isRecord(value) ||
    value.version !== 'v1' ||
    !Array.isArray(value.entries) ||
    value.entries.length === 0
  ) {
    throw new ProviderTokenCounterModuleError(
      'provider-tokenizer-module-invalid',
      'provider tokenizer registry는 version=v1과 하나 이상의 entries를 가져야 합니다',
    );
  }
  return value as unknown as ProviderTokenCounterRegistryDocument;
}

function normalizeProviderTokenCounterRegistryEntry(
  value: unknown,
  index: number,
): ProviderTokenCounterRegistryEntry {
  if (!isRecord(value)) {
    throw new ProviderTokenCounterModuleError(
      'provider-tokenizer-module-invalid',
      `provider tokenizer registry entries[${index}]가 object가 아닙니다`,
    );
  }
  const provider = normalizeModuleProvider(value.provider);
  const model = requireModuleString(value.model, `entries[${index}].model`);
  const module = requireModuleString(value.module, `entries[${index}].module`);
  const tokenizerRevision = normalizeOptionalString(value.tokenizerRevision);
  return {
    provider,
    model,
    module,
    ...(tokenizerRevision ? { tokenizerRevision } : {}),
  };
}

function normalizePhase(value: unknown, override?: string): ContextUsagePhase {
  if (value === 'discovery' || value === 'working') return value;
  if (value !== undefined) {
    throw new Error('provider usage response의 phase는 discovery 또는 working이어야 합니다');
  }
  if (override === 'discovery' || override === 'working') return override;
  throw new Error('--provider-phase discovery|working 또는 response의 phase가 필요합니다');
}

function getRootDir(): string {
  let current = process.cwd();
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml')) && existsSync(join(current, 'docs'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function firstDefined(...values: readonly unknown[]): unknown {
  return values.find((value) => value !== undefined);
}
