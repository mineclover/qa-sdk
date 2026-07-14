// @def.boundary weighted-index-system
// @def.doc weighted-index-system#rdbms-equivalence-strategy-partial

/**
 * 전략 #3 — Partial index
 *
 * composite PK와 **다른 축 순서로 자주 쿼리**할 때 쓰는 대체 인덱스.
 * "calcAddressRanges 영속화"는 부정확 — PK 순서가 같으면 PK 자체가 이미 커버하므로
 * partial은 중복이 된다. 순서 불일치 해결용으로 이해한다.
 */

import { describe, expect, it } from 'vitest';

import { calcAddressRanges } from '../math/calc.js';
import { freshDb, shape } from './shared.js';

describe('#3 Partial index — 축 순서 불일치 해결', () => {
  it('role=2 부분 인덱스는 calcAddressRanges 범위와 동일한 row를 포함', () => {
    const { raw } = freshDb();
    raw.exec(`
      CREATE TABLE coords (
        role_id INTEGER NOT NULL,
        action_id INTEGER NOT NULL,
        resource_id INTEGER NOT NULL,
        PRIMARY KEY (role_id, action_id, resource_id)
      );
      CREATE INDEX coords_role2 ON coords (action_id, resource_id) WHERE role_id = 2;
    `);

    for (let r = 1; r <= shape[0]; r++)
      for (let a = 1; a <= shape[1]; a++)
        for (let x = 1; x <= shape[2]; x++)
          raw.prepare('INSERT INTO coords VALUES (?,?,?)').run(r, a, x);

    // 1) DB의 role=2 row 수 = calcAddressRanges 범위 크기
    const dbRole2 = raw.prepare(`SELECT * FROM coords WHERE role_id = 2`).all() as Array<{
      role_id: number;
      action_id: number;
      resource_id: number;
    }>;
    const ranges = calcAddressRanges([...shape], ['2', null, null]);
    const libCount = ranges.reduce((sum, [lo, hi]) => sum + (hi - lo + 1), 0);
    expect(dbRole2.length).toBe(libCount);
    expect(libCount).toBe(shape[1] * shape[2]);

    // 2) 부분 인덱스가 sqlite_master에 WHERE 조건 포함
    const idxRow = raw
      .prepare(`SELECT sql FROM sqlite_master WHERE type='index' AND name='coords_role2'`)
      .get() as { sql: string };
    expect(idxRow.sql).toContain('WHERE role_id = 2');

    // 3) INDEXED BY로 강제했을 때 partial index가 적용됨
    const plan = raw
      .prepare(
        `EXPLAIN QUERY PLAN SELECT * FROM coords INDEXED BY coords_role2 WHERE role_id = 2 AND action_id = 1`,
      )
      .all() as Array<{ detail: string }>;
    expect(plan.some((p) => p.detail.includes('coords_role2'))).toBe(true);

    // 4) 부분 인덱스 경유한 결과 = 일반 쿼리 결과
    const viaPartial = raw
      .prepare(`SELECT * FROM coords INDEXED BY coords_role2 WHERE role_id = 2 AND action_id = 1`)
      .all() as Array<{ role_id: number; action_id: number; resource_id: number }>;
    expect(viaPartial.length).toBe(shape[2]);
    expect(viaPartial.every((r) => r.role_id === 2 && r.action_id === 1)).toBe(true);
  });
});
