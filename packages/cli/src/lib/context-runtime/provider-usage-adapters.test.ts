// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createProviderTokenCounter,
  createProviderUsageAdapter,
  loadProviderTokenCounter,
  loadProviderTokenCounterFromRegistry,
  readProviderUsageEvent,
} from './provider-usage-adapters.js';

const context = {
  phase: 'discovery' as const,
  sourceRef: 'provider:test:response',
  routeKey: 'definition.document',
  bytes: 1_024,
  latencyMs: 12.5,
};

describe('provider usage adapters', () => {
  it('provider tokenizer adapter preserves provider/model and reports measured counts', () => {
    const contexts: unknown[] = [];
    const counter = createProviderTokenCounter({
      provider: 'openai',
      model: 'gpt-test',
      tokenizerRevision: 'fixture-v1',
      count: (_value, context) => {
        contexts.push(context);
        return 42;
      },
    });

    expect(counter).toMatchObject({
      provider: 'openai',
      model: 'gpt-test',
      tokenizerRevision: 'fixture-v1',
      measurement: 'measured',
    });
    expect(
      counter.count('working body', {
        phase: 'working',
        routeKey: 'definition.body',
        factKey: 'definition.body',
      }),
    ).toBe(42);
    expect(contexts).toEqual([
      { phase: 'working', routeKey: 'definition.body', factKey: 'definition.body' },
    ]);
  });

  it('[contract:docs-control-plane.definition-context.provider-tokenizer-module.v1] loads an external tokenizer module and preserves its identity', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa-sdk-provider-tokenizer-'));
    try {
      const modulePath = join(root, 'tokenizer.mjs');
      await writeFile(
        modulePath,
        `export default { provider: 'generic', model: 'fixture-model', tokenizerRevision: 'fixture-v1', count: () => 17 };\n`,
      );

      const counter = await loadProviderTokenCounter(modulePath, {
        provider: 'generic',
        model: 'fixture-model',
      });

      expect(counter).toMatchObject({
        provider: 'generic',
        model: 'fixture-model',
        tokenizerRevision: 'fixture-v1',
        measurement: 'measured',
      });
      expect(counter.count({ routeKey: 'definition.document' })).toBe(17);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('[contract:docs-control-plane.definition-context.provider-tokenizer-module.invalid-selection.v1] rejects a provider/model selection mismatch before counter creation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa-sdk-provider-tokenizer-'));
    try {
      const modulePath = join(root, 'tokenizer.mjs');
      await writeFile(
        modulePath,
        `export default { provider: 'generic', model: 'fixture-model', count: () => 17 };\n`,
      );

      await expect(
        loadProviderTokenCounter(modulePath, { provider: 'generic', model: 'wrong-model' }),
      ).rejects.toMatchObject({ code: 'provider-tokenizer-selection-mismatch' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects an explicitly empty model selection instead of treating it as omitted', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa-sdk-provider-tokenizer-'));
    try {
      const modulePath = join(root, 'tokenizer-empty-selection.mjs');
      await writeFile(
        modulePath,
        `export default { provider: 'generic', model: 'fixture-model', count: () => 17 };\n`,
      );

      await expect(loadProviderTokenCounter(modulePath, { model: '' })).rejects.toMatchObject({
        code: 'provider-tokenizer-selection-mismatch',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('[contract:docs-control-plane.definition-context.provider-tokenizer-module.invalid-export.v1] rejects a malformed tokenizer module export', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa-sdk-provider-tokenizer-'));
    try {
      const modulePath = join(root, 'invalid-tokenizer.mjs');
      await writeFile(
        modulePath,
        `export default { provider: 'generic', model: 'fixture-model' };\n`,
      );

      await expect(loadProviderTokenCounter(modulePath)).rejects.toMatchObject({
        code: 'provider-tokenizer-module-invalid',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('[contract:docs-control-plane.definition-context.provider-tokenizer-registry.v1] resolves one provider/model tokenizer from a registry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa-sdk-provider-tokenizer-registry-'));
    try {
      const modulePath = join(root, 'tokenizer.mjs');
      const registryPath = join(root, 'registry.json');
      await writeFile(
        modulePath,
        `export default { provider: 'generic', model: 'fixture-model', tokenizerRevision: 'fixture-v1', count: () => 17 };\n`,
      );
      await writeFile(
        registryPath,
        JSON.stringify({
          version: 'v1',
          entries: [
            {
              provider: 'generic',
              model: 'fixture-model',
              module: './tokenizer.mjs',
              tokenizerRevision: 'fixture-v1',
            },
          ],
        }),
      );

      const counter = await loadProviderTokenCounterFromRegistry(registryPath, {
        provider: 'generic',
        model: 'fixture-model',
      });

      expect(counter).toMatchObject({
        provider: 'generic',
        model: 'fixture-model',
        tokenizerRevision: 'fixture-v1',
        measurement: 'measured',
      });
      expect(counter.count({ routeKey: 'definition.document' })).toBe(17);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('[contract:docs-control-plane.definition-context.provider-tokenizer-registry.invalid-selection.v1] rejects an ambiguous registry selection', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa-sdk-provider-tokenizer-registry-'));
    try {
      const registryPath = join(root, 'registry.json');
      await writeFile(
        registryPath,
        JSON.stringify({
          version: 'v1',
          entries: [
            { provider: 'generic', model: 'fixture-model-a', module: './a.mjs' },
            { provider: 'generic', model: 'fixture-model-b', module: './b.mjs' },
          ],
        }),
      );

      await expect(
        loadProviderTokenCounterFromRegistry(registryPath, { provider: 'generic' }),
      ).rejects.toMatchObject({ code: 'provider-tokenizer-selection-mismatch' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('provider tokenizer adapter rejects malformed counts', () => {
    const counter = createProviderTokenCounter({
      provider: 'anthropic',
      model: 'claude-test',
      count: () => 1.5,
    });

    expect(() => counter.count('body')).toThrow('provider tokenizer count가 유효하지 않습니다');
  });

  it('OpenAI Responses envelope keeps input/output/total usage exact', () => {
    const snapshot = createProviderUsageAdapter('openai').toSnapshot(
      {
        usage: {
          input_tokens: 100,
          output_tokens: 25,
          total_tokens: 125,
          input_tokens_details: { cached_tokens: 40 },
        },
      },
      context,
    );

    expect(snapshot).toEqual({
      provider: 'openai',
      phase: 'discovery',
      inputTokens: 100,
      outputTokens: 25,
      totalTokens: 125,
      bytes: 1_024,
      latencyMs: 12.5,
      sourceRef: 'provider:test:response',
      routeKey: 'definition.document',
    });
  });

  it('OpenAI batch response envelope resolves response.body.usage', () => {
    const snapshot = createProviderUsageAdapter('openai').toSnapshot(
      {
        response: {
          body: {
            usage: { prompt_tokens: 80, completion_tokens: 20, total_tokens: 100 },
          },
        },
      },
      { phase: 'working' },
    );

    expect(snapshot).toMatchObject({
      provider: 'openai',
      phase: 'working',
      inputTokens: 80,
      outputTokens: 20,
      totalTokens: 100,
    });
  });

  it('OpenAI stream resolves the last usage-bearing event', () => {
    const snapshot = createProviderUsageAdapter('openai').toSnapshot(
      [
        { choices: [{ delta: { content: 'hello' } }] },
        { choices: [], usage: { input_tokens: 30, output_tokens: 8, total_tokens: 38 } },
      ],
      context,
    );

    expect(snapshot).toMatchObject({ inputTokens: 30, outputTokens: 8, totalTokens: 38 });
  });

  it('CLI composition root accepts an OpenAI stream JSON array', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa-sdk-provider-usage-'));
    try {
      const path = join(root, 'openai-stream.json');
      await writeFile(
        path,
        JSON.stringify([
          { choices: [{ delta: { content: 'hello' } }] },
          { choices: [], usage: { input_tokens: 30, output_tokens: 8, total_tokens: 38 } },
        ]),
      );

      const event = readProviderUsageEvent(path, 'openai', 'discovery');

      expect(event).toMatchObject({
        provider: 'openai',
        phase: 'discovery',
        tokens: 38,
        measurement: 'measured',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('Anthropic Messages usage counts uncached and cache input tokens', () => {
    const snapshot = createProviderUsageAdapter('anthropic').toSnapshot(
      {
        usage: {
          input_tokens: 50,
          cache_creation_input_tokens: 10,
          cache_read_input_tokens: 1_000,
          output_tokens: 20,
        },
      },
      context,
    );

    expect(snapshot).toMatchObject({
      provider: 'anthropic',
      inputTokens: 1_060,
      outputTokens: 20,
      totalTokens: 1_080,
    });
  });

  it('Anthropic message_start envelope resolves nested usage', () => {
    const snapshot = createProviderUsageAdapter('anthropic').toSnapshot(
      {
        type: 'message_start',
        message: {
          usage: { input_tokens: 12, output_tokens: 0 },
        },
      },
      context,
    );

    expect(snapshot).toMatchObject({
      provider: 'anthropic',
      inputTokens: 12,
      outputTokens: 0,
      totalTokens: 12,
    });
  });

  it('Anthropic stream combines message_start input/cache and cumulative delta output', () => {
    const snapshot = createProviderUsageAdapter('anthropic').toSnapshot(
      [
        {
          type: 'message_start',
          message: {
            usage: {
              input_tokens: 50,
              cache_creation_input_tokens: 10,
              cache_read_input_tokens: 1_000,
              output_tokens: 0,
            },
          },
        },
        {
          type: 'message_delta',
          usage: { output_tokens: 20 },
        },
      ],
      context,
    );

    expect(snapshot).toMatchObject({ inputTokens: 1_060, outputTokens: 20, totalTokens: 1_080 });
  });

  it('generic envelope remains provider-neutral', () => {
    const snapshot = createProviderUsageAdapter('generic').toSnapshot(
      { usage: { inputTokens: 7, outputTokens: 3, totalTokens: 10 } },
      { phase: 'working' },
    );

    expect(snapshot).toEqual({
      provider: 'generic',
      phase: 'working',
      inputTokens: 7,
      outputTokens: 3,
      totalTokens: 10,
    });
  });

  it('Anthropic reported total mismatch fails closed', () => {
    expect(() =>
      createProviderUsageAdapter('anthropic').toSnapshot(
        {
          usage: {
            input_tokens: 5,
            cache_read_input_tokens: 10,
            output_tokens: 2,
            total_tokens: 16,
          },
        },
        context,
      ),
    ).toThrow('anthropic usage total mismatch');
  });
});
