import { describe, it, expect } from 'vitest';
import { show, slice, walkRelation, walkByCoordinate } from '../../src/query/index.js';
import { TaxonomyRegistry } from '../../src/registry/index.js';
import { parse } from '../../src/parser/index.js';

const yaml = `
taxonomy: t
version: 1
axes:
  scope:
    entries: [apm, ingest]
`;

const reg = new TaxonomyRegistry();
const r = parse(yaml);
if ('ir' in r) reg.add(r.ir);

describe('show', () => {
  it('3-tier 모두 같은 단위 반환 — entry', () => {
    const a = show('t:scope.apm', reg);
    const b = show('t#/axes/scope/entries/apm', reg);
    const c = show('t::scope#0', reg);
    expect(a?.kind).toBe('entry');
    expect(b?.kind).toBe('entry');
    expect(c?.kind).toBe('entry');
    if (a?.kind === 'entry' && b?.kind === 'entry' && c?.kind === 'entry') {
      expect((a.entry as { id: string }).id).toBe('apm');
      expect((b.entry as { id: string }).id).toBe('apm');
      expect((c.entry as { id: string }).id).toBe('apm');
    }
  });

  it('fail-open — unknown → undefined', () => {
    expect(show('t:scope.unknown', reg)).toBeUndefined();
    expect(show('unknown-tax:scope.apm', reg)).toBeUndefined();
  });
});

const richYaml = `
taxonomy: rich
version: 1
axes:
  depth:
    entries: [overview, system, layer, component, entry]
relations:
  d-contains:
    from: [depth]
    to: [depth]
    kind: contains
    rules:
      - { upper: overview, lower: system }
      - { upper: system, lower: layer }
      - { upper: layer, lower: component }
      - { upper: component, lower: entry }
`;

const richReg = (() => {
  const reg = new TaxonomyRegistry();
  const p = parse(richYaml);
  if ('ir' in p) reg.add(p.ir);
  return reg;
})();

const richIr = richReg.get('rich')!;

describe('slice', () => {
  it('ids 필터', () => {
    const s = slice(richIr, 'depth', { ids: ['overview', 'layer'] });
    expect(s.map((e) => e.id)).toEqual(['overview', 'layer']);
  });

  it('address 범위 필터 (inclusive)', () => {
    const s = slice(richIr, 'depth', { from: 1, to: 3 });
    expect(s.map((e) => e.id)).toEqual(['system', 'layer', 'component']);
  });

  it('unknown axis → empty', () => {
    expect(slice(richIr, 'missing')).toEqual([]);
  });
});

describe('walkRelation', () => {
  it('contains 그래프 순회 (overview → entry)', () => {
    const visited = [...walkRelation(richIr, 'd-contains', 'overview')];
    expect(visited).toEqual(['overview', 'system', 'layer', 'component', 'entry']);
  });

  it('순환 방지 — 동일 노드 재방문 안 함', () => {
    const cycleYaml = `
taxonomy: c
version: 1
axes:
  a:
    entries: [x, y]
relations:
  r:
    from: [a]
    to: [a]
    kind: depends-on
    rules:
      - { from: x, to: y }
      - { from: y, to: x }
`;
    const p = parse(cycleYaml);
    if (!('ir' in p)) throw new Error('parse failed');
    const visited = [...walkRelation(p.ir, 'r', 'x')];
    expect(visited.sort()).toEqual(['x', 'y']);
  });

  it('unknown relation → empty', () => {
    expect([...walkRelation(richIr, 'missing', 'x')]).toEqual([]);
  });
});

describe('walkByCoordinate', () => {
  const yaml = `
taxonomy: t
version: 1
axes:
  clip:
    entries: [fade, slide]
  asset:
    entries: [text, image]
  param-kind:
    entries: [content, control]
relations:
  clip-binds:
    from: [clip]
    to: [param-kind]
    kind: binds
    rules:
      - { clip: fade, param-kind: control }
      - { clip: slide, param-kind: control }
  asset-defines:
    from: [asset]
    to: [param-kind]
    kind: depends-on
    rules:
      - { asset: text, param-kind: content }
      - { asset: text, param-kind: control }
      - { asset: image, param-kind: content }
`;
  const ir = (() => {
    const p = parse(yaml);
    if (!('ir' in p)) throw new Error('parse failed');
    return p.ir;
  })();

  it('부분 좌표 startCoord로 매칭되는 rules 도달', () => {
    const visited = [...walkByCoordinate(ir, 'clip-binds', { clip: 'fade' })];
    expect(visited.length).toBe(2);
    // 시작점 + 도착점
    expect(visited).toContainEqual({ clip: 'fade' });
    expect(visited).toContainEqual({ clip: 'fade', 'param-kind': 'control' });
  });

  it('multi-axis coord 매칭', () => {
    const visited = [...walkByCoordinate(ir, 'asset-defines', { asset: 'text' })];
    expect(visited).toContainEqual({ asset: 'text' });
    expect(visited).toContainEqual({ asset: 'text', 'param-kind': 'content' });
    expect(visited).toContainEqual({ asset: 'text', 'param-kind': 'control' });
  });

  it('unknown relation → 빈 iterator', () => {
    expect([...walkByCoordinate(ir, 'missing', { clip: 'fade' })]).toEqual([]);
  });
});
