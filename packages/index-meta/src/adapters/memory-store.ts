// @def.boundary index-meta-system
// @def.doc index-meta-system

import type {
  IndexMetaStore,
  SchemaVersionRecord,
  EntryRecord,
} from "../index-meta-store.js";
import { ValidationError } from "../errors.js";
import type { EntityId } from "../types.js";
import { validateEntryForInsert } from "./validate-entry.js";

/**
 * In-memory implementation of IndexMetaStore.
 *
 * NOT concurrency-safe. Intended for testing and single-instance use only.
 * For production environments with concurrent access, use SqlStore or D1Store
 * which provide database-level uniqueness constraints and transactional safety.
 */
export class InMemoryIndexMetaStore implements IndexMetaStore {
  /** "prefix:versionId" → SchemaVersionRecord */
  private readonly _versions = new Map<string, SchemaVersionRecord>();

  /** "prefix:versionId:position" → EntryRecord */
  private readonly _entries = new Map<string, EntryRecord>();

  // ── schema_version ──────────────────────────────────────

  async insertSchemaVersion(record: SchemaVersionRecord): Promise<void> {
    const key = `${record.prefix}:${record.versionId}`;
    if (this._versions.has(key)) {
      throw new ValidationError(
        `SchemaVersion already exists: "${record.prefix}/${record.versionId}"`
      );
    }
    this._versions.set(key, record);
  }

  async getSchemaVersions(prefix: string): Promise<SchemaVersionRecord[]> {
    return [...this._versions.values()]
      .filter((r) => r.prefix === prefix)
      .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getSchemaVersion(
    prefix: string,
    versionId: string
  ): Promise<SchemaVersionRecord | null> {
    return this._versions.get(`${prefix}:${versionId}`) ?? null;
  }

  async getCapacity(prefix: string, versionId: string): Promise<number | null> {
    return this._versions.get(`${prefix}:${versionId}`)?.capacity ?? null;
  }

  // ── entry ───────────────────────────────────────────────

  async insertEntry(record: EntryRecord): Promise<void> {
    const versionKey = `${record.prefix}:${record.versionId}`;
    const version = this._versions.get(versionKey) ?? null;
    const entryKey = `${record.prefix}:${record.versionId}:${record.position}`;
    const existing = this._entries.get(entryKey) ?? null;

    validateEntryForInsert(record, version, existing);

    this._entries.set(entryKey, record);
  }

  async getEntries(prefix: string, versionId: string): Promise<EntryRecord[]> {
    return [...this._entries.values()]
      .filter((r) => r.prefix === prefix && r.versionId === versionId)
      .toSorted((a, b) => a.position - b.position);
  }

  async getEntriesInRange(
    prefix: string,
    versionId: string,
    from: number,
    to: number
  ): Promise<EntryRecord[]> {
    return [...this._entries.values()]
      .filter(
        (r) =>
          r.prefix === prefix &&
          r.versionId === versionId &&
          r.position >= from &&
          r.position <= to
      )
      .toSorted((a, b) => a.position - b.position);
  }

  async getEntry(
    prefix: string,
    versionId: string,
    position: number
  ): Promise<EntryRecord | null> {
    return this._entries.get(`${prefix}:${versionId}:${position}`) ?? null;
  }

  async getEntryByValue(
    prefix: string,
    versionId: string,
    value: EntityId
  ): Promise<EntryRecord | null> {
    const strValue = String(value);
    for (const r of this._entries.values()) {
      if (r.prefix === prefix && r.versionId === versionId && String(r.value) === strValue) {
        return r;
      }
    }
    return null;
  }

  async migrateEntries(
    prefix: string,
    fromVersion: string,
    toVersion: string,
    positionMap?: Record<number, number>
  ): Promise<{ migrated: number; skipped: number }> {
    const sv = this._versions.get(`${prefix}:${toVersion}`);
    if (!sv) {
      throw new ValidationError(
        `SchemaVersion not found: "${prefix}/${toVersion}". Insert schema version first.`
      );
    }

    const sourceEntries = await this.getEntries(prefix, fromVersion);
    const now = new Date().toISOString();
    let migrated = 0;
    let skipped = 0;

    // Collect all pending inserts first, then apply atomically.
    // If validation fails, no entries are written (all-or-nothing).
    const pending: { key: string; record: EntryRecord }[] = [];

    for (const entry of sourceEntries) {
      const newPosition = positionMap?.[entry.position] ?? entry.position;
      if (newPosition < 1 || newPosition > sv.capacity) {
        throw new ValidationError(
          `Mapped position ${newPosition} out of range [1, ${sv.capacity}] for "${prefix}/${toVersion}"`
        );
      }
      const entryKey = `${prefix}:${toVersion}:${newPosition}`;
      if (this._entries.has(entryKey)) {
        skipped++;
        continue;
      }
      pending.push({
        key: entryKey,
        record: {
          prefix,
          versionId: toVersion,
          position: newPosition,
          value: entry.value,
          createdAt: now,
        },
      });
      migrated++;
    }

    // Atomic apply — only reached if all validations passed.
    for (const { key, record } of pending) {
      this._entries.set(key, record);
    }

    return { migrated, skipped };
  }
}
