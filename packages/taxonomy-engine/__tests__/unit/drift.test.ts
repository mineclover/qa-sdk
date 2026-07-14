import { describe, it, expect } from 'vitest';
import { checkContentHashDrift, validateRegistryVersions } from '../../src/drift/index.js';
import { TaxonomyRegistry } from '../../src/registry/index.js';
import { parse } from '../../src/parser/index.js';

describe('checkContentHashDrift', () => {
  it('동일 hash → undefined', () => {
    expect(checkContentHashDrift('abc', 'abc')).toBeUndefined();
  });

  it('다른 hash → warning Diagnostic', () => {
    const d = checkContentHashDrift('abc123', 'def456', 'tax#/meta');
    expect(d?.severity).toBe('warning');
    expect(d?.code).toBe('codegen-content-hash-mismatch');
    expect(d?.meta?.previous).toBe('abc123');
    expect(d?.meta?.current).toBe('def456');
  });

  it('ref 없이도 작동', () => {
    const d = checkContentHashDrift('prev', 'curr');
    expect(d?.severity).toBe('warning');
    expect(d?.code).toBe('codegen-content-hash-mismatch');
    expect(d?.ref).toBeUndefined();
  });
});

describe('validateRegistryVersions', () => {
  it('version 일치 → no diagnostics', () => {
    const reg = new TaxonomyRegistry();
    const baseR = parse(`taxonomy: base\nversion: 1\naxes:\n  a:\n    entries: [x]\n`);
    const derR = parse(
      `taxonomy: der\nversion: 1\nimports:\n  - { taxonomy: base, version: 1, as: b }\naxes:\n  s:\n    entries: [y]\n`,
    );
    if (!('ir' in baseR) || !('ir' in derR)) throw new Error();
    reg.add(baseR.ir);
    reg.add(derR.ir);
    expect(validateRegistryVersions(reg)).toEqual([]);
  });

  it('version 불일치 → version-drift warning', () => {
    const reg = new TaxonomyRegistry();
    const baseR = parse(`taxonomy: base\nversion: 2\naxes:\n  a:\n    entries: [x]\n`);
    const derR = parse(
      `taxonomy: der\nversion: 1\nimports:\n  - { taxonomy: base, version: 1, as: b }\naxes:\n  s:\n    entries: [y]\n`,
    );
    if (!('ir' in baseR) || !('ir' in derR)) throw new Error();
    reg.add(baseR.ir);
    reg.add(derR.ir);
    const diags = validateRegistryVersions(reg);
    expect(diags.length).toBe(1);
    expect(diags[0].code).toBe('version-drift');
    expect(diags[0].meta?.requested).toBe(1);
    expect(diags[0].meta?.available).toBe(2);
    expect(diags[0].meta?.consumer).toBe('der');
  });

  it('여러 imports, 일부만 drift', () => {
    const reg = new TaxonomyRegistry();
    const base1 = parse(`taxonomy: base1\nversion: 1\naxes:\n  a:\n    entries: [x]\n`);
    const base2 = parse(`taxonomy: base2\nversion: 2\naxes:\n  b:\n    entries: [y]\n`);
    const consumer = parse(
      `taxonomy: consumer\nversion: 1\nimports:\n  - { taxonomy: base1, version: 1, as: b1 }\n  - { taxonomy: base2, version: 1, as: b2 }\naxes:\n  c:\n    entries: [z]\n`,
    );
    if (!('ir' in base1) || !('ir' in base2) || !('ir' in consumer)) throw new Error();
    reg.add(base1.ir);
    reg.add(base2.ir);
    reg.add(consumer.ir);
    const diags = validateRegistryVersions(reg);
    expect(diags.length).toBe(1); // base2만 drift
    expect(diags[0].meta?.taxonomy).toBe('base2');
    expect(diags[0].meta?.requested).toBe(1);
    expect(diags[0].meta?.available).toBe(2);
  });

  it('unspecified version → skip', () => {
    const reg = new TaxonomyRegistry();
    const baseR = parse(`taxonomy: base\nversion: 1\naxes:\n  a:\n    entries: [x]\n`);
    const derR = parse(
      `taxonomy: der\nversion: 1\nimports:\n  - { taxonomy: base, as: b }\naxes:\n  s:\n    entries: [y]\n`,
    );
    if (!('ir' in baseR) || !('ir' in derR)) throw new Error();
    reg.add(baseR.ir);
    reg.add(derR.ir);
    expect(validateRegistryVersions(reg)).toEqual([]);
  });

  it('unresolved import 무시', () => {
    const reg = new TaxonomyRegistry();
    const derR = parse(
      `taxonomy: der\nversion: 1\nimports:\n  - { taxonomy: missing, version: 1, as: m }\naxes:\n  s:\n    entries: [y]\n`,
    );
    if (!('ir' in derR)) throw new Error();
    reg.add(derR.ir);
    // missing이 registry에 없으므로 validateRegistryVersions는 무시
    expect(validateRegistryVersions(reg)).toEqual([]);
  });
});
