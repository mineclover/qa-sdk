// @def.doc definition-service

import type { DefinitionServiceDatabase } from '../database.module.js';
import { prefixRegistry } from '../db/schema.js';
import { eq, asc, type SQL } from 'drizzle-orm';

/** prefix 레지스트리 레코드 */
export interface PrefixRecord {
  prefixId: string;
  name: string;
  description?: string;
  category?: string;
  labels: string[];
  dims: Record<string, { kind: string; axisId?: string; prefixId?: string; table?: string }>;
  versions: { version: string; axisVersions: Record<string, string> }[];
  meta: Record<string, unknown>;
  /** prefix_ref 의존 — dims에서 prefix_ref인 것의 prefixId 목록 */
  depPrefixIds: string[];
  version: number;
  registeredAt: string;
  updatedAt: string;
}

export interface PrefixStore {
  upsert(record: PrefixRecord): { action: 'created' | 'updated' | 'unchanged' };
  get(prefixId: string): PrefixRecord | null;
  list(filter?: { category?: string }): PrefixRecord[];
  remove(prefixId: string): boolean;
}

/** Drizzle select 결과 → PrefixRecord 변환 */
type PrefixRow = typeof prefixRegistry.$inferSelect;

function rowToRecord(row: PrefixRow): PrefixRecord {
  return {
    prefixId: row.prefixId,
    name: row.name,
    description: row.description || undefined,
    category: row.category || undefined,
    labels: row.labelsJson,
    dims: row.dimsJson,
    versions: row.versionsJson,
    meta: row.metaJson,
    depPrefixIds: row.depPrefixIds,
    version: row.version,
    registeredAt: row.registeredAt,
    updatedAt: row.updatedAt,
  };
}

export class SqlPrefixStore implements PrefixStore {
  constructor(private readonly db: DefinitionServiceDatabase) {}

  upsert(record: PrefixRecord): { action: 'created' | 'updated' | 'unchanged' } {
    const existing = this.get(record.prefixId);
    const now = new Date().toISOString();

    const values = {
      prefixId: record.prefixId,
      name: record.name,
      description: record.description ?? null,
      category: record.category ?? null,
      labelsJson: record.labels,
      dimsJson: record.dims,
      versionsJson: record.versions,
      metaJson: record.meta,
      depPrefixIds: record.depPrefixIds,
      version: existing ? existing.version + 1 : 1,
      registeredAt: existing?.registeredAt ?? now,
      updatedAt: now,
    };

    this.db
      .insert(prefixRegistry)
      .values(values)
      .onConflictDoUpdate({
        target: prefixRegistry.prefixId,
        set: {
          name: values.name,
          description: values.description,
          category: values.category,
          labelsJson: values.labelsJson,
          dimsJson: values.dimsJson,
          versionsJson: values.versionsJson,
          metaJson: values.metaJson,
          depPrefixIds: values.depPrefixIds,
          version: values.version,
          updatedAt: values.updatedAt,
        },
      })
      .run();

    return { action: existing ? 'updated' : 'created' };
  }

  get(prefixId: string): PrefixRecord | null {
    const row = this.db
      .select()
      .from(prefixRegistry)
      .where(eq(prefixRegistry.prefixId, prefixId))
      .get();
    return row ? rowToRecord(row) : null;
  }

  list(filter?: { category?: string }): PrefixRecord[] {
    const conditions: SQL[] = [];
    if (filter?.category) {
      conditions.push(eq(prefixRegistry.category, filter.category));
    }

    return this.db
      .select()
      .from(prefixRegistry)
      .where(conditions.length > 0 ? conditions[0] : undefined)
      .orderBy(asc(prefixRegistry.prefixId))
      .all()
      .map(rowToRecord);
  }

  remove(prefixId: string): boolean {
    const result = this.db
      .delete(prefixRegistry)
      .where(eq(prefixRegistry.prefixId, prefixId))
      .run();
    return result.changes > 0;
  }
}
