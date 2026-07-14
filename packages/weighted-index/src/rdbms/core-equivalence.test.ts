// @def.boundary weighted-index-system
// @def.doc weighted-index-system#rdbms-equivalence

/**
 * RDBMS materialization ↔ weighted-index 핵심 등가성 증명
 *
 * 주장: dim 테이블의 카테시안 곱을 materialize한 복합 PK fact 테이블에서
 *       lex-order row position은 `WeightedIndex.encode(coord)`와 동일하다.
 *       즉 btree lex 정렬이 mixed-radix 주소 계산을 저장으로 수행하는 것과 같다.
 *
 * 증명 3건 + 부수 2건:
 *   (1) row position === encode  — btree lex order = mixed radix address
 *   (2) JOIN 복원 === decodeToIds — dim FK join = entity label 역매핑
 *   (3) 부분 좌표 필터 === calcAddressRanges — WHERE clause = address range
 *   (4) row count === ∏shape
 *   (5) max address === size - 1
 */

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { and, eq, sql } from 'drizzle-orm';
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { beforeAll, describe, expect, it } from 'vitest';

import { calcAddressRanges } from '../math/calc.js';
import { WI, actionLabels, resourceLabels, roleLabels, shape } from './shared.js';

const roles = sqliteTable('roles', {
  id: integer('id').primaryKey(),
  entityId: text('entity_id').notNull().unique(),
});

const actions = sqliteTable('actions', {
  id: integer('id').primaryKey(),
  entityId: text('entity_id').notNull().unique(),
});

const resources = sqliteTable('resources', {
  id: integer('id').primaryKey(),
  entityId: text('entity_id').notNull().unique(),
});

const coords = sqliteTable(
  'coords',
  {
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id),
    actionId: integer('action_id')
      .notNull()
      .references(() => actions.id),
    resourceId: integer('resource_id')
      .notNull()
      .references(() => resources.id),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.actionId, t.resourceId] })],
);

describe('weighted-index ↔ RDBMS materialization 등가성', () => {
  let db: BetterSQLite3Database;

  beforeAll(() => {
    const raw = new Database(':memory:');
    raw.exec(`
      CREATE TABLE roles     (id INTEGER PRIMARY KEY, entity_id TEXT NOT NULL UNIQUE);
      CREATE TABLE actions   (id INTEGER PRIMARY KEY, entity_id TEXT NOT NULL UNIQUE);
      CREATE TABLE resources (id INTEGER PRIMARY KEY, entity_id TEXT NOT NULL UNIQUE);
      CREATE TABLE coords (
        role_id     INTEGER NOT NULL REFERENCES roles(id),
        action_id   INTEGER NOT NULL REFERENCES actions(id),
        resource_id INTEGER NOT NULL REFERENCES resources(id),
        PRIMARY KEY (role_id, action_id, resource_id)
      );
    `);
    db = drizzle({ client: raw });

    db.insert(roles)
      .values(roleLabels.map((entityId, i) => ({ id: i + 1, entityId })))
      .run();
    db.insert(actions)
      .values(actionLabels.map((entityId, i) => ({ id: i + 1, entityId })))
      .run();
    db.insert(resources)
      .values(resourceLabels.map((entityId, i) => ({ id: i + 1, entityId })))
      .run();

    const rows: Array<{ roleId: number; actionId: number; resourceId: number }> = [];
    for (let r = 1; r <= shape[0]; r++) {
      for (let a = 1; a <= shape[1]; a++) {
        for (let res = 1; res <= shape[2]; res++) {
          rows.push({ roleId: r, actionId: a, resourceId: res });
        }
      }
    }
    db.insert(coords).values(rows).run();
  });

  it('[증명1] lex-order row position === WeightedIndex.encode', () => {
    const ordered = db
      .select({
        address: sql<number>`row_number() over (order by ${coords.roleId}, ${coords.actionId}, ${coords.resourceId}) - 1`,
        r: coords.roleId,
        a: coords.actionId,
        x: coords.resourceId,
      })
      .from(coords)
      .all();

    expect(ordered).toHaveLength(WI.size);
    for (const row of ordered) {
      expect(row.address).toBe(WI.encode([row.r, row.a, row.x]));
    }
  });

  it('[증명2] dim JOIN 복원 === PrefixCodec.decodeToIds', () => {
    const target = WI.encode([2, 3, 1]); // editor × delete × doc → 특정 주소

    const [row] = db
      .select({
        roleEntity: roles.entityId,
        actionEntity: actions.entityId,
        resourceEntity: resources.entityId,
      })
      .from(coords)
      .innerJoin(roles, eq(coords.roleId, roles.id))
      .innerJoin(actions, eq(coords.actionId, actions.id))
      .innerJoin(resources, eq(coords.resourceId, resources.id))
      .where(and(eq(coords.roleId, 2), eq(coords.actionId, 3), eq(coords.resourceId, 1)))
      .limit(1)
      .all();

    const decoded = WI.decode(target);
    expect(row.roleEntity).toBe(roleLabels[decoded[0] - 1]);
    expect(row.actionEntity).toBe(actionLabels[decoded[1] - 1]);
    expect(row.resourceEntity).toBe(resourceLabels[decoded[2] - 1]);
  });

  it('[증명3] WHERE 부분 좌표 필터 === calcAddressRanges', () => {
    const sqlAddresses = db
      .select({
        address: sql<number>`row_number() over (order by ${coords.roleId}, ${coords.actionId}, ${coords.resourceId}) - 1`,
        roleId: coords.roleId,
      })
      .from(coords)
      .all()
      .filter((r) => r.roleId === 2)
      .map((r) => r.address);

    const ranges = calcAddressRanges([...shape], ['2', null, null]);
    const wiAddresses: number[] = [];
    for (const [lo, hi] of ranges) {
      for (let n = lo; n <= hi; n++) wiAddresses.push(n);
    }

    expect(sqlAddresses).toEqual(wiAddresses);
    expect(sqlAddresses).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it('[증명4-보조] materialized row count === ∏shape', () => {
    const [{ count }] = db
      .select({ count: sql<number>`count(*)` })
      .from(coords)
      .all();
    expect(count).toBe(WI.size);
    expect(count).toBe(shape[0] * shape[1] * shape[2]);
  });

  it('[증명5-보조] 가장 큰 좌표 주소 === size - 1', () => {
    const maxAddress = db
      .select({
        address: sql<number>`row_number() over (order by ${coords.roleId}, ${coords.actionId}, ${coords.resourceId}) - 1`,
        r: coords.roleId,
        a: coords.actionId,
        x: coords.resourceId,
      })
      .from(coords)
      .orderBy(sql`1 desc`)
      .limit(1)
      .all()[0];

    expect(maxAddress.address).toBe(WI.size - 1);
    expect(WI.encode([maxAddress.r, maxAddress.a, maxAddress.x])).toBe(WI.size - 1);
  });
});
