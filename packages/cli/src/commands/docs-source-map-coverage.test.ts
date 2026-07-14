// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { join } from 'node:path';

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildDocumentGraphIndex,
  collectDocumentGraphTraversalDocuments,
  createDefinitionMarkdownAdapter,
  traverseDocumentGraph,
  type DocumentEnvelope,
  type DocumentGraphIndex,
  type DocumentGraphTraversalResult,
} from '../lib/docs-control-plane/index.js';
import { cliDocs } from './docs.js';

const REPO_ROOT = join(import.meta.dirname, '../../../..');

const SOURCE_PATH_CASES = [
  {
    label: 'docs-control-plane',
    sourcePath: 'packages/cli/src/lib/docs-control-plane/prd-to-ralph-json.ts',
    expectedDocumentIds: ['document:docs-control-plane-prd'],
    expectedStableIds: ['docs-control-plane-prd'],
    maxDocumentCount: 3,
  },
  {
    label: 'ontology activation',
    sourcePath: 'packages/cli/src/commands/ontology/activation.ts',
    expectedDocumentIds: ['document:operational-ontology-registry-activation-cli'],
    expectedStableIds: ['operational-ontology-registry-activation-cli'],
    maxDocumentCount: 3,
  },
  {
    label: 'pack-core',
    sourcePath: 'packages/operational-ontology/src/internal/pack-core.ts',
    expectedDocumentIds: ['document:operational-ontology-pack-interface'],
    expectedStableIds: ['operational-ontology-pack-interface'],
    maxDocumentCount: 2,
  },
] as const;

const FULL_REPOSITORY_SENTINEL_DOCUMENT_IDS = [
  'document:system-root',
  'document:definition-catalog-spec',
  'document:tasks/prd-document-source-map-coverage-expansion',
] as const;

let definitionDocuments: readonly DocumentEnvelope[] = [];
let sourceIndex: DocumentGraphIndex | undefined;

beforeAll(async () => {
  const adapter = createDefinitionMarkdownAdapter({ rootDir: REPO_ROOT });
  definitionDocuments = await adapter.listDocuments();
  sourceIndex = buildDocumentGraphIndex(definitionDocuments, {
    rootDir: REPO_ROOT,
  });
}, 60_000);

describe('docs source-map coverage regression', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('traverses selected source paths to targeted documents without broad fallback', () => {
    for (const sourceCase of SOURCE_PATH_CASES) {
      const result = traverseSourcePath(sourceCase.sourcePath);
      const documentIds = traversalDocumentIds(result);

      expect(result.targetResolution.lookupKind, sourceCase.label).toBe('source-path');
      expect(result.targetResolution.indexed, sourceCase.label).toBe(true);
      expect(result.diagnostics, sourceCase.label).toEqual([]);
      expect(result.truncated, sourceCase.label).toBe(false);
      expect(
        result.edges.every((edge) => edge.axis === 'source'),
        sourceCase.label,
      ).toBe(true);
      expect(result.edgeCount, sourceCase.label).toBe(documentIds.length);
      expect(result.nodeCount, sourceCase.label).toBe(documentIds.length + 1);
      expect(documentIds, sourceCase.label).toEqual(
        expect.arrayContaining(sourceCase.expectedDocumentIds),
      );
      expect(documentIds.length, sourceCase.label).toBeLessThanOrEqual(sourceCase.maxDocumentCount);
      expect(documentIds, sourceCase.label).not.toEqual(
        expect.arrayContaining(FULL_REPOSITORY_SENTINEL_DOCUMENT_IDS),
      );

      const scoped = collectDocumentGraphTraversalDocuments(definitionDocuments, result);
      expect(
        scoped.documents.map((document) => document.stableId),
        sourceCase.label,
      ).toEqual(expect.arrayContaining(sourceCase.expectedStableIds));
      expect(scoped.documents.length, sourceCase.label).toBeLessThanOrEqual(
        sourceCase.maxDocumentCount,
      );
    }
  });

  it('returns bounded source-map-missing diagnostics for an uncovered source path', () => {
    const missingSourcePath = 'packages/cli/src/commands/__missing_for_test_only__.ts';
    const result = traverseSourcePath(missingSourcePath);

    expect(result.targetResolution).toMatchObject({
      lookupKind: 'source-path-missing',
      indexed: false,
    });
    expect(result.nodeCount).toBe(1);
    expect(result.edgeCount).toBe(0);
    expect(result.paths).toHaveLength(1);
    expect(result.truncated).toBe(false);
    expect(result.omittedCounts).toEqual({ nodes: 0, edges: 0, depth: 0 });
    expect(result.nodes).toEqual([
      expect.objectContaining({
        id: `source:${missingSourcePath}`,
        kind: 'source',
        metadata: expect.objectContaining({
          sourceMapCoverage: 'missing',
          synthetic: true,
        }),
      }),
    ]);
    expect(result.diagnostics).toEqual([
      `source-map-missing: No document source-map coverage found for ${missingSourcePath}.`,
    ]);
    expect(collectDocumentGraphTraversalDocuments(definitionDocuments, result).documents).toEqual(
      [],
    );
  });

  it('keeps source-path status and collect scoped to declaring documents', async () => {
    const sourcePath = 'packages/cli/src/lib/docs-control-plane/prd-to-ralph-json.ts';

    const status = await runDocsJson<StatusOutput>(['status', sourcePath]);
    expect(status.target).toBe(sourcePath);
    expect(status).not.toHaveProperty('document');
    expect(status.sourceTarget).toMatchObject({
      path: sourcePath,
      limitation: expect.stringContaining('does not scan the full repository'),
    });
    const statusStableIds = status.sourceTarget.matches.map((match) => match.document.stableId);
    expect(statusStableIds).toContain('docs-control-plane-prd');
    expect(statusStableIds.length).toBeGreaterThanOrEqual(1);
    expect(status.counts.documents).toBeGreaterThan(status.counts.familyMembers);
    expect(status.counts.familyMembers).toBeGreaterThanOrEqual(1);
    expect(status.counts.diagnostics).toBe(0);
    expect(status.diagnostics).toEqual([]);

    const collect = await runDocsJson<CollectOutput>(['collect', sourcePath]);
    const collectStableIds = collect.sourceTarget.matches.map((match) => match.document.stableId);
    expect(collectStableIds).toContain('docs-control-plane-prd');
    expect(collectStableIds.length).toBeGreaterThanOrEqual(1);
    expect(collect.familyMembers.length).toBeGreaterThanOrEqual(1);
    expect(collect.counts.documents).toBeGreaterThan(collect.counts.familyMembers);
    expect(collect.counts.familyMembers).toBeGreaterThanOrEqual(1);
    expect(collect.diagnostics).toEqual([]);
  }, 60_000);
});

function traverseSourcePath(sourcePath: string): DocumentGraphTraversalResult {
  if (!sourceIndex) throw new Error('source graph index was not initialized');
  return traverseDocumentGraph(sourceIndex, {
    target: sourcePath,
    axes: ['source'],
    direction: 'in',
    depth: 1,
  });
}

function traversalDocumentIds(result: DocumentGraphTraversalResult): readonly string[] {
  return result.nodes
    .map((node) => node.id)
    .filter((id) => id.startsWith('document:'))
    .toSorted();
}

async function runDocsJson<T>(args: readonly string[]): Promise<T> {
  vi.mocked(console.log).mockClear();
  vi.mocked(console.error).mockClear();
  process.exitCode = undefined;

  await cliDocs([...args, '--root', REPO_ROOT, '--json']);

  expect(errorOutput()).toBe('');
  expect(process.exitCode).toBeUndefined();
  return JSON.parse(output()) as T;
}

function output(): string {
  const spy = console.log as unknown as { mock: { calls: unknown[][] } };
  return spy.mock.calls.map((call) => String(call[0])).join('\n');
}

function errorOutput(): string {
  const spy = console.error as unknown as { mock: { calls: unknown[][] } };
  return spy.mock.calls.map((call) => String(call[0])).join('\n');
}

interface StatusOutput {
  readonly target: string;
  readonly sourceTarget: {
    readonly path: string;
    readonly limitation: string;
    readonly matches: readonly SourceTargetMatch[];
  };
  readonly counts: {
    readonly documents: number;
    readonly familyMembers: number;
    readonly diagnostics: number;
  };
  readonly diagnostics: readonly unknown[];
}

interface CollectOutput extends StatusOutput {
  readonly familyMembers: readonly {
    readonly stableId: string;
  }[];
}

interface SourceTargetMatch {
  readonly document: {
    readonly stableId: string;
    readonly path: string;
  };
}
