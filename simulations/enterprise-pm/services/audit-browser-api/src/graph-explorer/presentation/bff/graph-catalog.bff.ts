// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import {
  GraphStoreQueryPort,
  type GraphRetentionPruneAllResult,
  type GraphRetentionPruneResult,
} from '../../application/ports/graph-store-query.port.js';
import type { GraphExplorerLoggerPort } from '../../application/ports/graph-explorer-logger.port.js';
import {
  buildGraphRetentionGraphLog,
  buildGraphRetentionSweepLog,
} from '../../application/events/graph-retention-event.js';
import type {
  AuthorizationGraphDiff,
  AuthorizationGraphSnapshotRecord,
} from 'authorization-ontology';

/** BFF — graph catalog 화면용 응답. */
export interface GraphCatalogBffModel {
  readonly count: number;
  readonly graphIds: readonly string[];
  readonly cacheKey: string;
}

export interface GraphSnapshotsBffModel {
  readonly graphId: string;
  readonly count: number;
  readonly snapshots: readonly AuthorizationGraphSnapshotRecord[];
  readonly cacheKey: string;
}

/**
 * Graph Catalog BFF.
 *
 * - GraphStoreQueryPort 의 read 만 합성 (write/persist 없음).
 * - 기존 graph-explorer.controller.ts 의 라우트별 응답 shape 유지.
 * - prune (DELETE) 는 maintenance command. validator 는 BFF 에서 repository
 *   쓰기 메서드 호출만 검출하므로 graph store 의 prune() 호출은 허용.
 */
export class GraphCatalogBff {
  readonly cachePrefix = 'graph-explorer-bff-catalog:v1';

  constructor(
    private readonly graphs: GraphStoreQueryPort,
    private readonly logger: GraphExplorerLoggerPort,
  ) {}

  async getCatalog(input: {
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<GraphCatalogBffModel> {
    const cacheKey = `${this.cachePrefix}:catalog`;
    const graphIds = await this.graphs.graphIds();
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: 'graph-explorer',
        useCase: 'GraphCatalogBff.getCatalog',
        queryName: 'GraphCatalogQuery',
        outcome: 'success',
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      'graph-catalog.bff.success',
    );
    return { count: graphIds.length, graphIds, cacheKey };
  }

  async getLatest(input: {
    readonly graphId: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<AuthorizationGraphSnapshotRecord | null> {
    const snapshot = await this.graphs.latest(input.graphId);
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: 'graph-explorer',
        useCase: 'GraphCatalogBff.getLatest',
        aggregateId: input.graphId,
        queryName: 'GraphLatestSnapshotQuery',
        outcome: snapshot ? 'success' : 'failure',
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      snapshot ? 'graph-catalog.bff.latest.found' : 'graph-catalog.bff.latest.miss',
    );
    return snapshot;
  }

  async listSnapshots(input: {
    readonly graphId: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<GraphSnapshotsBffModel> {
    const cacheKey = `${this.cachePrefix}:list:${input.graphId}`;
    const snapshots = await this.graphs.list(input.graphId);
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: 'graph-explorer',
        useCase: 'GraphCatalogBff.listSnapshots',
        aggregateId: input.graphId,
        queryName: 'GraphSnapshotsListQuery',
        outcome: 'success',
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      'graph-catalog.bff.list.success',
    );
    return { graphId: input.graphId, count: snapshots.length, snapshots, cacheKey };
  }

  async getSnapshot(input: {
    readonly snapshotId: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<AuthorizationGraphSnapshotRecord | null> {
    const snapshot = await this.graphs.getSnapshot(input.snapshotId);
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: 'graph-explorer',
        useCase: 'GraphCatalogBff.getSnapshot',
        aggregateId: input.snapshotId,
        queryName: 'GraphSnapshotByIdQuery',
        outcome: snapshot ? 'success' : 'failure',
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      snapshot ? 'graph-catalog.bff.snapshot.found' : 'graph-catalog.bff.snapshot.miss',
    );
    return snapshot;
  }

  async getDiff(input: {
    readonly fromSnapshotId: string;
    readonly toSnapshotId: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<AuthorizationGraphDiff | null> {
    const diff = await this.graphs.diff(input.fromSnapshotId, input.toSnapshotId);
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: 'graph-explorer',
        useCase: 'GraphCatalogBff.getDiff',
        queryName: 'GraphDiffQuery',
        outcome: diff ? 'success' : 'failure',
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      diff ? 'graph-catalog.bff.diff.success' : 'graph-catalog.bff.diff.miss',
    );
    return diff;
  }

  async prune(input: {
    readonly graphId: string;
    readonly keepLatest: number;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<GraphRetentionPruneResult> {
    const result = await this.graphs.prune(input.graphId, input.keepLatest);
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: 'graph-explorer',
        useCase: 'GraphCatalogBff.prune',
        aggregateId: input.graphId,
        commandName: 'PruneGraphRetentionCommand',
        outcome: 'success',
        ...buildGraphRetentionGraphLog({
          trigger: 'api',
          graphId: input.graphId,
          keepLatest: input.keepLatest,
          beforeCount: result.beforeCount,
          afterCount: result.afterCount,
          deletedSnapshotIds: result.deletedSnapshotIds,
          keptSnapshotIds: result.keptSnapshotIds,
        }),
      },
      'graph retention prune requested via API',
    );
    return result;
  }

  async pruneAll(input: {
    readonly keepLatest: number;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<GraphRetentionPruneAllResult> {
    const result = await this.graphs.pruneAll(input.keepLatest);
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: 'graph-explorer',
        useCase: 'GraphCatalogBff.pruneAll',
        commandName: 'PruneAllGraphRetentionCommand',
        outcome: 'success',
        ...buildGraphRetentionSweepLog({
          trigger: 'api',
          keepLatest: input.keepLatest,
          graphCount: result.graphCount,
          beforeCount: result.beforeCount,
          afterCount: result.afterCount,
          deletedSnapshotIds: result.deletedSnapshotIds,
          graphIds: result.graphIds,
        }),
      },
      'graph retention sweep requested via API',
    );
    return result;
  }
}
