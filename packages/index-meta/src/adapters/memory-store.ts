import { ValidationError } from "../errors.js";
import type {
  IndexMetaStore,
  SchemaVersionRecord,
  EntryRecord,
} from "../index-meta-store.js";

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
    const version = this._versions.get(versionKey);

    if (!version) {
      throw new ValidationError(
        `SchemaVersion not found: "${record.tableId}/${record.versionId}". Insert schema version first.`
      );
    }
    if (record.position < 1 || record.position > version.capacity) {
      throw new ValidationError(
        `Position ${record.position} out of range [1, ${version.capacity}] for "${record.tableId}/${record.versionId}"`
      );
    }

    const entryKey = `${record.tableId}:${record.versionId}:${record.position}`;
    if (this._entries.has(entryKey)) {
      throw new ValidationError(
        `Entry already exists at position ${record.position} in "${record.tableId}/${record.versionId}"`
      );
    }

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
}
