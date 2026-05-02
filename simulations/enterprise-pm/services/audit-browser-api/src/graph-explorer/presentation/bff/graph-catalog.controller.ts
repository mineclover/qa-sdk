// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import {
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
} from "@nestjs/common";
import { GraphCatalogBff } from "./graph-catalog.bff.js";

/**
 * Graph Explorer BFF 컨트롤러.
 *
 * 기존 graph-explorer.controller.ts 의 라우트를 동일하게 보존:
 *   - GET    /audit/graphs/catalog
 *   - DELETE /audit/graphs/prune/:keepLatest
 *   - GET    /audit/graphs/:graphId/latest
 *   - GET    /audit/graphs/:graphId
 *   - GET    /audit/graphs/snapshots/:snapshotId
 *   - GET    /audit/graphs/diff/:fromSnapshotId/:toSnapshotId
 *   - DELETE /audit/graphs/:graphId/prune/:keepLatest
 */
@Controller("audit/graphs")
export class GraphCatalogController {
  constructor(@Inject(GraphCatalogBff) private readonly bff: GraphCatalogBff) {}

  @Get("catalog")
  async catalog(
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    const result = await this.bff.getCatalog({
      traceId: traceId ?? "trace-catalog",
      correlationId: correlationId ?? traceId ?? "trace-catalog",
    });
    return { count: result.count, graphIds: result.graphIds };
  }

  @Delete("prune/:keepLatest")
  async pruneAll(
    @Param("keepLatest") keepLatest: string,
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    const parsed = Number.parseInt(keepLatest, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new NotFoundException({ error: "invalid_keep_latest", keepLatest });
    }
    return this.bff.pruneAll({
      keepLatest: parsed,
      traceId: traceId ?? "trace-prune-all",
      correlationId: correlationId ?? traceId ?? "trace-prune-all",
    });
  }

  @Get(":graphId/latest")
  async latest(
    @Param("graphId") graphId: string,
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    const snapshot = await this.bff.getLatest({
      graphId,
      traceId: traceId ?? `trace-${graphId}`,
      correlationId: correlationId ?? traceId ?? `trace-${graphId}`,
    });
    if (!snapshot) {
      throw new NotFoundException({ error: "graph_not_found", graphId });
    }
    return snapshot;
  }

  @Get(":graphId")
  async list(
    @Param("graphId") graphId: string,
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    const result = await this.bff.listSnapshots({
      graphId,
      traceId: traceId ?? `trace-${graphId}`,
      correlationId: correlationId ?? traceId ?? `trace-${graphId}`,
    });
    return {
      graphId: result.graphId,
      count: result.count,
      snapshots: result.snapshots,
    };
  }

  @Get("snapshots/:snapshotId")
  async snapshot(
    @Param("snapshotId") snapshotId: string,
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    const snapshot = await this.bff.getSnapshot({
      snapshotId,
      traceId: traceId ?? `trace-${snapshotId}`,
      correlationId: correlationId ?? traceId ?? `trace-${snapshotId}`,
    });
    if (!snapshot) {
      throw new NotFoundException({ error: "snapshot_not_found", snapshotId });
    }
    return snapshot;
  }

  @Get("diff/:fromSnapshotId/:toSnapshotId")
  async diff(
    @Param("fromSnapshotId") fromSnapshotId: string,
    @Param("toSnapshotId") toSnapshotId: string,
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    const diff = await this.bff.getDiff({
      fromSnapshotId,
      toSnapshotId,
      traceId: traceId ?? `trace-diff-${fromSnapshotId}`,
      correlationId: correlationId ?? traceId ?? `trace-diff-${fromSnapshotId}`,
    });
    if (!diff) {
      throw new NotFoundException({
        error: "graph_diff_not_found",
        fromSnapshotId,
        toSnapshotId,
      });
    }
    return diff;
  }

  @Delete(":graphId/prune/:keepLatest")
  async prune(
    @Param("graphId") graphId: string,
    @Param("keepLatest") keepLatest: string,
    @Headers("x-trace-id") traceId?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    const parsed = Number.parseInt(keepLatest, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new NotFoundException({ error: "invalid_keep_latest", keepLatest });
    }
    return this.bff.prune({
      graphId,
      keepLatest: parsed,
      traceId: traceId ?? `trace-${graphId}`,
      correlationId: correlationId ?? traceId ?? `trace-${graphId}`,
    });
  }
}
