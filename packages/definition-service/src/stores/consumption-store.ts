import type { DefinitionServiceDatabase } from "../database.module.js";
import type { ConsumptionSnapshot } from "../core/types.js";
import type { ConsumptionStore } from "../core/interfaces.js";
import { diagnoseSnapshot } from "../core/consumption-diagnostics.js";
import { consumptionSnapshots } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

/** Drizzle select 결과 → ConsumptionSnapshot 변환 */
type SnapshotRow = typeof consumptionSnapshots.$inferSelect;

function rowToSnapshot(row: SnapshotRow): ConsumptionSnapshot {
  return {
    id: row.id,
    prefixId: row.prefixId,
    prefixVersion: row.prefixVersion,
    collectedAt: row.collectedAt,
    totalSpace: row.totalSpace,
    observedAddresses: row.observedAddresses,
    consumptionRate: row.consumptionRate,
    dimStatsJson: row.dimStatsJson,
    severity: row.severity || undefined,
  };
}

/** drizzle/better-sqlite3 기반 소비율 스냅샷 저장소 */
export class SqlConsumptionStore implements ConsumptionStore {
  constructor(private readonly db: DefinitionServiceDatabase) {}

  record(snapshot: ConsumptionSnapshot): number {
    const diagnosis = diagnoseSnapshot(snapshot);
    const result = this.db
      .insert(consumptionSnapshots)
      .values({
        prefixId: snapshot.prefixId,
        prefixVersion: snapshot.prefixVersion,
        collectedAt: snapshot.collectedAt,
        totalSpace: snapshot.totalSpace,
        observedAddresses: snapshot.observedAddresses,
        consumptionRate: snapshot.consumptionRate,
        dimStatsJson: snapshot.dimStatsJson,
        severity: diagnosis.severity,
      })
      .run();
    return Number(result.lastInsertRowid);
  }

  latest(prefixId: string): ConsumptionSnapshot | null {
    const row = this.db
      .select()
      .from(consumptionSnapshots)
      .where(eq(consumptionSnapshots.prefixId, prefixId))
      .orderBy(desc(consumptionSnapshots.collectedAt))
      .limit(1)
      .get();
    return row ? rowToSnapshot(row) : null;
  }

  history(prefixId: string, limit = 30): ConsumptionSnapshot[] {
    return this.db
      .select()
      .from(consumptionSnapshots)
      .where(eq(consumptionSnapshots.prefixId, prefixId))
      .orderBy(desc(consumptionSnapshots.collectedAt))
      .limit(limit)
      .all()
      .map(rowToSnapshot);
  }
}
