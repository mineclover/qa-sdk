// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, expect, it, vi } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { useDefCliHarness } from './def-test-helpers.js';

describe('def context and handoff commands', () => {
  const { getOutput, getTempRoot, runDef } = useDefCliHarness();

it('[contract:docs-control-plane.definition-context.bounded-consumer.v1] 기존 context와 bounded context를 함께 제공한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      await runDef(['context', 'definition-addressing']);
      expect(getOutput()).toContain('# 컨텍스트:');

      vi.mocked(console.log).mockClear();
      await runDef(['context', 'definition-addressing', '--bounded', '--json']);
      const bounded = JSON.parse(getOutput()) as {
        mode: string;
        discovery: { selectedRouteKeys: string[] };
        workingContext: { status: string; facts: Array<{ factKey: string; revision: string }> };
        manifest: { digest: string; canonicalJson: string };
        observation: { eventName: string };
      };

      expect(bounded.mode).toBe('bounded');
      expect(bounded.discovery.selectedRouteKeys.length).toBeGreaterThan(0);
      expect(bounded.workingContext.status).toBe('closed');
      expect(bounded.workingContext.facts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ factKey: 'definition.document', revision: expect.any(String) }),
        ]),
      );
      expect(bounded.manifest.digest).toMatch(/^fnv1a64:/);
      expect(bounded.manifest.canonicalJson).not.toContain('Definition Addressing');
      expect(bounded.observation.eventName).toBe('context_runtime_observation');
    });

    it('[contract:docs-control-plane.definition-context.bounded-blocked.v1] Discovery cap에서 Working Context와 manifest를 차단한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      await runDef([
        'context',
        'definition-addressing',
        '--bounded',
        '--used-tokens',
        '100000',
        '--json',
      ]);
      const bounded = JSON.parse(getOutput()) as {
        discovery: {
          status: string;
          selectedRouteKeys: string[];
          workingReserveTokens: number;
          nextAction: string;
          decomposition?: { parentTaskKey: string; children: Array<{ routeKeys: string[] }> };
        };
        workingContext: { status: string; diagnostics: Array<{ code: string }> };
        manifest?: unknown;
        observation: { status: string; manifestDigest?: string };
      };

      expect(bounded.discovery.status).toBe('discovery-capped');
      expect(bounded.discovery.selectedRouteKeys).toHaveLength(0);
      expect(bounded.discovery.workingReserveTokens).toBe(100000);
      expect(bounded.discovery.nextAction).toBe('decompose');
      expect(bounded.discovery.decomposition).toMatchObject({
        parentTaskKey: 'definition-context:definition-addressing',
        children: expect.arrayContaining([
          expect.objectContaining({
            routeKeys: expect.arrayContaining(['definition.document.authoritative']),
          }),
        ]),
      });
      expect(bounded.workingContext.status).toBe('blocked');
      expect(bounded.workingContext.diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'route-not-selected' })]),
      );
      expect(bounded.manifest).toBeUndefined();
      expect(bounded.observation.status).toBe('blocked');
      expect(bounded.observation.manifestDigest).toBeUndefined();
    });

    it('[contract:docs-control-plane.definition-context.usage-input.v1] 외부 measured usage summary를 Discovery budget에 적용한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const usagePath = join(getTempRoot(), 'measured-usage.json');
      await writeFile(
        usagePath,
        JSON.stringify({
          events: [
            {
              phase: 'discovery',
              tokens: 99_999,
              measurement: 'measured',
              sourceRef: 'provider:measured',
            },
          ],
          discoveryTokens: 99_999,
          workingTokens: 0,
          totalTokens: 99_999,
          measurement: 'measured',
        }),
      );

      await runDef([
        'context',
        'definition-addressing',
        '--bounded',
        '--initial-usage',
        usagePath,
        '--json',
      ]);

      const bounded = JSON.parse(getOutput()) as {
        discovery: { status: string; selectedRouteKeys: string[] };
        usage: { discoveryTokens: number; measurement: string };
      };
      expect(bounded.discovery.status).toBe('discovery-capped');
      expect(bounded.discovery.selectedRouteKeys).toHaveLength(0);
      expect(bounded.usage).toMatchObject({ discoveryTokens: 99_999, measurement: 'measured' });
    });

    it('[contract:docs-control-plane.definition-context.usage-input.v1] usage summary 합계가 event와 다르면 주입을 거부한다', async () => {
      await runDef(['sync']);
      const usagePath = join(getTempRoot(), 'invalid-usage.json');
      await writeFile(
        usagePath,
        JSON.stringify({
          events: [{ phase: 'discovery', tokens: 10, measurement: 'measured' }],
          discoveryTokens: 99_999,
          workingTokens: 0,
          totalTokens: 99_999,
          measurement: 'measured',
        }),
      );

      await expect(
        runDef([
          'context',
          'definition-addressing',
          '--bounded',
          '--initial-usage',
          usagePath,
          '--json',
        ]),
      ).rejects.toThrow('initialUsage summary');
    });

    it('[contract:docs-control-plane.definition-context.usage-input.v1] provider response usage를 measured event로 연결한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const usagePath = join(getTempRoot(), 'openai-usage.json');
      await writeFile(
        usagePath,
        JSON.stringify({
          provider: 'openai',
          phase: 'discovery',
          usage: { prompt_tokens: 99_999, completion_tokens: 0, total_tokens: 99_999 },
          bytes: 4_096,
          latency_ms: 12.5,
          sourceRef: 'provider:openai:response',
        }),
      );

      await runDef([
        'context',
        'definition-addressing',
        '--bounded',
        '--provider-usage',
        usagePath,
        '--provider',
        'openai',
        '--json',
      ]);

      const bounded = JSON.parse(getOutput()) as {
        discovery: { status: string };
        usage: {
          discoveryTokens: number;
          measurement: string;
          metrics: { bytes: number; latencyMs: number };
          events: Array<{ provider?: string; tokens: number }>;
        };
      };
      expect(bounded.discovery.status).toBe('discovery-capped');
      expect(bounded.usage).toMatchObject({
        discoveryTokens: 99_999,
        measurement: 'measured',
        metrics: { bytes: 4_096, latencyMs: 12.5 },
      });
      expect(bounded.usage.events[0]).toMatchObject({ provider: 'openai', tokens: 99_999 });
    });

    it('[contract:docs-control-plane.definition-context.usage-input.v1] provider phase가 없으면 override를 요구한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const usagePath = join(getTempRoot(), 'provider-usage-without-phase.json');
      await writeFile(
        usagePath,
        JSON.stringify({
          provider: 'generic',
          usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
        }),
      );

      await expect(
        runDef([
          'context',
          'definition-addressing',
          '--bounded',
          '--provider-usage',
          usagePath,
          '--provider',
          'generic',
          '--json',
        ]),
      ).rejects.toThrow('--provider-phase');

      vi.mocked(console.log).mockClear();
      await runDef([
        'context',
        'definition-addressing',
        '--bounded',
        '--provider-usage',
        usagePath,
        '--provider',
        'generic',
        '--provider-phase',
        'working',
        '--json',
      ]);
      const bounded = JSON.parse(getOutput()) as {
        usage: { events: Array<{ phase: string; provider?: string }> };
      };
      expect(bounded.usage.events[0]).toMatchObject({ phase: 'working', provider: 'generic' });
    });

    it('[contract:docs-control-plane.definition-context.provider-tokenizer-module.v1] 외부 tokenizer module을 bounded runtime에 연결한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const modulePath = join(getTempRoot(), 'provider-tokenizer.mjs');
      await writeFile(
        modulePath,
        `export default { provider: 'generic', model: 'fixture-model', tokenizerRevision: 'fixture-v1', count: () => 1 };\n`,
      );

      await runDef([
        'context',
        'definition-addressing',
        '--bounded',
        '--tokenizer-module',
        modulePath,
        '--tokenizer-provider',
        'generic',
        '--tokenizer-model',
        'fixture-model',
        '--json',
      ]);

      const bounded = JSON.parse(getOutput()) as {
        tokenCounter?: { provider: string; model: string; tokenizerRevision: string };
        usage: {
          measurement: string;
          events: Array<{
            measurement: string;
            provider?: string;
            model?: string;
            tokenizerRevision?: string;
          }>;
        };
      };
      expect(bounded.tokenCounter).toEqual({
        provider: 'generic',
        model: 'fixture-model',
        tokenizerRevision: 'fixture-v1',
      });
      expect(bounded.usage.measurement).toBe('measured');
      expect(bounded.usage.events.every((event) => event.measurement === 'measured')).toBe(true);
      expect(
        bounded.usage.events.every(
          (event) =>
            event.provider === 'generic' &&
            event.model === 'fixture-model' &&
            event.tokenizerRevision === 'fixture-v1',
        ),
      ).toBe(true);
    });

    it('[contract:docs-control-plane.definition-context.provider-tokenizer-module.invalid-selection.v1] tokenizer 선택 불일치 시 bounded 실행을 시작하지 않는다', async () => {
      await runDef(['sync']);
      const modulePath = join(getTempRoot(), 'provider-tokenizer-mismatch.mjs');
      await writeFile(
        modulePath,
        `export default { provider: 'generic', model: 'fixture-model', count: () => 1 };\n`,
      );

      await expect(
        runDef([
          'context',
          'definition-addressing',
          '--bounded',
          '--tokenizer-module',
          modulePath,
          '--tokenizer-model',
          'wrong-model',
          '--json',
        ]),
      ).rejects.toMatchObject({ code: 'provider-tokenizer-selection-mismatch' });
    });

    it('[contract:docs-control-plane.definition-context.provider-tokenizer-registry.v1] provider/model registry에서 외부 tokenizer module을 선택한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const modulePath = join(getTempRoot(), 'provider-tokenizer-registry.mjs');
      const registryPath = join(getTempRoot(), 'provider-tokenizer-registry.json');
      await writeFile(
        modulePath,
        `export default { provider: 'generic', model: 'fixture-model', tokenizerRevision: 'fixture-v1', count: () => 1 };\n`,
      );
      await writeFile(
        registryPath,
        JSON.stringify({
          version: 'v1',
          entries: [
            {
              provider: 'generic',
              model: 'fixture-model',
              module: './provider-tokenizer-registry.mjs',
              tokenizerRevision: 'fixture-v1',
            },
          ],
        }),
      );

      await runDef([
        'context',
        'definition-addressing',
        '--bounded',
        '--tokenizer-registry',
        registryPath,
        '--tokenizer-provider',
        'generic',
        '--tokenizer-model',
        'fixture-model',
        '--json',
      ]);

      const bounded = JSON.parse(getOutput()) as {
        tokenCounter?: { provider: string; model: string; tokenizerRevision: string };
        usage: { measurement: string };
      };
      expect(bounded.tokenCounter).toEqual({
        provider: 'generic',
        model: 'fixture-model',
        tokenizerRevision: 'fixture-v1',
      });
      expect(bounded.usage.measurement).toBe('measured');
    });

    it('[contract:docs-control-plane.definition-context.handoff-persistence.v1] 닫힌 bounded context의 Typed Handoff를 로컬 store에 저장한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const handoffPath = join(getTempRoot(), 'handoffs', 'definition.json');

      await runDef([
        'context',
        'definition-addressing',
        '--bounded',
        '--handoff-out',
        handoffPath,
        '--result-revision',
        'review:definition-addressing:1',
        '--unresolved-questions',
        'split-body,confirm-owner',
        '--next-task-key',
        'definition-review',
        '--next-task-objective',
        'Review the definition boundary',
        '--json',
      ]);

      const output = JSON.parse(getOutput()) as {
        handoff: {
          taskKey: string;
          sourceRevision: string;
          resultRevision: string;
          unresolvedQuestions: string[];
          nextTask?: { taskKey: string };
        };
      };
      expect(output.handoff).toMatchObject({
        taskKey: 'definition-context:definition-addressing',
        sourceRevision: expect.stringContaining('definition-addressing:revision:'),
        resultRevision: 'review:definition-addressing:1',
        unresolvedQuestions: ['confirm-owner', 'split-body'],
        nextTask: { taskKey: 'definition-review' },
      });
      const persisted = JSON.parse(await readFile(handoffPath, 'utf8')) as {
        version: string;
        handoffs: Array<{ manifestDigest: string }>;
      };
      expect(persisted.version).toBe('v1');
      expect(persisted.handoffs).toHaveLength(1);
      expect(persisted.handoffs[0]?.manifestDigest).toMatch(/^fnv1a64:/);

      vi.mocked(console.log).mockClear();
      await runDef(['handoff', handoffPath, 'definition-context:definition-addressing', '--json']);
      const history = JSON.parse(getOutput()) as Array<{ resultRevision: string }>;
      expect(history).toHaveLength(1);
      expect(history[0]?.resultRevision).toBe('review:definition-addressing:1');
    });

    it('[contract:docs-control-plane.definition-context.handoff-persistence.v1] result revision과 닫힌 Working Context 없이는 Handoff를 저장하지 않는다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const handoffPath = join(getTempRoot(), 'handoffs', 'blocked.json');

      await expect(
        runDef([
          'context',
          'definition-addressing',
          '--bounded',
          '--handoff-out',
          handoffPath,
          '--json',
        ]),
      ).rejects.toThrow('--result-revision');

      await expect(
        runDef([
          'context',
          'definition-addressing',
          '--bounded',
          '--used-tokens',
          '100000',
          '--handoff-out',
          handoffPath,
          '--result-revision',
          'review:blocked',
          '--json',
        ]),
      ).rejects.toThrow('닫힌 Working Context');

      await expect(readFile(handoffPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('[contract:docs-control-plane.definition-context.handoff-aggregation.v1] child Handoff를 parent Handoff로 집계한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const handoffPath = join(getTempRoot(), 'handoffs', 'children.json');
      const decompositionPath = join(getTempRoot(), 'decomposition.json');
      const parentTaskKey = 'definition-context:parent';
      const childTaskKeys = [`${parentTaskKey}/discovery/a`, `${parentTaskKey}/discovery/b`];

      await mkdir(join(getTempRoot(), 'handoffs'), { recursive: true });

      await writeFile(
        decompositionPath,
        JSON.stringify({
          parentTaskKey,
          reason: 'budget-exhausted',
          children: childTaskKeys.map((taskKey, index) => ({
            taskKey,
            objective: `Inspect ${index}`,
            anchor: { anchorKey: 'definition:parent', ref: 'definition:parent', kind: 'entity' },
            routeKeys: [`route.${index}`],
            estimatedCostTokens: 1_000,
            estimatedObjectCount: 1,
            estimatedRelationCount: 1,
          })),
        }),
      );
      await writeFile(
        handoffPath,
        JSON.stringify({
          version: 'v1',
          handoffs: childTaskKeys.map((taskKey, index) => ({
            version: 'v1',
            taskKey,
            sourceRevision: `source:${index}`,
            resultRevision: `result:${index}`,
            manifestDigest: `fnv1a64:child-${index}`,
            factRefs: [
              {
                factKey: `definition.fact.${index}`,
                revision: 'definition:42',
                evidenceRefs: [`definition:evidence:${index}`],
              },
            ],
            evidenceRefs: [`definition:evidence:${index}`],
            unresolvedQuestions: [`question:${index}`],
          })),
        }),
      );

      await runDef([
        'handoff-aggregate',
        handoffPath,
        decompositionPath,
        '--source-revision',
        'parent-source:42',
        '--result-revision',
        'parent-result:7',
        '--json',
      ]);

      const output = JSON.parse(getOutput()) as {
        taskKey: string;
        childTaskKeys: string[];
        factRefs: Array<{ factKey: string }>;
      };
      expect(output).toMatchObject({
        taskKey: parentTaskKey,
        childTaskKeys,
        factRefs: [{ factKey: 'definition.fact.0' }, { factKey: 'definition.fact.1' }],
      });

      const persisted = JSON.parse(await readFile(handoffPath, 'utf8')) as {
        handoffs: Array<{ taskKey: string; childTaskKeys?: string[] }>;
      };
      expect(persisted.handoffs).toHaveLength(3);
      expect(persisted.handoffs.find((handoff) => handoff.taskKey === parentTaskKey)).toMatchObject(
        {
          childTaskKeys,
        },
      );
    });

    it('[contract:docs-control-plane.definition-context.discovery-result-policy.v1] discovery child는 refs로 분리하고 resolution child만 parent Handoff에 포함한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const handoffPath = join(getTempRoot(), 'handoffs', 'mixed.json');
      const decompositionPath = join(getTempRoot(), 'mixed-decomposition.json');
      const discoveryResultsPath = join(getTempRoot(), 'discovery-results.json');
      const parentTaskKey = 'definition-context:mixed-parent';
      const discoveryTaskKey = `${parentTaskKey}/discovery/graph`;
      const resolutionTaskKey = `${parentTaskKey}/discovery/resolution`;

      await mkdir(join(getTempRoot(), 'handoffs'), { recursive: true });
      await writeFile(
        decompositionPath,
        JSON.stringify({
          parentTaskKey,
          reason: 'budget-exhausted',
          children: [
            {
              taskKey: discoveryTaskKey,
              objective: 'Inspect definition graph references',
              anchor: { anchorKey: 'definition:parent', ref: 'definition:parent', kind: 'entity' },
              routeKeys: ['route.graph'],
              estimatedCostTokens: 1_000,
              estimatedObjectCount: 1,
              estimatedRelationCount: 1,
            },
            {
              taskKey: resolutionTaskKey,
              objective: 'Resolve authoritative definition facts',
              anchor: { anchorKey: 'definition:parent', ref: 'definition:parent', kind: 'entity' },
              routeKeys: ['route.resolution'],
              estimatedCostTokens: 1_000,
              estimatedObjectCount: 1,
              estimatedRelationCount: 1,
            },
          ],
        }),
      );
      await writeFile(
        discoveryResultsPath,
        JSON.stringify({
          discoveryRefs: [
            {
              taskKey: discoveryTaskKey,
              routeKeys: ['route.graph'],
              sourceRefs: ['definition:graph:42'],
              unresolvedQuestions: ['confirm-graph-owner'],
            },
          ],
          unresolvedQuestions: ['confirm-parent-owner'],
        }),
      );
      await writeFile(
        handoffPath,
        JSON.stringify({
          version: 'v1',
          handoffs: [
            {
              version: 'v1',
              taskKey: resolutionTaskKey,
              sourceRevision: 'source:resolution',
              resultRevision: 'result:resolution',
              manifestDigest: 'fnv1a64:resolution',
              factRefs: [
                {
                  factKey: 'definition.fact.resolution',
                  revision: 'definition:42',
                  evidenceRefs: ['definition:evidence:resolution'],
                },
              ],
              evidenceRefs: ['definition:evidence:resolution'],
              unresolvedQuestions: ['confirm-resolution-owner'],
            },
          ],
        }),
      );

      await runDef([
        'handoff-aggregate',
        handoffPath,
        decompositionPath,
        '--discovery-results',
        discoveryResultsPath,
        '--source-revision',
        'parent-source:mixed',
        '--result-revision',
        'parent-result:mixed',
        '--json',
      ]);

      const output = JSON.parse(getOutput()) as {
        handoff: { taskKey: string; childTaskKeys: string[]; factRefs: Array<{ factKey: string }> };
        discoveryRefs: Array<{ taskKey: string; sourceRefs: string[] }>;
        unresolvedQuestions: string[];
      };
      expect(output.handoff).toMatchObject({
        taskKey: parentTaskKey,
        childTaskKeys: [resolutionTaskKey],
        factRefs: [{ factKey: 'definition.fact.resolution' }],
      });
      expect(output.discoveryRefs).toEqual([
        {
          taskKey: discoveryTaskKey,
          routeKeys: ['route.graph'],
          sourceRefs: ['definition:graph:42'],
        },
      ]);
      expect(output.unresolvedQuestions).toEqual([
        'confirm-graph-owner',
        'confirm-parent-owner',
        'confirm-resolution-owner',
      ]);
    });
});
