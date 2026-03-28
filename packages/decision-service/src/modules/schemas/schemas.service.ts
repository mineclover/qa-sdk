import { Inject, Injectable } from "@nestjs/common";
import type Database from "better-sqlite3";
import { DATABASE } from "../../database.module.js";

export interface FlowSchemaRecord {
  schemaId: string;
  name: string;
  description?: string;
  version: string;
  gates: { id: string; label: string; weight: string; phase: string; branches: { id: string; label: string }[] }[];
  outcomes: { id: string; label: string }[];
  meta: Record<string, unknown>;
  registeredAt: string;
  updatedAt: string;
}

function rowToSchema(row: Record<string, unknown>): FlowSchemaRecord {
  return {
    schemaId: row["schema_id"] as string,
    name: row["name"] as string,
    description: (row["description"] as string) || undefined,
    version: row["version"] as string,
    gates: JSON.parse((row["gates"] as string) || "[]"),
    outcomes: JSON.parse((row["outcomes"] as string) || "[]"),
    meta: JSON.parse((row["meta"] as string) || "{}"),
    registeredAt: row["registered_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}

@Injectable()
export class SchemasService {
  constructor(@Inject(DATABASE) private readonly db: Database.Database) {}

  register(input: {
    schemaId: string;
    name: string;
    description?: string;
    version?: string;
    gates: FlowSchemaRecord["gates"];
    outcomes?: FlowSchemaRecord["outcomes"];
    meta?: Record<string, unknown>;
  }): FlowSchemaRecord {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO flow_schemas (schema_id, name, description, version, gates, outcomes, meta, registered_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(schema_id) DO UPDATE SET
        name=excluded.name, description=excluded.description, version=excluded.version,
        gates=excluded.gates, outcomes=excluded.outcomes,
        meta=excluded.meta, updated_at=excluded.updated_at
    `).run(
      input.schemaId, input.name, input.description ?? null,
      input.version ?? "v1",
      JSON.stringify(input.gates), JSON.stringify(input.outcomes ?? []),
      JSON.stringify(input.meta ?? {}), now, now,
    );
    return this.get(input.schemaId)!;
  }

  get(schemaId: string): FlowSchemaRecord | null {
    const row = this.db.prepare("SELECT * FROM flow_schemas WHERE schema_id = ?").get(schemaId) as Record<string, unknown> | undefined;
    return row ? rowToSchema(row) : null;
  }

  list(): FlowSchemaRecord[] {
    const rows = this.db.prepare("SELECT * FROM flow_schemas ORDER BY schema_id").all() as Record<string, unknown>[];
    return rows.map(rowToSchema);
  }

  delete(schemaId: string): boolean {
    const result = this.db.prepare("DELETE FROM flow_schemas WHERE schema_id = ?").run(schemaId);
    return result.changes > 0;
  }
}
