// @def.doc definition-service

import { Injectable, Inject } from "@nestjs/common";
import { DRIZZLE_DB, type DefinitionServiceDatabase } from "../../database.module.js";
import { SqlConsumptionStore } from "../../stores/consumption-store.js";
import type { ConsumptionStore } from "../../core/interfaces.js";
import type { ConsumptionSnapshot } from "../../core/types.js";
import { computeRate } from "../../core/consumption-diagnostics.js";

@Injectable()
export class ConsumptionService {
  private readonly store: ConsumptionStore;

  constructor(@Inject(DRIZZLE_DB) db: DefinitionServiceDatabase) {
    this.store = new SqlConsumptionStore(db);
  }

  record(prefixId: string, data: {
    prefixVersion: string;
    totalSpace: number;
    observedAddresses: number;
    dimStats: Record<string, unknown>;
  }): { id: number; consumptionRate: number } {
    const consumptionRate = computeRate(data.totalSpace, data.observedAddresses);
    const id = this.store.record({
      prefixId,
      prefixVersion: data.prefixVersion,
      collectedAt: new Date().toISOString(),
      totalSpace: data.totalSpace,
      observedAddresses: data.observedAddresses,
      consumptionRate,
      dimStatsJson: JSON.stringify(data.dimStats),
    });
    return { id, consumptionRate };
  }

  latest(prefixId: string): ConsumptionSnapshot | null {
    return this.store.latest(prefixId);
  }

  history(prefixId: string, limit?: number): ConsumptionSnapshot[] {
    return this.store.history(prefixId, limit);
  }
}
