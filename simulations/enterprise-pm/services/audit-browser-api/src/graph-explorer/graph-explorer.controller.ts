// @def.boundary sim-audit-browser-api
// @def.doc authorization-graph-store

import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { GraphExplorerService } from "./graph-explorer.service.js";

@Controller("audit/graphs")
export class GraphExplorerController {
  constructor(
    @Inject(GraphExplorerService) private readonly svc: GraphExplorerService,
  ) {}

  @Get(":graphId/latest")
  async latest(@Param("graphId") graphId: string) {
    const snapshot = await this.svc.latest(graphId);
    if (!snapshot) {
      throw new NotFoundException({ error: "graph_not_found", graphId });
    }
    return snapshot;
  }

  @Get("snapshots/:snapshotId")
  async snapshot(@Param("snapshotId") snapshotId: string) {
    const snapshot = await this.svc.getSnapshot(snapshotId);
    if (!snapshot) {
      throw new NotFoundException({ error: "snapshot_not_found", snapshotId });
    }
    return snapshot;
  }
}
