import type { SqlDriver } from "index-meta";
import type { DraftLock } from "../types/index.js";
import type { DraftLockStore } from "./draft-lock-store.js";

export class SqlDraftLockStore implements DraftLockStore {
  constructor(private readonly driver: SqlDriver) {}

  async acquire(lock: DraftLock): Promise<void> {
    await this.driver.execute(
      `INSERT OR REPLACE INTO draft_lock (prefix, version_id, locked_at)
       VALUES (?, ?, ?)`,
      [lock.prefix, lock.versionId, lock.lockedAt],
    );
  }

  async release(prefix: string, versionId: string): Promise<boolean> {
    const result = await this.driver.execute(
      "DELETE FROM draft_lock WHERE prefix = ? AND version_id = ?",
      [prefix, versionId],
    );
    return (result?.rowsAffected ?? 0) > 0;
  }

  async get(prefix: string, versionId: string): Promise<DraftLock | null> {
    const row = await this.driver.queryOne<{
      prefix: string;
      version_id: string;
      locked_at: string;
    }>(
      "SELECT * FROM draft_lock WHERE prefix = ? AND version_id = ?",
      [prefix, versionId],
    );
    return row ? toRecord(row) : null;
  }

  async isLocked(prefix: string, versionId: string): Promise<boolean> {
    const row = await this.driver.queryOne<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM draft_lock WHERE prefix = ? AND version_id = ?",
      [prefix, versionId],
    );
    return (row?.cnt ?? 0) > 0;
  }

  async listAll(): Promise<DraftLock[]> {
    const rows = await this.driver.query<{
      prefix: string;
      version_id: string;
      locked_at: string;
    }>("SELECT * FROM draft_lock ORDER BY locked_at");
    return rows.map(toRecord);
  }
}

function toRecord(row: {
  prefix: string;
  version_id: string;
  locked_at: string;
}): DraftLock {
  return {
    prefix: row.prefix,
    versionId: row.version_id,
    lockedAt: row.locked_at,
  };
}
