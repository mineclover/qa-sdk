// @def.doc definition-service

import type { DefinitionServiceDatabase } from '../database.module.js';
import type { SliceIntentRecord } from '../core/types.js';
import type { IntentStore } from '../core/interfaces.js';
import { sliceIntents } from '../db/schema.js';
import { eq, asc, sql } from 'drizzle-orm';

/** Drizzle select 결과 → SliceIntentRecord 변환 */
type IntentRow = typeof sliceIntents.$inferSelect;

function rowToIntent(row: IntentRow): SliceIntentRecord {
  return {
    id: row.id,
    prefixId: row.prefixId,
    sliceJson: row.sliceJson,
    sliceDepth: row.sliceDepth,
    intent: row.intent,
    observationGoal: row.observationGoal || undefined,
    owner: row.owner || undefined,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** drizzle/better-sqlite3 기반 슬라이스 의도 저장소 */
export class SqlIntentStore implements IntentStore {
  constructor(private readonly db: DefinitionServiceDatabase) {}

  create(intent: {
    prefixId: string;
    sliceJson: string;
    sliceDepth: number;
    intent: string;
    observationGoal?: string;
    owner?: string;
  }): number {
    const result = this.db
      .insert(sliceIntents)
      .values({
        prefixId: intent.prefixId,
        sliceJson: intent.sliceJson,
        sliceDepth: intent.sliceDepth,
        intent: intent.intent,
        observationGoal: intent.observationGoal ?? null,
        owner: intent.owner ?? null,
      })
      .run();
    return Number(result.lastInsertRowid);
  }

  update(id: number, patch: { intent?: string; observationGoal?: string; owner?: string }): void {
    // COALESCE 로직: 제공된 값만 업데이트, 나머지는 기존 값 유지
    this.db
      .update(sliceIntents)
      .set({
        intent: patch.intent !== undefined ? patch.intent : sql`${sliceIntents.intent}`,
        observationGoal:
          patch.observationGoal !== undefined
            ? patch.observationGoal
            : sql`${sliceIntents.observationGoal}`,
        owner: patch.owner !== undefined ? patch.owner : sql`${sliceIntents.owner}`,
        version: sql`${sliceIntents.version} + 1`,
        updatedAt: sql`datetime('now')`,
      })
      .where(eq(sliceIntents.id, id))
      .run();
  }

  remove(id: number): boolean {
    const result = this.db.delete(sliceIntents).where(eq(sliceIntents.id, id)).run();
    return result.changes > 0;
  }

  listByPrefix(prefixId: string): SliceIntentRecord[] {
    return this.db
      .select()
      .from(sliceIntents)
      .where(eq(sliceIntents.prefixId, prefixId))
      .orderBy(asc(sliceIntents.sliceDepth), asc(sliceIntents.id))
      .all()
      .map(rowToIntent);
  }
}
