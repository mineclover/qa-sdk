import type { SqlDriver } from "index-meta";
import type { PrefixOwnerRecord, PrefixProfileMeta } from "../types/index.js";
import type { PrefixOwnerStore, PrefixProfilePatch } from "./prefix-owner-store.js";
import { parseJsonColumn } from "../lib/typed-json.js";

export class SqlPrefixOwnerStore implements PrefixOwnerStore {
  constructor(private readonly driver: SqlDriver) {}

  async register(record: PrefixOwnerRecord): Promise<void> {
    await this.driver.execute(
      `INSERT INTO prefix (prefix, owner, kind, number_type, created_at, meta_json, labels_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.prefix, record.owner, record.kind, record.numberType, record.createdAt,
        record.meta ? JSON.stringify(record.meta) : null,
        record.labels ? JSON.stringify(record.labels) : null,
      ],
    );
  }

  async get(prefix: string): Promise<PrefixOwnerRecord | null> {
    const row = await this.driver.queryOne<PrefixRow>(
      "SELECT * FROM prefix WHERE prefix = ?", [prefix],
    );
    return row ? toRecord(row) : null;
  }

  async list(): Promise<PrefixOwnerRecord[]> {
    const rows = await this.driver.query<PrefixRow>(
      "SELECT * FROM prefix ORDER BY created_at",
    );
    return rows.map(toRecord);
  }

  async delete(prefix: string): Promise<void> {
    await this.driver.execute("DELETE FROM prefix WHERE prefix = ?", [prefix]);
  }

  async patch(prefix: string, patch: PrefixProfilePatch): Promise<void> {
    const existing = await this.get(prefix);
    if (!existing) throw new Error(`Prefix '${prefix}' not found`);

    // meta: 기존 + patch 병합
    const mergedMeta: Record<string, unknown> | undefined = patch.meta
      ? { ...existing.meta, ...patch.meta }
      : existing.meta ? { ...existing.meta } : undefined;
    if (patch.name && mergedMeta) {
      mergedMeta.name = patch.name;
    }

    const mergedLabels = patch.labels ?? existing.labels;

    await this.driver.execute(
      `UPDATE prefix SET meta_json = ?, labels_json = ? WHERE prefix = ?`,
      [
        mergedMeta ? JSON.stringify(mergedMeta) : null,
        mergedLabels ? JSON.stringify(mergedLabels) : null,
        prefix,
      ],
    );
  }
}

interface PrefixRow {
  prefix: string;
  owner: string;
  kind: string;
  number_type: string;
  created_at: string;
  meta_json: string | null;
  labels_json: string | null;
  [key: string]: unknown;
}

function toRecord(row: PrefixRow): PrefixOwnerRecord {
  return {
    prefix: row.prefix,
    owner: row.owner,
    kind: row.kind as "leaf" | "composite",
    numberType: row.number_type as "number" | "bigint",
    createdAt: row.created_at,
    meta: parseJsonColumn<PrefixProfileMeta | undefined>(row.meta_json, undefined),
    labels: parseJsonColumn<string[] | undefined>(row.labels_json, undefined),
  };
}
