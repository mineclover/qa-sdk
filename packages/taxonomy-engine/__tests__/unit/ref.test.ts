import { describe, it, expect } from 'vitest';
import { parseRef } from '../../src/ref/parser.js';
import { resolveRef } from '../../src/ref/resolver.js';
import { TaxonomyRegistry } from '../../src/registry/index.js';
import { parse } from '../../src/parser/index.js';

describe('parseRef', () => {
  it('Tier 1 path-based — 전체 taxonomy', () => {
    expect(parseRef('qa-coords')).toEqual({
      taxonomy: 'qa-coords',
      kind: 'taxonomy',
    });
  });

  it('Tier 1 path-based — axis', () => {
    expect(parseRef('qa-coords#/axes/scope')).toEqual({
      taxonomy: 'qa-coords',
      kind: 'axis',
      axis: 'scope',
    });
  });

  it('Tier 1 path-based — entry', () => {
    expect(parseRef('qa-coords#/axes/scope/entries/apm')).toEqual({
      taxonomy: 'qa-coords',
      kind: 'entry',
      axis: 'scope',
      entry: 'apm',
    });
  });

  it('Tier 1 path-based — meta field', () => {
    const r = parseRef('qa-coords#/axes/scope/entries/apm/meta/owner');
    expect(r.kind).toBe('entry-field');
    if (r.kind === 'entry-field') {
      expect(r.axis).toBe('scope');
      expect(r.entry).toBe('apm');
      expect(r.pointer).toEqual(['meta', 'owner']);
    }
  });

  it('Tier 2 dotted — entry', () => {
    expect(parseRef('qa-coords:scope.apm')).toEqual({
      taxonomy: 'qa-coords',
      kind: 'entry',
      axis: 'scope',
      entry: 'apm',
    });
  });

  it('Tier 2 dotted — coordinate', () => {
    const r = parseRef('qa-coords:coord{scope=apm,aspect=model}');
    expect(r.kind).toBe('coordinate');
    if (r.kind === 'coordinate') {
      expect(r.coord).toEqual({ scope: 'apm', aspect: 'model' });
    }
  });

  it('Tier 3 address-based — axis#address', () => {
    expect(parseRef('qa-coords::scope#0')).toEqual({
      taxonomy: 'qa-coords',
      kind: 'entry-by-address',
      axis: 'scope',
      address: 0,
    });
  });

  it('version 명시 @v<n>', () => {
    expect(parseRef('qa-coords@v1:scope.apm')).toEqual({
      taxonomy: 'qa-coords',
      version: 1,
      kind: 'entry',
      axis: 'scope',
      entry: 'apm',
    });
  });
});

describe('resolveRef', () => {
  const yaml = `
taxonomy: qa-coords
version: 1
axes:
  scope:
    entries: [apm, ingest]
`;
  const reg = new TaxonomyRegistry();
  const parsed = parse(yaml);
  if ('ir' in parsed) reg.add(parsed.ir);

  it('3-tier 등가 — entry', () => {
    const a = resolveRef(parseRef('qa-coords:scope.apm'), reg);
    const b = resolveRef(parseRef('qa-coords#/axes/scope/entries/apm'), reg);
    const c = resolveRef(parseRef('qa-coords::scope#0'), reg);
    expect(a?.kind).toBe('entry');
    expect(b?.kind).toBe('entry');
    expect(c?.kind).toBe('entry');
    if (a?.kind === 'entry' && b?.kind === 'entry' && c?.kind === 'entry') {
      expect((a.entry as { id: string }).id).toBe('apm');
      expect((b.entry as { id: string }).id).toBe('apm');
      expect((c.entry as { id: string }).id).toBe('apm');
    }
  });

  it('fail-open — unknown taxonomy → undefined', () => {
    expect(resolveRef(parseRef('unknown:scope.x'), reg)).toBeUndefined();
  });

  it('fail-open — unknown entry → undefined', () => {
    expect(resolveRef(parseRef('qa-coords:scope.unknown'), reg)).toBeUndefined();
  });
});
