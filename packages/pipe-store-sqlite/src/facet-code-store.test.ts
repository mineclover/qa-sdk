// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { beforeEach, describe, expect, it } from 'vitest';
import type { FacetCodeMapping } from '@qa-sdk/core';

import { SqliteFacetCodeStore } from './facet-code-store.js';

const mapping = (
  facet: string,
  file: string,
  opts?: { symbol?: string; schemaId?: string },
): FacetCodeMapping => ({
  facet,
  implementations: [{ file, symbol: opts?.symbol }],
  schemaId: opts?.schemaId,
});

describe('SqliteFacetCodeStore', () => {
  let store: SqliteFacetCodeStore;

  beforeEach(() => {
    store = new SqliteFacetCodeStore(':memory:');
  });

  it('register + getByFacet', () => {
    store.register(
      mapping('결제검증', 'payment/validate.ts', { symbol: 'checkPayment', schemaId: 'orders' }),
    );

    const result = store.getByFacet('결제검증');
    expect(result).not.toBeNull();
    expect(result!.facet).toBe('결제검증');
    expect(result!.implementations[0].file).toBe('payment/validate.ts');
    expect(result!.implementations[0].symbol).toBe('checkPayment');
    expect(result!.schemaId).toBe('orders');
  });

  it('중복 등록 시 에러', () => {
    store.register(mapping('결제', 'a.ts'));
    expect(() => store.register(mapping('결제', 'b.ts'))).toThrow('already registered');
  });

  it('getByFile — 파일별 조회', () => {
    store.register(mapping('검증', 'validate.ts'));
    store.register(mapping('변환', 'validate.ts'));
    store.register(mapping('저장', 'store.ts'));

    const results = store.getByFile('validate.ts');
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.facet).toSorted()).toEqual(['검증', '변환']);
  });

  it('getByFile — 부분 매칭 방지 (정확한 파일 경로만)', () => {
    store.register(mapping('A', 'src/validate.ts'));
    store.register(mapping('B', 'src/validate.test.ts'));

    // "validate.ts"로 검색하면 "validate.test.ts"도 LIKE에 걸리지만 정확 매칭으로 필터
    const results = store.getByFile('src/validate.ts');
    expect(results).toHaveLength(1);
    expect(results[0].facet).toBe('A');
  });

  it('getBySchema — 스키마별 조회', () => {
    store.register(mapping('주문검증', 'a.ts', { schemaId: 'orders' }));
    store.register(mapping('주문전송', 'b.ts', { schemaId: 'orders' }));
    store.register(mapping('결제', 'c.ts', { schemaId: 'payments' }));

    expect(store.getBySchema('orders')).toHaveLength(2);
    expect(store.getBySchema('payments')).toHaveLength(1);
    expect(store.getBySchema('없음')).toHaveLength(0);
  });

  it('remove + listAll', () => {
    store.register(mapping('a', 'a.ts'));
    store.register(mapping('b', 'b.ts'));
    expect(store.listAll()).toHaveLength(2);

    expect(store.remove('a')).toBe(true);
    expect(store.listAll()).toHaveLength(1);
    expect(store.getByFacet('a')).toBeNull();

    expect(store.remove('없는것')).toBe(false);
  });

  it('schemaId 없는 매핑 저장/조회', () => {
    store.register(mapping('로깅', 'logger.ts'));

    const result = store.getByFacet('로깅');
    expect(result!.schemaId).toBeUndefined();
    expect(store.getBySchema('anything')).toHaveLength(0);
  });

  it('다중 implementations 저장/조회', () => {
    store.register({
      facet: '결제처리',
      implementations: [
        { file: 'payment/process.ts', symbol: 'processPayment' },
        { file: 'payment/verify.ts', symbol: 'verifyPayment', lines: [10, 50] },
      ],
      schemaId: 'payments',
    });

    const result = store.getByFacet('결제처리');
    expect(result!.implementations).toHaveLength(2);
    expect(result!.implementations[1].lines).toEqual([10, 50]);

    // 두 파일 모두 getByFile로 조회 가능
    expect(store.getByFile('payment/process.ts')).toHaveLength(1);
    expect(store.getByFile('payment/verify.ts')).toHaveLength(1);
  });
});
