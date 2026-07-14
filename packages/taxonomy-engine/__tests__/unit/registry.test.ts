import { describe, it, expect } from 'vitest';
import { TaxonomyRegistry } from '../../src/registry/index.js';
import { parse } from '../../src/parser/index.js';

const yamlA = `taxonomy: a\nversion: 1\naxes:\n  scope:\n    entries: [x, y]\n`;
const yamlB = `taxonomy: b\nversion: 1\naxes:\n  scope:\n    entries: [m, n]\n`;

describe('TaxonomyRegistry', () => {
  it('add/get/list', () => {
    const reg = new TaxonomyRegistry();
    const a = parse(yamlA);
    const b = parse(yamlB);
    if ('ir' in a) reg.add(a.ir);
    if ('ir' in b) reg.add(b.ir);
    expect(reg.list().sort()).toEqual(['a', 'b']);
    expect(reg.get('a')?.taxonomy).toBe('a');
    expect(reg.get('missing')).toBeUndefined();
  });

  it('같은 taxonomy 재추가 시 덮어씀', () => {
    const reg = new TaxonomyRegistry();
    const a = parse(yamlA);
    if ('ir' in a) {
      reg.add(a.ir);
      reg.add(a.ir);
    }
    expect(reg.list()).toEqual(['a']);
  });
});
