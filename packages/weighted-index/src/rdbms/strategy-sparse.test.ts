// @def.boundary weighted-index-system
// @def.doc weighted-index-system#rdbms-equivalence-strategy-sparse

/**
 * 전략 #1 — Sparse materialization
 *
 * 관측된 좌표만 INSERT. 이론 공간 크기는 shape로 산술 계산.
 * density = observed / theoretical, 그리고 축별 marginal density.
 */

import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { beforeEach, describe, expect, it } from "vitest";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { WI, freshDb, shape } from "./shared.js";

describe("#1 Sparse materialization — 관측 좌표만 저장", () => {
  const events = sqliteTable(
    "events",
    {
      roleId: integer("role_id").notNull(),
      actionId: integer("action_id").notNull(),
      resourceId: integer("resource_id").notNull(),
      observedAt: text("observed_at").notNull(),
    },
    (t) => [primaryKey({ columns: [t.roleId, t.actionId, t.resourceId] })],
  );

  const observations = [
    [1, 1, 1],
    [2, 2, 3],
    [3, 1, 2],
    [2, 3, 1],
    [1, 2, 2],
  ] as const;

  let db: BetterSQLite3Database;

  beforeEach(() => {
    const { raw, db: d } = freshDb();
    raw.exec(`
      CREATE TABLE events (
        role_id INTEGER NOT NULL,
        action_id INTEGER NOT NULL,
        resource_id INTEGER NOT NULL,
        observed_at TEXT NOT NULL,
        PRIMARY KEY (role_id, action_id, resource_id)
      );
    `);
    db = d;
    db.insert(events)
      .values(observations.map(([r, a, x]) => ({
        roleId: r, actionId: a, resourceId: x, observedAt: "2026-04-21T00:00:00Z",
      })))
      .run();
  });

  it("이론 공간 = ∏shape (shape만으로 산출)", () => {
    expect(WI.size).toBe(27);
  });

  it("전체 density = observed / theoretical", () => {
    const [{ observed }] = db.select({ observed: sql<number>`count(*)` }).from(events).all();
    expect(observed).toBe(5);
    expect(observed / WI.size).toBeCloseTo(5 / 27, 6);
  });

  it("축별 marginal density — 실무에서는 전체 density보다 중요", () => {
    // 관측된 entity 수 / 축 capacity = 축 활용률
    const roleActive = db
      .select({ n: sql<number>`count(distinct role_id)` })
      .from(events)
      .all()[0].n;
    const actionActive = db
      .select({ n: sql<number>`count(distinct action_id)` })
      .from(events)
      .all()[0].n;
    const resourceActive = db
      .select({ n: sql<number>`count(distinct resource_id)` })
      .from(events)
      .all()[0].n;

    // observations에 role {1,2,3} 모두, action {1,2,3} 모두, resource {1,2,3} 모두 관측됨
    expect(roleActive / shape[0]).toBe(1);
    expect(actionActive / shape[1]).toBe(1);
    expect(resourceActive / shape[2]).toBe(1);
  });

  it("관측된 좌표의 주소는 전단사 — DB row ↔ weighted-index address 복원", () => {
    const rows = db.select().from(events).all();
    for (const row of rows) {
      const addr = WI.encode([row.roleId, row.actionId, row.resourceId]);
      expect(WI.decode(addr)).toEqual([row.roleId, row.actionId, row.resourceId]);
    }
  });
});
