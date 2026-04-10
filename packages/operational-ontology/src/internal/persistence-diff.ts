import { isDeepStrictEqual } from "node:util";

import type { OperationalOntologyStore } from "./persistence-memory.js";
import {
  loadOperationalOntologyCorridorView,
  loadOperationalOntologySnapshotView,
  type OperationalOntologyCorridorView,
  type OperationalOntologySnapshotView,
} from "./persistence-query.js";

export type OperationalOntologyDiffStatus =
  | "added"
  | "removed"
  | "changed"
  | "unchanged";

export interface OperationalOntologyCorridorDiff {
  corridorId: string;
  status: OperationalOntologyDiffStatus;
  changedSections: string[];
  endpointCountDelta: number;
  contractCountDelta: number;
  linkCountDelta: number;
  checkpointLatticeCountDelta: number;
  routeDecisionCountDelta: number;
  traversalBundleCountDelta: number;
  from: OperationalOntologyCorridorView | null;
  to: OperationalOntologyCorridorView | null;
}

export interface OperationalOntologySnapshotDiffSummary {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
}

export interface OperationalOntologySnapshotDiff {
  fromSnapshotId: string;
  toSnapshotId: string;
  summary: OperationalOntologySnapshotDiffSummary;
  corridorDiffs: OperationalOntologyCorridorDiff[];
  checkpointLatticeCountDelta: number;
  routeDecisionCountDelta: number;
  traversalBundleCountDelta: number;
}

function summarizeStatuses(
  diffs: readonly OperationalOntologyCorridorDiff[],
): OperationalOntologySnapshotDiffSummary {
  return diffs.reduce<OperationalOntologySnapshotDiffSummary>(
    (summary, diff) => {
      summary[diff.status] += 1;
      return summary;
    },
    {
      added: 0,
      removed: 0,
      changed: 0,
      unchanged: 0,
    },
  );
}

function diffCorridorViews(
  corridorId: string,
  from: OperationalOntologyCorridorView | null,
  to: OperationalOntologyCorridorView | null,
): OperationalOntologyCorridorDiff {
  if (!from && !to) {
    throw new Error(`Corridor diff requires at least one side: ${corridorId}`);
  }

  if (!from) {
    return {
      corridorId,
      status: "added",
      changedSections: [],
      endpointCountDelta: to!.corridor.endpoints.length,
      contractCountDelta: to!.corridor.contracts.length,
      linkCountDelta: to!.corridor.links.length,
      checkpointLatticeCountDelta: to!.checkpointLattices.length,
      routeDecisionCountDelta: to!.routeDecisions.length,
      traversalBundleCountDelta: to!.traversalBundles.length,
      from: null,
      to,
    };
  }

  if (!to) {
    return {
      corridorId,
      status: "removed",
      changedSections: [],
      endpointCountDelta: -from.corridor.endpoints.length,
      contractCountDelta: -from.corridor.contracts.length,
      linkCountDelta: -from.corridor.links.length,
      checkpointLatticeCountDelta: -from.checkpointLattices.length,
      routeDecisionCountDelta: -from.routeDecisions.length,
      traversalBundleCountDelta: -from.traversalBundles.length,
      from,
      to: null,
    };
  }

  const changedSections: string[] = [];
  if (!isDeepStrictEqual(from.corridor, to.corridor)) changedSections.push("corridor");
  if (!isDeepStrictEqual(from.controlFlow, to.controlFlow)) {
    changedSections.push("controlFlow");
  }
  if (!isDeepStrictEqual(from.checkpointLattices, to.checkpointLattices)) {
    changedSections.push("checkpointLattices");
  }
  if (!isDeepStrictEqual(from.routeDecisions, to.routeDecisions)) {
    changedSections.push("routeDecisions");
  }
  if (!isDeepStrictEqual(from.junctions, to.junctions)) {
    changedSections.push("junctions");
  }
  if (!isDeepStrictEqual(from.traversalBundles, to.traversalBundles)) {
    changedSections.push("traversalBundles");
  }

  return {
    corridorId,
    status: changedSections.length > 0 ? "changed" : "unchanged",
    changedSections,
    endpointCountDelta:
      to.corridor.endpoints.length - from.corridor.endpoints.length,
    contractCountDelta:
      to.corridor.contracts.length - from.corridor.contracts.length,
    linkCountDelta: to.corridor.links.length - from.corridor.links.length,
    checkpointLatticeCountDelta:
      to.checkpointLattices.length - from.checkpointLattices.length,
    routeDecisionCountDelta:
      to.routeDecisions.length - from.routeDecisions.length,
    traversalBundleCountDelta:
      to.traversalBundles.length - from.traversalBundles.length,
    from,
    to,
  };
}

export async function diffOperationalOntologyCorridor(
  store: Pick<OperationalOntologyStore, "listProjections" | "getObjectBundle">,
  corridorId: string,
  fromSnapshotId: string,
  toSnapshotId: string,
): Promise<OperationalOntologyCorridorDiff | null> {
  const [from, to] = await Promise.all([
    loadOperationalOntologyCorridorView(store, fromSnapshotId, corridorId),
    loadOperationalOntologyCorridorView(store, toSnapshotId, corridorId),
  ]);

  if (!from && !to) {
    return null;
  }

  return diffCorridorViews(corridorId, from, to);
}

export async function diffOperationalOntologySnapshots(
  store: Pick<OperationalOntologyStore, "listProjections" | "getObjectBundle">,
  fromSnapshotId: string,
  toSnapshotId: string,
): Promise<OperationalOntologySnapshotDiff | null> {
  const [from, to] = await Promise.all([
    loadOperationalOntologySnapshotView(store, fromSnapshotId),
    loadOperationalOntologySnapshotView(store, toSnapshotId),
  ]);

  if (!from || !to) {
    return null;
  }

  const corridorIds = new Set<string>([
    ...from.corridors.map((corridor) => corridor.flowId),
    ...to.corridors.map((corridor) => corridor.flowId),
  ]);

  const corridorDiffs = await Promise.all(
    [...corridorIds].map(async (corridorId) =>
      diffCorridorViews(
        corridorId,
        await loadOperationalOntologyCorridorView(store, fromSnapshotId, corridorId),
        await loadOperationalOntologyCorridorView(store, toSnapshotId, corridorId),
      ),
    ),
  );

  return {
    fromSnapshotId,
    toSnapshotId,
    summary: summarizeStatuses(corridorDiffs),
    corridorDiffs,
    checkpointLatticeCountDelta:
      to.checkpointLattices.length - from.checkpointLattices.length,
    routeDecisionCountDelta:
      to.routeDecisions.length - from.routeDecisions.length,
    traversalBundleCountDelta:
      to.traversalBundles.length - from.traversalBundles.length,
  };
}
