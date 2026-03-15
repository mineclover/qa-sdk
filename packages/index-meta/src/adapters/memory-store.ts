import type {
  IndexMetaStore,
  SchemaVersionRecord,
  EntryRecord,
} from "../index-meta-store.js";
import { ValidationError } from "../errors.js";
import { validateEntryForInsert } from "./validate-entry.js";

/**
 * In-memory implementation of IndexMetaStore.
 *
 * NOT concurrency-safe. Intended for testing and single-instance use only.
 * For production environments with concurrent access, use SqlStore or D1Store
 * which provide database-level uniqueness constraints and transactional safety.
 */
export class InMemoryIndexMetaStore implements IndexMetaStore {
  /** "tableId:versionId" → SchemaVersionRecord */
  private readonly _versions = new Map<string, SchemaVersionRecord>();

  /** "tableId:versionId:position" → EntryRecord */
  private readonly _entries = new Map<string, EntryRecord>();

  // ── schema_version ──────────────────────────────────────

  async insertSchemaVersion(record: SchemaVersionRecord): Promise<void> {
    const key = `${record.tableId}:${record.versionId}`;
    if (this._versions.has(key)) {
      throw new ValidationError(
        `SchemaVersion already exists: "${record.tableId}/${record.versionId}"`
      );
    }
    this._versions.set(key, record);
  }

  async getSchemaVersions(tableId: string): Promise<SchemaVersionRecord[]> {
    return [...this._versions.values()]
      .filter((r) => r.tableId === tableId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getSchemaVersion(
    tableId: string,
    versionId: string
  ): Promise<SchemaVersionRecord | null> {
    return this._versions.get(`${tableId}:${versionId}`) ?? null;
  }

  async getCapacity(tableId: string, versionId: string): Promise<number | null> {
    return this._versions.get(`${tableId}:${versionId}`)?.capacity ?? null;
  }

  // ── entry ───────────────────────────────────────────────

  async insertEntry(record: EntryRecord): Promise<void> {
    const versionKey = `${record.tableId}:${record.versionId}`;
    const version = this._versions.get(versionKey) ?? null;
    const entryKey = `${record.tableId}:${record.versionId}:${record.position}`;
    const existing = this._entries.get(entryKey) ?? null;

    validateEntryForInsert(record, version, existing);

    this._entries.set(entryKey, record);
  }

  async getEntries(tableId: string, versionId: string): Promise<EntryRecord[]> {
    return [...this._entries.values()]
      .filter((r) => r.tableId === tableId && r.versionId === versionId)
      .sort((a, b) => a.position - b.position);
  }

  async getEntriesInRange(
    tableId: string,
    versionId: string,
    from: number,
    to: number
  ): Promise<EntryRecord[]> {
    return [...this._entries.values()]
      .filter(
        (r) =>
          r.tableId === tableId &&
          r.versionId === versionId &&
          r.position >= from &&
          r.position <= to
      )
      .sort((a, b) => a.position - b.position);
  }

  async getEntry(
    tableId: string,
    versionId: string,
    position: number
  ): Promise<EntryRecord | null> {
    return this._entries.get(`${tableId}:${versionId}:${position}`) ?? null;
  }

  async migrateEntries(
    tableId: string,
    fromVersion: string,
    toVersion: string,
    positionMap?: Record<number, number>
  ): Promise<{ migrated: number; skipped: number }> {
    const sv = this._versions.get(`${tableId}:${toVersion}`);
    if (!sv) {
      throw new ValidationError(
        `SchemaVersion not found: "${tableId}/${toVersion}". Insert schema version first.`
      );
    }

    const sourceEntries = await this.getEntries(tableId, fromVersion);
    const now = new Date().toISOString();
    let migrated = 0;
    let skipped = 0;

    for (const entry of sourceEntries) {
      const newPosition = positionMap?.[entry.position] ?? entry.position;
      if (newPosition < 1 || newPosition > sv.capacity) {
        throw new ValidationError(
          `Mapped position ${newPosition} out of range [1, ${sv.capacity}] for "${tableId}/${toVersion}"`
        );
      }
      const entryKey = `${tableId}:${toVersion}:${newPosition}`;
      if (this._entries.has(entryKey)) {
        skipped++;
        continue;
      }
      this._entries.set(entryKey, {
        tableId,
        versionId: toVersion,
        position: newPosition,
        value: entry.value,
        createdAt: now,
      });
      migrated++;
    }

    return { migrated, skipped };
  }
}
