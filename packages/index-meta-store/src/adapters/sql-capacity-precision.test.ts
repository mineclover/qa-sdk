// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * capacity 계열 컬럼이 2^53을 넘어도 SQL store가 읽을 수 있어야 한다.
 *
 * overflow composite draft(number 타입인데 product > 2^53)는 registry가 release에서 OVERFLOW로
 * 막아야 하는 정상 상태다. node:sqlite가 INTEGER를 그대로 읽으면 RangeError를 던져 그 판정에 닿지 못한다.
 * InMemory store와 같은 double 값을 돌려주는지 확인한다.
 */
import { describe, expect, it } from 'vitest';
import { NodeSqliteDriver } from './node-sqlite-driver.js';
import { SqlPrefixRegistry } from './sql-prefix-registry.js';
import { SqlVersionLifecycleStore } from './sql-version-lifecycle-store.js';

/** 1e8 × 1e8 — Number.MAX_SAFE_INTEGER(≈9.007e15)를 넘는 composite product */
const LEAF_CAPACITY = 100_000_000;
const OVERFLOW_PRODUCT = LEAF_CAPACITY * LEAF_CAPACITY;

describe('SQL store capacity 정밀도', () => {
  it('전제: product가 안전한 정수 범위를 넘는다', () => {
    expect(Number.isSafeInteger(OVERFLOW_PRODUCT)).toBe(false);
  });

  it('version lifecycle — overflow capacity draft를 읽고 목록을 조회할 수 있다', async () => {
    const store = new SqlVersionLifecycleStore(new NodeSqliteDriver(':memory:'));
    await store.createDraft('comp', 'v1', null, OVERFLOW_PRODUCT);

    expect((await store.getVersion('comp', 'v1'))?.capacity).toBe(OVERFLOW_PRODUCT);
    expect((await store.getVersions('comp')).map((v) => v.capacity)).toEqual([OVERFLOW_PRODUCT]);
  });

  it('prefix registry — composite capacity와 ref capacity를 같은 값으로 되돌린다', async () => {
    const registry = new SqlPrefixRegistry(new NodeSqliteDriver(':memory:'));
    await registry.register({ prefix: 'a', versionId: 'v1', capacity: LEAF_CAPACITY });
    await registry.register({ prefix: 'b', versionId: 'v1', capacity: LEAF_CAPACITY });
    await registry.register({
      prefix: 'comp',
      versionId: 'v1',
      capacity: OVERFLOW_PRODUCT,
      refs: [
        { prefix: 'a', versionId: 'v1', capacity: LEAF_CAPACITY },
        { prefix: 'b', versionId: 'v1', capacity: LEAF_CAPACITY },
      ],
    });

    expect(await registry.getCapacity('comp', 'v1')).toBe(OVERFLOW_PRODUCT);
    const record = await registry.getRecord('comp', 'v1');
    expect(record?.capacity).toBe(OVERFLOW_PRODUCT);
    expect(record?.refs?.map((ref) => ref.capacity)).toEqual([LEAF_CAPACITY, LEAF_CAPACITY]);
  });

  it('안전한 정수 범위의 capacity는 정수 그대로다', async () => {
    const store = new SqlVersionLifecycleStore(new NodeSqliteDriver(':memory:'));
    await store.createDraft('leaf', 'v1', null, 32);
    const capacity = (await store.getVersion('leaf', 'v1'))?.capacity;
    expect(capacity).toBe(32);
    expect(Number.isInteger(capacity)).toBe(true);
  });
});
