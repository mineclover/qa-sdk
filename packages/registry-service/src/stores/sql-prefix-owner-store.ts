import type { SqlDriver } from "index-meta";
import type { PrefixOwnerRecord } from "../types/index.js";
import type { PrefixOwnerStore } from "./prefix-owner-store.js";

export class SqlPrefixOwnerStore implements PrefixOwnerStore {
  constructor(private readonly driver: SqlDriver) {}

  async register(record: PrefixOwnerRecord): Promise<void> {
    await this.driver.execute(
      `INSERT INTO prefix (prefix, owner, kind, number_type, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [record.prefix, record.owner, record.kind, record.numberType, record.createdAt],
    );
  }

  async get(prefix: string): Promise<PrefixOwnerRecord | null> {
    const row = await this.driver.queryOne<{
      prefix: string;
      owner: string;
      kind: string;
      number_type: string;
      created_at: string;
    }>("SELECT * FROM prefix WHERE prefix = ?", [prefix]);
    return row ? toRecord(row) : null;
  }

  async list(): Promise<PrefixOwnerRecord[]> {
    const rows = await this.driver.query<{
      prefix: string;
      owner: string;
      kind: string;
      number_type: string;
      created_at: string;
    }>("SELECT * FROM prefix ORDER BY created_at");
    return rows.map(toRecord);
  }

  async delete(prefix: string): Promise<void> {
    await this.driver.execute("DELETE FROM prefix WHERE prefix = ?", [prefix]);
  }
}

function toRecord(row: {
  prefix: string;
  owner: string;
  kind: string;
  number_type: string;
  created_at: string;
}): PrefixOwnerRecord {
  return {
    prefix: row.prefix,
    owner: row.owner,
    kind: row.kind as "leaf" | "composite",
    numberType: row.number_type as "number" | "bigint",
    createdAt: row.created_at,
  };
}
