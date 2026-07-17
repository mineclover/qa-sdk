import { describe, expect, it } from 'vitest';
import type { CodeReferenceRecord, DocRecord } from '../../core/types.js';
import type { DocsService } from '../docs/docs.service.js';
import { GraphService } from './graph.service.js';

function doc(docId: string, tier: DocRecord['tier'] = 'component'): DocRecord {
  return {
    docId,
    title: docId,
    tier,
    scope: 'data',
    aspect: 'domain_data',
    depth: 'overview',
    lifecycle: 'approved',
    tags: [],
    links: [],
    version: 1,
    bodyHash: `${docId}-hash`,
    syncedAt: '2026-07-15T00:00:00.000Z',
  };
}

function reference(
  docId: string,
  relationType: CodeReferenceRecord['relationType'],
  sourceKind: CodeReferenceRecord['sourceKind'],
  symbol?: string,
): CodeReferenceRecord {
  return {
    codePath: 'packages/demo/src/index.ts',
    docId,
    relationType,
    sourceKind,
    ...(symbol ? { symbol } : {}),
  };
}

function validate(docs: readonly DocRecord[], references: readonly CodeReferenceRecord[]) {
  const dataSource = {
    list: () => [...docs],
    getOutgoingLinks: () => [],
    listCodeReferences: () => [...references],
  };
  return new GraphService(dataSource as unknown as DocsService).validate();
}

describe('GraphService code boundary validation', () => {
  it('does not treat frontmatter source evidence as boundary ambiguity', () => {
    const result = validate(
      [doc('component-a'), doc('component-b')],
      [
        reference('component-a', 'doc', 'doc_frontmatter'),
        reference('component-b', 'doc', 'doc_frontmatter'),
      ],
    );

    expect(result.issues.filter((issue) => issue.type === 'ambiguous-code-boundary')).toEqual([]);
  });

  it('rejects multiple explicit boundaries at the same file scope', () => {
    const result = validate(
      [doc('system-a', 'system'), doc('system-b', 'system')],
      [
        reference('system-a', 'boundary', 'code_comment'),
        reference('system-b', 'boundary', 'code_comment'),
      ],
    );

    expect(result.issues.filter((issue) => issue.type === 'ambiguous-code-boundary')).toHaveLength(
      1,
    );
  });

  it('allows explicit boundaries when each declaration is symbol-scoped', () => {
    const result = validate(
      [doc('system-a', 'system'), doc('system-b', 'system')],
      [
        reference('system-a', 'boundary', 'code_comment', 'Catalog.events'),
        reference('system-b', 'boundary', 'code_comment', 'Catalog.observations'),
      ],
    );

    expect(result.issues.filter((issue) => issue.type === 'ambiguous-code-boundary')).toEqual([]);
  });
});
