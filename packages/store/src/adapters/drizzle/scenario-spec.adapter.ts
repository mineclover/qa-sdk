// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { eq } from 'drizzle-orm';
import type { ScenarioSpecStore } from '@qa-sdk/core';
import type { ScenarioSpec } from '@qa-sdk/core';
import type { DbExecutor } from '../../db/client.js';
import { scenarioSpecs } from '../../db/schema.js';

/** ScenarioSpecStore의 Drizzle/PostgreSQL 구현 */
export class DrizzleScenarioSpecStore implements ScenarioSpecStore {
  constructor(private readonly db: DbExecutor) {}

  async upsert(spec: ScenarioSpec): Promise<void> {
    await this.db
      .insert(scenarioSpecs)
      .values({
        scenarioId: spec.scenario_id,
        version: spec.version,
        domain: spec.domain,
        description: spec.description,
        spec,
      })
      .onConflictDoUpdate({
        target: scenarioSpecs.scenarioId,
        set: {
          version: spec.version,
          domain: spec.domain,
          description: spec.description,
          spec,
          updatedAt: new Date(),
        },
      })
      .comment({ adapter: 'ScenarioSpecStore', method: 'upsert' });
  }

  async findById(scenarioId: string): Promise<ScenarioSpec | null> {
    const [row] = await this.db
      .select()
      .from(scenarioSpecs)
      .where(eq(scenarioSpecs.scenarioId, scenarioId))
      .comment({ adapter: 'ScenarioSpecStore', method: 'findById' });
    return row ? (row.spec as ScenarioSpec) : null;
  }

  async findAll(limit?: number): Promise<ScenarioSpec[]> {
    const query = this.db
      .select()
      .from(scenarioSpecs)
      .comment({ adapter: 'ScenarioSpecStore', method: 'findAll' });
    const rows = limit ? await query.limit(limit) : await query;
    return rows.map((row) => row.spec as ScenarioSpec);
  }

  async findByDomain(domain: string, limit?: number): Promise<ScenarioSpec[]> {
    const query = this.db
      .select()
      .from(scenarioSpecs)
      .where(eq(scenarioSpecs.domain, domain))
      .comment({ adapter: 'ScenarioSpecStore', method: 'findByDomain' });
    const rows = limit ? await query.limit(limit) : await query;
    return rows.map((row) => row.spec as ScenarioSpec);
  }

  async remove(scenarioId: string): Promise<boolean> {
    const result = await this.db
      .delete(scenarioSpecs)
      .where(eq(scenarioSpecs.scenarioId, scenarioId))
      .returning({ id: scenarioSpecs.scenarioId })
      .comment({ adapter: 'ScenarioSpecStore', method: 'remove' });
    return result.length > 0;
  }
}
