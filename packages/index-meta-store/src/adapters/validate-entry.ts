// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * validate-entry.ts — Shared entry validation logic for IndexMetaStore adapters.
 *
 * Extracts the common position validation (schema version existence check,
 * position range check, duplicate position check) used by memory-store,
 * sql-store, and d1-store into a single utility.
 */

import type { SchemaVersionRecord, EntryRecord } from 'index-meta';
import { ValidationError } from 'index-meta';

/**
 * Validate an entry record before insertion.
 *
 * Checks:
 * 1. Schema version must exist (caller provides it or null).
 * 2. Position must be within [1, capacity].
 * 3. No duplicate position (caller provides existing entry or null).
 *
 * @param record - The entry to validate
 * @param schemaVersion - The schema version record, or null if not found
 * @param existingEntry - An existing entry at the same position, or null if none
 * @throws {ValidationError} if any check fails
 */
export function validateEntryForInsert(
  record: EntryRecord,
  schemaVersion: SchemaVersionRecord | null,
  existingEntry: EntryRecord | null,
): void {
  if (!schemaVersion) {
    throw new ValidationError(
      `SchemaVersion not found: "${record.prefix}/${record.versionId}". Insert schema version first.`,
    );
  }
  if (record.position < 1 || record.position > schemaVersion.capacity) {
    throw new ValidationError(
      `Position ${record.position} out of range [1, ${schemaVersion.capacity}] for "${record.prefix}/${record.versionId}"`,
    );
  }
  if (existingEntry) {
    throw new ValidationError(
      `Entry already exists at position ${record.position} in "${record.prefix}/${record.versionId}"`,
    );
  }
}
