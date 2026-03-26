import type Database from "better-sqlite3";
import type { ConsumptionSnapshot } from "../core/types.js";
import type { ConsumptionStore } from "../core/interfaces.js";
import { diagnoseSnapshot } from "../core/consumption-diagnostics.js";

/** SQLite row → ConsumptionSnapshot 변환 */
function rowToSnapshot(row: Record<string, unknown>): ConsumptionSnapshot {
  return {
    id: row["id"] as number,
    prefixId: row["prefix_id"] as string,
    prefixVersion: row["prefix_version"] as string,
    collectedAt: row["collected_at"] as string,
    totalSpace: row["total_space"] as number,
    observedAddresses: row["observed_addresses"] as number,
    consumptionRate: row["consumption_rate"] as number,
    dimStatsJson: row["dim_stats_json"] as string,
    severity: (row["severity"] as string) || undefined,
  };
}

/** better-sqlite3 기반 소비율 스냅샷 저장소 */
export class SqlConsumptionStore implements ConsumptionStore {
  private readonly stmtInsert;
  private readonly stmtLatest;
  private readonly stmtHistory;

  constructor(private readonly db: Database.Database) {
    this.stmtInsert = db.prepare(`
      INSERT INTO consumption_snapshots (prefix_id, prefix_version, collected_at, total_space, observed_addresses, consumption_rate, dim_stats_json, severity)
      VALUES (@prefix_id, @prefix_version, @collected_at, @total_space, @observed_addresses, @consumption_rate, @dim_stats_json, @severity)
    `);
    this.stmtLatest = db.prepare(
      `SELECT * FROM consumption_snapshots WHERE prefix_id = ? ORDER BY collected_at DESC LIMIT 1`,
    );
    this.stmtHistory = db.prepare(
      `SELECT * FROM consumption_snapshots WHERE prefix_id = ? ORDER BY collected_at DESC LIMIT ?`,
    );
  }

  record(snapshot: ConsumptionSnapshot): number {
    const diagnosis = diagnoseSnapshot(snapshot);
    const result = this.stmtInsert.run({
      prefix_id: snapshot.prefixId,
      prefix_version: snapshot.prefixVersion,
      collected_at: snapshot.collectedAt,
      total_space: snapshot.totalSpace,
      observed_addresses: snapshot.observedAddresses,
      consumption_rate: snapshot.consumptionRate,
      dim_stats_json: snapshot.dimStatsJson,
      severity: diagnosis.severity,
    });
    return Number(result.lastInsertRowid);
  }

  latest(prefixId: string): ConsumptionSnapshot | null {
    const row = this.stmtLatest.get(prefixId) as Record<string, unknown> | undefined;
    return row ? rowToSnapshot(row) : null;
  }

  history(prefixId: string, limit = 30): ConsumptionSnapshot[] {
    const rows = this.stmtHistory.all(prefixId, limit) as Record<string, unknown>[];
    return rows.map(rowToSnapshot);
  }
}
