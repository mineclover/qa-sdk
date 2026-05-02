// @def.boundary ingest-system
// @def.doc ingest-system

import { desc, eq } from "drizzle-orm";
import type { ScenarioSpecStore } from "@qa-sdk/core";
import type { ScenarioSpec } from "@qa-sdk/core";
import { scenarioSpecs } from "../db/schema.js";
import type { D1Db } from "./d1-db-type.js";

export class D1ScenarioSpecStore implements ScenarioSpecStore {
  constructor(private readonly db: D1Db) {}

  async upsert(spec: ScenarioSpec): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .insert(scenarioSpecs)
      .values({
        scenarioId: spec.scenario_id,
        version: spec.version,
        domain: spec.domain,
        description: spec.description ?? null,
        spec: JSON.stringify(spec),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: scenarioSpecs.scenarioId,
        set: {
          version: spec.version,
          domain: spec.domain,
          description: spec.description ?? null,
          spec: JSON.stringify(spec),
          updatedAt: now,
        },
      });
  }

  async findById(scenarioId: string): Promise<ScenarioSpec | null> {
    const [row] = await this.db
      .select()
      .from(scenarioSpecs)
      .where(eq(scenarioSpecs.scenarioId, scenarioId));
    if (!row) return null;
    try {
      return JSON.parse(row.spec) as ScenarioSpec;
    } catch {
      return null;
    }
  }

  async findAll(limit = 100): Promise<ScenarioSpec[]> {
    const rows = await this.db
      .select()
      .from(scenarioSpecs)
      .orderBy(desc(scenarioSpecs.updatedAt))
      .limit(limit);
    return rows.map(r => JSON.parse(r.spec) as ScenarioSpec);
  }

  async findByDomain(domain: string, limit = 100): Promise<ScenarioSpec[]> {
    const rows = await this.db
      .select()
      .from(scenarioSpecs)
      .where(eq(scenarioSpecs.domain, domain))
      .orderBy(desc(scenarioSpecs.updatedAt))
      .limit(limit);
    return rows.map(r => JSON.parse(r.spec) as ScenarioSpec);
  }

  async remove(scenarioId: string): Promise<boolean> {
    const result = await this.db
      .delete(scenarioSpecs)
      .where(eq(scenarioSpecs.scenarioId, scenarioId));
    return (result as any).changes > 0 || (result as any).rowsAffected > 0;
  }
}
