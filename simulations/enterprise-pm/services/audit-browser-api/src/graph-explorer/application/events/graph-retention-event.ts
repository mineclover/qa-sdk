// @def.boundary sim-audit-browser-api
// @def.doc authorization-graph-store

const SERVICE_CONTEXT = "service:v1:sim-audit-browser-api";
const HOUSEKEEPING_CONTEXT = "housekeeping:v1:graph-retention";

export interface GraphRetentionSweepLogInput {
  trigger: "api" | "boot" | "interval";
  keepLatest: number;
  graphCount: number;
  beforeCount: number;
  afterCount: number;
  deletedSnapshotIds: readonly string[];
  graphIds: readonly string[];
}

export interface GraphRetentionGraphLogInput {
  trigger: "api";
  graphId: string;
  keepLatest: number;
  beforeCount: number;
  afterCount: number;
  deletedSnapshotIds: readonly string[];
  keptSnapshotIds: readonly string[];
}

export interface GraphRetentionFailureLogInput {
  trigger: "boot" | "interval";
  keepLatest: number;
  error: string;
}

export function buildGraphRetentionSweepLog(
  input: GraphRetentionSweepLogInput,
): Record<string, unknown> {
  return {
    eventKey: "sim.graph_retention.sweep",
    addressContext: {
      service: SERVICE_CONTEXT,
      housekeeping: HOUSEKEEPING_CONTEXT,
      graph_scope: "authorization_graph:v1:all",
    },
    trigger: input.trigger,
    keepLatest: input.keepLatest,
    graphCount: input.graphCount,
    beforeCount: input.beforeCount,
    afterCount: input.afterCount,
    deletedCount: input.deletedSnapshotIds.length,
    graphIds: input.graphIds,
    deletedSnapshotIds: input.deletedSnapshotIds,
  };
}

export function buildGraphRetentionGraphLog(
  input: GraphRetentionGraphLogInput,
): Record<string, unknown> {
  return {
    eventKey: "sim.graph_retention.graph_pruned",
    addressContext: {
      service: SERVICE_CONTEXT,
      housekeeping: HOUSEKEEPING_CONTEXT,
      graph: `authorization_graph:v1:${input.graphId}`,
    },
    trigger: input.trigger,
    graphId: input.graphId,
    keepLatest: input.keepLatest,
    beforeCount: input.beforeCount,
    afterCount: input.afterCount,
    deletedCount: input.deletedSnapshotIds.length,
    deletedSnapshotIds: input.deletedSnapshotIds,
    keptSnapshotIds: input.keptSnapshotIds,
  };
}

export function buildGraphRetentionFailureLog(
  input: GraphRetentionFailureLogInput,
): Record<string, unknown> {
  return {
    eventKey: "sim.graph_retention.failed",
    addressContext: {
      service: SERVICE_CONTEXT,
      housekeeping: HOUSEKEEPING_CONTEXT,
      graph_scope: "authorization_graph:v1:all",
    },
    trigger: input.trigger,
    keepLatest: input.keepLatest,
    error: input.error,
  };
}
