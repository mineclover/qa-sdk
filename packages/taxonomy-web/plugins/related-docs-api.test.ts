import { describe, it, expect } from 'vitest';
import { searchRelatedDocs } from './related-docs-api';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../../..');

describe('searchRelatedDocs', () => {
  it('axis 이름으로 docs 검색', () => {
    const matches = searchRelatedDocs({
      repoRoot,
      term: 'scope',
      searchPaths: ['docs/proposals/taxonomy-engine'],
    });
    expect(Array.isArray(matches)).toBe(true);
  });

  it('존재하지 않는 term → 빈 배열', () => {
    const matches = searchRelatedDocs({
      repoRoot,
      term: 'xyz-nonexistent-term-12345',
      searchPaths: ['docs/proposals/taxonomy-engine'],
    });
    expect(matches).toEqual([]);
  });
});
