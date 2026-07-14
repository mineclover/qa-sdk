import { collectCodeReferences } from './src/index.js';
import { describe, it } from 'vitest';
import { resolve } from 'node:path';

describe('find dups', () => {
  it('should find dups', () => {
    const root = resolve(process.cwd(), '../..');
    const refs = collectCodeReferences(root, { docsDir: 'docs', codeDirs: ['packages'] });
    const map = new Map<string, number>();

    for (const ref of refs) {
      const symbol = ref.symbol ?? '';
      const key = `${ref.codePath}|${ref.docId}|${ref.relationType}|${ref.sourceKind}|${symbol}`;
      const count = map.get(key) || 0;
      if (count > 0) {
        console.error('Duplicate found:', key, ref);
      }
      map.set(key, count + 1);
    }
  });
});
