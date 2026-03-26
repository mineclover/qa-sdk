import type Database from "better-sqlite3";
import type { SliceIntentRecord } from "../core/types.js";
import type { IntentStore } from "../core/interfaces.js";

/** SQLite row → SliceIntentRecord 변환 */
function rowToIntent(row: Record<string, unknown>): SliceIntentRecord {
  return {
    id: row["id"] as number,
    prefixId: row["prefix_id"] as string,
    sliceJson: row["slice_json"] as string,
    sliceDepth: row["slice_depth"] as number,
    intent: row["intent"] as string,
    observationGoal: (row["observation_goal"] as string) || undefined,
    owner: (row["owner"] as string) || undefined,
    version: row["version"] as number,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}

/** better-sqlite3 기반 슬라이스 의도 저장소 */
export class SqlIntentStore implements IntentStore {
  private readonly stmtInsert;
  private readonly stmtUpdate;
  private readonly stmtDelete;
  private readonly stmtListByPrefix;

  constructor(private readonly db: Database.Database) {
    this.stmtInsert = db.prepare(`
      INSERT INTO slice_intents (prefix_id, slice_json, slice_depth, intent, observation_goal, owner)
      VALUES (@prefix_id, @slice_json, @slice_depth, @intent, @observation_goal, @owner)
    `);
    this.stmtUpdate = db.prepare(`
      UPDATE slice_intents
      SET intent = COALESCE(@intent, intent),
          observation_goal = COALESCE(@observation_goal, observation_goal),
          owner = COALESCE(@owner, owner),
          version = version + 1,
          updated_at = datetime('now')
      WHERE id = @id
    `);
    this.stmtDelete = db.prepare(`DELETE FROM slice_intents WHERE id = ?`);
    this.stmtListByPrefix = db.prepare(
      `SELECT * FROM slice_intents WHERE prefix_id = ? ORDER BY slice_depth ASC, id ASC`,
    );
  }

  create(intent: {
    prefixId: string;
    sliceJson: string;
    sliceDepth: number;
    intent: string;
    observationGoal?: string;
    owner?: string;
  }): number {
    const result = this.stmtInsert.run({
      prefix_id: intent.prefixId,
      slice_json: intent.sliceJson,
      slice_depth: intent.sliceDepth,
      intent: intent.intent,
      observation_goal: intent.observationGoal ?? null,
      owner: intent.owner ?? null,
    });
    return Number(result.lastInsertRowid);
  }

  update(
    id: number,
    patch: { intent?: string; observationGoal?: string; owner?: string },
  ): void {
    this.stmtUpdate.run({
      id,
      intent: patch.intent ?? null,
      observation_goal: patch.observationGoal ?? null,
      owner: patch.owner ?? null,
    });
  }

  remove(id: number): boolean {
    const result = this.stmtDelete.run(id);
    return result.changes > 0;
  }

  listByPrefix(prefixId: string): SliceIntentRecord[] {
    const rows = this.stmtListByPrefix.all(prefixId) as Record<string, unknown>[];
    return rows.map(rowToIntent);
  }
}
