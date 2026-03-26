import type Database from "better-sqlite3";

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
  upsert(record: PrefixRecord): { action: "created" | "updated" | "unchanged" };
  get(prefixId: string): PrefixRecord | null;
  list(filter?: { category?: string }): PrefixRecord[];
  remove(prefixId: string): boolean;
}

function rowToRecord(row: Record<string, unknown>): PrefixRecord {
  return {
    prefixId: row["prefix_id"] as string,
    name: row["name"] as string,
    description: (row["description"] as string) || undefined,
    category: (row["category"] as string) || undefined,
    labels: JSON.parse((row["labels_json"] as string) || "[]"),
    dims: JSON.parse((row["dims_json"] as string) || "{}"),
    versions: JSON.parse((row["versions_json"] as string) || "[]"),
    meta: JSON.parse((row["meta_json"] as string) || "{}"),
    depPrefixIds: JSON.parse((row["dep_prefix_ids"] as string) || "[]"),
    version: row["version"] as number,
    registeredAt: row["registered_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}

export class SqlPrefixStore implements PrefixStore {
  private readonly stmtGet;
  private readonly stmtUpsert;
  private readonly stmtDelete;

  constructor(private readonly db: Database.Database) {
    this.stmtGet = db.prepare("SELECT * FROM prefix_registry WHERE prefix_id = ?");
    this.stmtUpsert = db.prepare(`
      INSERT INTO prefix_registry (prefix_id, name, description, category, labels_json, dims_json, versions_json, meta_json, dep_prefix_ids, version, registered_at, updated_at)
      VALUES (@prefix_id, @name, @description, @category, @labels_json, @dims_json, @versions_json, @meta_json, @dep_prefix_ids, @version, @registered_at, @updated_at)
      ON CONFLICT(prefix_id) DO UPDATE SET
        name=@name, description=@description, category=@category,
        labels_json=@labels_json, dims_json=@dims_json, versions_json=@versions_json,
        meta_json=@meta_json, dep_prefix_ids=@dep_prefix_ids,
        version=version+1, updated_at=@updated_at
    `);
    this.stmtDelete = db.prepare("DELETE FROM prefix_registry WHERE prefix_id = ?");
  }

  upsert(record: PrefixRecord): { action: "created" | "updated" | "unchanged" } {
    const existing = this.get(record.prefixId);
    const now = new Date().toISOString();

    this.stmtUpsert.run({
      prefix_id: record.prefixId,
      name: record.name,
      description: record.description ?? null,
      category: record.category ?? null,
      labels_json: JSON.stringify(record.labels),
      dims_json: JSON.stringify(record.dims),
      versions_json: JSON.stringify(record.versions),
      meta_json: JSON.stringify(record.meta),
      dep_prefix_ids: JSON.stringify(record.depPrefixIds),
      version: existing ? existing.version + 1 : 1,
      registered_at: existing?.registeredAt ?? now,
      updated_at: now,
    });

    return { action: existing ? "updated" : "created" };
  }

  get(prefixId: string): PrefixRecord | null {
    const row = this.stmtGet.get(prefixId) as Record<string, unknown> | undefined;
    return row ? rowToRecord(row) : null;
  }

  list(filter?: { category?: string }): PrefixRecord[] {
    let sql = "SELECT * FROM prefix_registry";
    const params: unknown[] = [];
    if (filter?.category) {
      sql += " WHERE category = ?";
      params.push(filter.category);
    }
    sql += " ORDER BY prefix_id";
    return (this.db.prepare(sql).all(...params) as Record<string, unknown>[]).map(rowToRecord);
  }

  remove(prefixId: string): boolean {
    return this.stmtDelete.run(prefixId).changes > 0;
  }
}
