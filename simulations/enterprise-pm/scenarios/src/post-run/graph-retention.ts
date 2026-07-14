// @def.boundary sim-scenarios
// @def.doc authorization-graph-store

export interface GraphRetentionSweepResponse {
  keepLatest: number;
  graphIds: string[];
  graphCount: number;
  beforeCount: number;
  afterCount: number;
  deletedSnapshotIds: string[];
  graphs: Array<{
    graphId: string;
    beforeCount: number;
    afterCount: number;
    deletedSnapshotIds: string[];
    keptSnapshotIds: string[];
  }>;
}

export interface GraphRetentionGraphResponse {
  graphId: string;
  beforeCount: number;
  afterCount: number;
  deletedSnapshotIds: string[];
  keptSnapshotIds: string[];
}

export type GraphRetentionResponse = GraphRetentionSweepResponse | GraphRetentionGraphResponse;

export interface GraphRetentionArgs {
  keepLatest: number;
  graphId?: string;
}

export async function fetchGraphRetention(
  auditUrl: string,
  args: GraphRetentionArgs,
): Promise<GraphRetentionResponse> {
  const path = args.graphId
    ? `/audit/graphs/${args.graphId}/prune/${args.keepLatest}`
    : `/audit/graphs/prune/${args.keepLatest}`;
  const res = await fetch(new URL(path, auditUrl), { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`fetchGraphRetention ${path}: status=${res.status} body=${await res.text()}`);
  }
  return (await res.json()) as GraphRetentionResponse;
}

export function summarizeGraphRetention(result: GraphRetentionResponse): string {
  if ('graphCount' in result) {
    return [
      `graph-retention sweep keepLatest=${result.keepLatest}`,
      `graphs=${result.graphCount}`,
      `snapshots ${result.beforeCount} -> ${result.afterCount}`,
      `deleted=${result.deletedSnapshotIds.length}`,
    ].join(' | ');
  }

  return [
    `graph-retention graph=${result.graphId}`,
    `snapshots ${result.beforeCount} -> ${result.afterCount}`,
    `deleted=${result.deletedSnapshotIds.length}`,
  ].join(' | ');
}
