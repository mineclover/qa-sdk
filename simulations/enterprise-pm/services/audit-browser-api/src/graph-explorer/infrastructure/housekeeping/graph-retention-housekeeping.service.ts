// @def.boundary sim-audit-browser-api
// @def.doc authorization-graph-store

import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { SLICE_LOGGER_PORT, type LoggerPort } from '@qa-sdk/sim-domain-slice-kit';
import { GraphStoreQueryPort } from '../../application/ports/graph-store-query.port.js';
import {
  buildGraphRetentionFailureLog,
  buildGraphRetentionSweepLog,
} from '../../application/events/graph-retention-event.js';

export interface GraphRetentionHousekeepingOptions {
  readonly keepLatest?: number;
  readonly intervalMs?: number;
  readonly runOnBoot: boolean;
}

export const GRAPH_RETENTION_HOUSEKEEPING_OPTIONS = Symbol.for(
  'sim-audit-browser-api/graph-explorer/HousekeepingOptions',
);

/**
 * Authorization graph snapshot 의 주기적/부팅시 retention sweep.
 *
 * graph-explorer 슬라이스의 maintenance 책임. BFF read 합성과 분리되며 SLICE_LOGGER_PORT
 * 를 통해 retention 이벤트를 ingest 로 전달.
 */
@Injectable()
export class GraphRetentionHousekeepingService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(GraphStoreQueryPort) private readonly graphs: GraphStoreQueryPort,
    @Inject(GRAPH_RETENTION_HOUSEKEEPING_OPTIONS)
    private readonly options: GraphRetentionHousekeepingOptions,
    @Inject(SLICE_LOGGER_PORT) private readonly logger: LoggerPort,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.options.keepLatest === undefined) return;

    if (this.options.runOnBoot) {
      await this.runSweep('boot');
    }

    if (this.options.intervalMs !== undefined && this.options.intervalMs > 0) {
      this.timer = setInterval(() => {
        void this.runSweep('interval');
      }, this.options.intervalMs);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runSweep(trigger: 'boot' | 'interval'): Promise<void> {
    const keepLatest = this.options.keepLatest;
    if (keepLatest === undefined) return;

    try {
      const result = await this.graphs.pruneAll(keepLatest);
      this.logger.info(
        {
          domain: 'graph-explorer',
          useCase: 'GraphRetentionHousekeepingService.runSweep',
          outcome: 'success',
          ...buildGraphRetentionSweepLog({
            trigger,
            keepLatest,
            graphCount: result.graphCount,
            beforeCount: result.beforeCount,
            afterCount: result.afterCount,
            deletedSnapshotIds: result.deletedSnapshotIds,
            graphIds: result.graphIds,
          }),
        },
        'graph retention housekeeping completed',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        {
          domain: 'graph-explorer',
          useCase: 'GraphRetentionHousekeepingService.runSweep',
          outcome: 'failure',
          err: error,
          ...buildGraphRetentionFailureLog({ trigger, keepLatest, error: message }),
        },
        'graph retention housekeeping failed',
      );
    }
  }
}
