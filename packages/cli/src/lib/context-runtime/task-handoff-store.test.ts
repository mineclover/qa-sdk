// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, afterEach } from 'vitest';
import { createContextManifest, createTaskHandoff } from 'context-runtime';
import type { TaskHandoff, WorkingContext } from 'context-runtime';
import { JsonTaskHandoffStore } from './task-handoff-store.js';

const context: WorkingContext = {
  status: 'closed',
  taskKey: 'definition-context:definition-addressing',
  routeSelection: {
    selectedRouteKeys: ['definition.document.authoritative'],
    frozenAt: '2026-07-24T00:00:00.000Z',
    manifestDigest: 'fnv1a64:route-selection',
  },
  facts: [
    {
      factKey: 'definition.document',
      resolutionRouteKey: 'definition.document.authoritative',
      value: { docId: 'definition-addressing' },
      authority: 'authoritative',
      observedAt: '2026-07-24T00:00:00.000Z',
      revision: 'definition:definition-addressing:42',
      evidenceRefs: ['definition:def_document:v2:342161'],
    },
  ],
  allowedOperations: ['read-definition-context'],
  outputContract: {
    contractKey: 'definition-context.v1',
    description: 'Bounded definition context',
    requiredFields: ['definition.document'],
  },
  diagnostics: [],
};

describe('JsonTaskHandoffStore', () => {
  let tempRoot = '';

  afterEach(async () => {
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
    tempRoot = '';
  });

  async function createStore(): Promise<JsonTaskHandoffStore> {
    tempRoot = await mkdtemp(join(tmpdir(), 'qa-sdk-handoff-'));
    return new JsonTaskHandoffStore(join(tempRoot, 'nested', 'handoffs.json'));
  }

  it('[contract:context-runtime.handoff.persistence.v1] persists and retrieves reference-only task history', async () => {
    const store = await createStore();
    const manifest = createContextManifest({
      workingContext: context,
      snapshotRef: 'definition:definition-addressing:revision:42',
    });
    const first = createTaskHandoff({
      workingContext: context,
      manifest,
      sourceRevision: 'definition:definition-addressing:revision:42',
      resultRevision: 'review:1',
      unresolvedQuestions: ['Should the body be split?'],
    });
    const second = createTaskHandoff({
      workingContext: context,
      manifest,
      sourceRevision: 'definition:definition-addressing:revision:42',
      resultRevision: 'review:2',
      unresolvedQuestions: [],
    });

    await store.save(first);
    await store.save(first);
    await store.save(second);

    const history = await store.findByTaskKey(context.taskKey);
    expect(history.map((handoff) => handoff.resultRevision)).toEqual(['review:1', 'review:2']);
    expect(history[0]).not.toHaveProperty('conversationTranscript');

    const persisted = JSON.parse(
      await readFile(join(tempRoot, 'nested', 'handoffs.json'), 'utf8'),
    ) as { version: string; handoffs: unknown[] };
    expect(persisted.version).toBe('v1');
    expect(persisted.handoffs).toHaveLength(2);
    expect(JSON.stringify(persisted)).not.toContain('conversationTranscript');
  });

  it('[contract:context-runtime.handoff.persistence.v1] rejects a corrupt persisted envelope', async () => {
    const store = await createStore();
    const path = join(tempRoot, 'nested', 'handoffs.json');
    await mkdir(join(tempRoot, 'nested'), { recursive: true });
    await writeFile(path, JSON.stringify({ version: 'v0', handoffs: [] }), 'utf8');

    await expect(store.findByTaskKey(context.taskKey)).rejects.toThrow('v1');
  });

  it('[contract:context-runtime.handoff.aggregate.v1] persists parent child Task references without Fact values', async () => {
    const store = await createStore();
    const parent: TaskHandoff = {
      version: 'v1',
      taskKey: 'definition-context:parent',
      sourceRevision: 'source:42',
      resultRevision: 'result:7',
      manifestDigest: 'fnv1a64:parent',
      factRefs: [
        {
          factKey: 'definition.document',
          revision: 'definition:42',
          evidenceRefs: ['definition:doc:42'],
        },
      ],
      evidenceRefs: ['definition:doc:42'],
      unresolvedQuestions: [],
      childTaskKeys: [
        'definition-context:parent/discovery/a',
        'definition-context:parent/discovery/b',
      ],
    };

    await store.save(parent);
    const history = await store.findByTaskKey(parent.taskKey);

    expect(history[0]).toMatchObject({
      taskKey: parent.taskKey,
      childTaskKeys: parent.childTaskKeys,
    });
    expect(JSON.stringify(history[0])).not.toContain('conversationTranscript');
    expect(JSON.stringify(history[0])).not.toContain('Fact value');
  });
});
