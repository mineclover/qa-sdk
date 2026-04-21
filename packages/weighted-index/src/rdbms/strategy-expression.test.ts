// @def.boundary weighted-index-system
// @def.doc weighted-index-system#rdbms-equivalence-strategy-expression

/**
 * 전략 #2 — Expression index
 *
 * DB가 `encode` 수식을 자동 인덱싱. address 정수로 O(log N) 조회.
 *
 * 주의: 클라이언트가 이미 encode를 갖고 있으면 composite PK로 직접 조회가 더 간결.
 * 이 전략은 `address BETWEEN lo AND hi` 같은 범위 쿼리 단순화에 주로 유용하다.
 */

import { describe, expect, it } from "vitest";

import { W, WI, freshDb, shape } from "./shared.js";

describe("#2 Expression index — encode를 DB가 유지", () => {
  it("expression index로 address 조회, WeightedIndex.encode와 일치", () => {
    const { raw } = freshDb();
    raw.exec(`
      CREATE TABLE coords (
        role_id INTEGER NOT NULL,
        action_id INTEGER NOT NULL,
        resource_id INTEGER NOT NULL,
        PRIMARY KEY (role_id, action_id, resource_id)
      );
      CREATE INDEX coords_addr ON coords (
        (role_id - 1) * ${W[0]} + (action_id - 1) * ${W[1]} + (resource_id - 1)
      );
    `);

    for (let r = 1; r <= shape[0]; r++)
      for (let a = 1; a <= shape[1]; a++)
        for (let x = 1; x <= shape[2]; x++)
          raw.prepare("INSERT INTO coords VALUES (?,?,?)").run(r, a, x);
    raw.exec("ANALYZE");

    // 1) 계산된 address가 WeightedIndex.encode와 일치
    const rows = raw
      .prepare(`
        SELECT role_id, action_id, resource_id,
               (role_id - 1) * ? + (action_id - 1) * ? + (resource_id - 1) AS address
        FROM coords
      `)
      .all(W[0], W[1]) as Array<{ role_id: number; action_id: number; resource_id: number; address: number }>;
    for (const r of rows) {
      expect(r.address).toBe(WI.encode([r.role_id, r.action_id, r.resource_id]));
    }

    // 2) 인덱스가 존재하고 address 쿼리에 적용 가능 (planner 선택과 독립)
    const plan = raw
      .prepare(`
        EXPLAIN QUERY PLAN
        SELECT * FROM coords INDEXED BY coords_addr
        WHERE (role_id - 1) * ? + (action_id - 1) * ? + (resource_id - 1) = ?
      `)
      .all(W[0], W[1], 13) as Array<{ detail: string }>;
    expect(plan.some((p) => p.detail.includes("coords_addr"))).toBe(true);

    // 3) address = 13 → [2,2,2] 역산 일치
    const hit = raw
      .prepare(`
        SELECT role_id, action_id, resource_id FROM coords
        WHERE (role_id - 1) * ? + (action_id - 1) * ? + (resource_id - 1) = ?
      `)
      .get(W[0], W[1], 13) as { role_id: number; action_id: number; resource_id: number };
    expect([hit.role_id, hit.action_id, hit.resource_id]).toEqual(WI.decode(13));
  });
});
