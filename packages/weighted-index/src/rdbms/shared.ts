// @def.boundary weighted-index-system
// @def.doc weighted-index-system#rdbms-equivalence

/**
 * RDBMS 등가성 증명 공통 fixture.
 *
 * 모든 rdbms/*.test.ts 파일에서 공유되는 shape·label·weight·db helper.
 * 실제 코드 의존 없음 — devDep (better-sqlite3, drizzle-orm).
 */

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { WeightedIndex } from '../math/weighted-index.js';

export const roleLabels = ['admin', 'editor', 'viewer'] as const;
export const actionLabels = ['read', 'write', 'delete'] as const;
export const resourceLabels = ['doc', 'image', 'config'] as const;

export const shape = [roleLabels.length, actionLabels.length, resourceLabels.length] as const;

export const WI = new WeightedIndex([...shape], ['role', 'action', 'resource']);

/** mixed-radix weights: [shape[1]*shape[2], shape[2], 1] = [9, 3, 1] */
export const W = [shape[1] * shape[2], shape[2], 1] as const;

export function freshDb(): {
  raw: Database.Database;
  db: BetterSQLite3Database;
} {
  const raw = new Database(':memory:');
  const db = drizzle({ client: raw });
  return { raw, db };
}
