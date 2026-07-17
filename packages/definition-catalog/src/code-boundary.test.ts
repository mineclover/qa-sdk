import { describe, expect, it } from 'vitest';
import { resolveCodeBoundary } from './code-boundary.js';
import type { DefCodeReference, DefDoc } from './data-source.js';

function doc(docId: string): DefDoc {
  return {
    docId,
    title: docId,
    scope: 'data',
    aspect: 'system_data',
    depth: 'specification',
    lifecycle: 'approved',
    tags: [],
    links: [],
    version: 1,
  };
}

function reference(
  docId: string,
  relationType: DefCodeReference['relationType'],
  sourceKind: DefCodeReference['sourceKind'] = 'code_comment',
): DefCodeReference {
  return {
    codePath: 'packages/demo/src/index.ts',
    docId,
    relationType,
    sourceKind,
  };
}

describe('resolveCodeBoundary', () => {
  it('keeps frontmatter sources as evidence without inferring ownership', () => {
    const result = resolveCodeBoundary({
      codePath: 'packages/demo/src/index.ts',
      references: [
        reference('component-a', 'doc', 'doc_frontmatter'),
        reference('component-b', 'doc', 'doc_frontmatter'),
      ],
      docs: [doc('component-a'), doc('component-b')],
    });

    expect(result.kind).toBe('evidence-only');
  });

  it('returns one explicit boundary with all evidence attached', () => {
    const result = resolveCodeBoundary({
      codePath: 'packages/demo/src/index.ts',
      references: [
        reference('system-a', 'boundary'),
        reference('component-a', 'doc', 'doc_frontmatter'),
      ],
      docs: [doc('system-a'), doc('component-a')],
    });

    expect(result.kind).toBe('unique');
    if (result.kind === 'unique') {
      expect(result.anchor.docId).toBe('system-a');
      expect(result.supportingDocs.map((item) => item.docId)).toEqual(['component-a', 'system-a']);
    }
  });

  it('reports conflicting explicit boundaries as ambiguous', () => {
    const result = resolveCodeBoundary({
      codePath: 'packages/demo/src/index.ts',
      references: [reference('system-a', 'boundary'), reference('system-b', 'boundary')],
      docs: [doc('system-a'), doc('system-b')],
    });

    expect(result.kind).toBe('ambiguous');
  });

  it('does not turn a missing explicit target into an inferred unique result', () => {
    const result = resolveCodeBoundary({
      codePath: 'packages/demo/src/index.ts',
      references: [reference('missing-system', 'boundary'), reference('component-a', 'doc')],
      docs: [doc('component-a')],
    });

    expect(result.kind).toBe('evidence-only');
  });
});
