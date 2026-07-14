// @def.boundary weighted-index-system
// @def.doc weighted-index-system#rdbms-equivalence-strategy-covering

/**
 * 전략 #6 — Covering index (denormalized)
 *
 * 복합 PK가 entity 이름까지 cover → index-only scan으로 decodeToIds 결과 반환.
 * 쓰기 1회 / 읽기 1000회+ read-heavy에서만 트레이드오프 성립.
 *
 * 주의: entity rename 시 fact 테이블 전체 UPDATE 필요 — SSOT 위반 위험.
 */

import { describe, expect, it } from 'vitest';

import { WI, actionLabels, freshDb, resourceLabels, roleLabels, shape } from './shared.js';

describe('#6 Covering index — index-only scan으로 decode 완료', () => {
  it('denormalized fact는 JOIN 없이 entity 이름까지 복원', () => {
    const { raw } = freshDb();
    raw.exec(`
      CREATE TABLE fact_denorm (
        role_id INTEGER NOT NULL,
        action_id INTEGER NOT NULL,
        resource_id INTEGER NOT NULL,
        role_name TEXT NOT NULL,
        action_name TEXT NOT NULL,
        resource_name TEXT NOT NULL,
        PRIMARY KEY (role_id, action_id, resource_id)
      );
    `);

    for (let r = 1; r <= shape[0]; r++)
      for (let a = 1; a <= shape[1]; a++)
        for (let x = 1; x <= shape[2]; x++)
          raw
            .prepare('INSERT INTO fact_denorm VALUES (?,?,?,?,?,?)')
            .run(r, a, x, roleLabels[r - 1], actionLabels[a - 1], resourceLabels[x - 1]);

    const row = raw
      .prepare(
        `SELECT role_name, action_name, resource_name FROM fact_denorm WHERE role_id=? AND action_id=? AND resource_id=?`,
      )
      .get(2, 3, 1) as { role_name: string; action_name: string; resource_name: string };

    const coord = WI.decode(WI.encode([2, 3, 1]));
    expect(row.role_name).toBe(roleLabels[coord[0] - 1]);
    expect(row.action_name).toBe(actionLabels[coord[1] - 1]);
    expect(row.resource_name).toBe(resourceLabels[coord[2] - 1]);

    // EXPLAIN으로 COVERING INDEX 사용 확인 (JOIN 없이 인덱스에서 직접 반환)
    const plan = raw
      .prepare(
        `EXPLAIN QUERY PLAN SELECT role_name, action_name, resource_name FROM fact_denorm WHERE role_id=? AND action_id=? AND resource_id=?`,
      )
      .all(2, 3, 1) as Array<{ detail: string }>;
    expect(
      plan.some((p) => p.detail.includes('COVERING INDEX') || p.detail.includes('USING INDEX')),
    ).toBe(true);
  });
});
