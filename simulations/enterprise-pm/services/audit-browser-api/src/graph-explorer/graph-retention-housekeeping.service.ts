// @def.boundary sim-audit-browser-api
// @def.doc authorization-graph-store

import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { createLogger } from "../lib/logger.js";
import { GraphExplorerService } from "./graph-explorer.service.js";
import {
  buildGraphRetentionFailureLog,
  buildGraphRetentionSweepLog,
} from "./graph-retention-event.js";

export interface GraphRetentionHousekeepingOptions {
  keepLatest?: number;
  intervalMs?: number;
  runOnBoot: boolean;
}

export const GRAPH_RETENTION_HOUSEKEEPING_OPTIONS = Symbol(
  "GRAPH_RETENTION_HOUSEKEEPING_OPTIONS",
);

@Injectable()
export class GraphRetentionHousekeepingService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = createLogger(
    "sim-audit-browser-api.graph-retention-housekeeping",
  );
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(GraphExplorerService)
    private readonly graphs: GraphExplorerService,
    @Inject(GRAPH_RETENTION_HOUSEKEEPING_OPTIONS)
    private readonly options: GraphRetentionHousekeepingOptions,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.options.keepLatest === undefined) {
      return;
    }

    if (this.options.runOnBoot) {
      await this.runSweep("boot");
    }

    if (
      this.options.intervalMs !== undefined &&
      this.options.intervalMs > 0
    ) {
      this.timer = setInterval(() => {
        void this.runSweep("interval");
      }, this.options.intervalMs);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runSweep(trigger: "boot" | "interval"): Promise<void> {
    const keepLatest = this.options.keepLatest;
    if (keepLatest === undefined) {
      return;
    }

    try {
      const result = await this.graphs.pruneAll(keepLatest);
      this.logger.info(
        buildGraphRetentionSweepLog({
          trigger,
          keepLatest,
          graphCount: result.graphCount,
          beforeCount: result.beforeCount,
          afterCount: result.afterCount,
          deletedSnapshotIds: result.deletedSnapshotIds,
          graphIds: result.graphIds,
        }),
        "graph retention housekeeping completed",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        buildGraphRetentionFailureLog({
          trigger,
          keepLatest,
          error: message,
        }),
        "graph retention housekeeping failed",
      );
    }
  }
}
