// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, expect, it } from 'vitest';
import { CatalogRegistry } from './catalog-registry.js';
import type { Catalog } from './catalog.types.js';

function makeCatalog(id: string, name: string, prefixCount = 1): Catalog {
  const prefixes: Catalog['prefixes'] = {};
  for (let i = 0; i < prefixCount; i++) {
    const pid = `p${i}`;
    prefixes[pid] = {
      id: pid,
      name: `prefix-${i}`,
      labels: [],
      dims: {},
      versions: [],
    };
  }
  return { id, name, axes: {}, prefixes };
}

describe('CatalogRegistry', () => {
  it('register → getCatalog 조회', () => {
    const reg = new CatalogRegistry();
    const cat = makeCatalog('demo', '쇼핑 데모', 3);
    reg.register(cat);
    expect(reg.getCatalog('demo')).toBe(cat);
  });

  it('첫 등록이 자동으로 기본값', () => {
    const reg = new CatalogRegistry();
    reg.register(makeCatalog('a', 'A'));
    reg.register(makeCatalog('b', 'B'));
    // id 생략 시 첫 등록인 "a" 반환
    expect(reg.getCatalog().id).toBe('a');
  });

  it('setDefault로 기본 카탈로그 변경', () => {
    const reg = new CatalogRegistry();
    reg.register(makeCatalog('a', 'A'));
    reg.register(makeCatalog('b', 'B'));
    reg.setDefault('b');
    expect(reg.getCatalog().id).toBe('b');
  });

  it('등록되지 않은 id에 setDefault 시 에러', () => {
    const reg = new CatalogRegistry();
    expect(() => reg.setDefault('nope')).toThrow('not registered');
  });

  it('없는 id 조회 시 에러', () => {
    const reg = new CatalogRegistry();
    reg.register(makeCatalog('a', 'A'));
    expect(() => reg.getCatalog('x')).toThrow('not found');
  });

  it('빈 레지스트리에서 getCatalog() 에러', () => {
    const reg = new CatalogRegistry();
    expect(() => reg.getCatalog()).toThrow('No catalogs registered');
  });

  it('unregister 후 조회 불가', () => {
    const reg = new CatalogRegistry();
    reg.register(makeCatalog('a', 'A'));
    reg.unregister('a');
    expect(reg.has('a')).toBe(false);
    expect(() => reg.getCatalog()).toThrow('No catalogs registered');
  });

  it('기본 카탈로그 해제 시 다음 카탈로그가 기본값', () => {
    const reg = new CatalogRegistry();
    reg.register(makeCatalog('a', 'A'));
    reg.register(makeCatalog('b', 'B'));
    reg.unregister('a');
    expect(reg.getCatalog().id).toBe('b');
  });

  it('has()', () => {
    const reg = new CatalogRegistry();
    expect(reg.has('a')).toBe(false);
    reg.register(makeCatalog('a', 'A'));
    expect(reg.has('a')).toBe(true);
  });

  it('listCatalogs()', () => {
    const reg = new CatalogRegistry();
    reg.register(makeCatalog('a', 'A', 2));
    reg.register(makeCatalog('b', 'B', 5));
    const list = reg.listCatalogs();
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({ id: 'a', name: 'A', prefixCount: 2 });
    expect(list[1]).toEqual({ id: 'b', name: 'B', prefixCount: 5 });
  });

  it('동일 id 재등록 시 덮어쓰기', () => {
    const reg = new CatalogRegistry();
    reg.register(makeCatalog('a', 'A-v1', 1));
    reg.register(makeCatalog('a', 'A-v2', 3));
    expect(reg.getCatalog('a').name).toBe('A-v2');
    expect(reg.listCatalogs()).toHaveLength(1);
  });

  it('knownIds', () => {
    const reg = new CatalogRegistry();
    reg.register(makeCatalog('x', 'X'));
    reg.register(makeCatalog('y', 'Y'));
    expect(reg.knownIds).toEqual(new Set(['x', 'y']));
  });

  it('CatalogProvider 인터페이스 구현', () => {
    const reg = new CatalogRegistry();
    reg.register(makeCatalog('demo', 'Demo'));
    // CatalogProvider.getCatalog, CatalogProvider.listCatalogs 모두 동작
    expect(reg.getCatalog('demo').id).toBe('demo');
    expect(reg.listCatalogs()[0].id).toBe('demo');
  });
});
