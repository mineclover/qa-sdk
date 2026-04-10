import { isDeepStrictEqual } from "node:util";

import type { CheckpointLattice } from "./checkpoint-core.js";
import type { JunctionDefinition, RouteDecision } from "./junction-core.js";
import type {
  OperationalOntologyObjectBundle,
  OperationalOntologyStore,
} from "./persistence-memory.js";
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

export interface OperationalOntologyCheckpointDiff {
  rootCheckpointId: string;
  status: OperationalOntologyDiffStatus;
  changedSections: string[];
  definitionCountDelta: number;
  observationCountDelta: number;
  linkCountDelta: number;
  from: CheckpointLattice | null;
  to: CheckpointLattice | null;
}

export interface OperationalOntologyJunctionDiff {
  junctionId: string;
  status: OperationalOntologyDiffStatus;
  changedSections: string[];
  pathCountDelta: number;
  routeDecisionCountDelta: number;
  from: JunctionDefinition | null;
  to: JunctionDefinition | null;
}

export interface OperationalOntologyRouteDecisionDiff {
  branchNodeId: string;
  status: OperationalOntologyDiffStatus;
  changedSections: string[];
  selectedPathCountDelta: number;
  skippedPathCountDelta: number;
  from: RouteDecision | null;
  to: RouteDecision | null;
}

export interface OperationalOntologyTraversalDiff {
  traversalKey: string;
  status: OperationalOntologyDiffStatus;
  changedSections: string[];
  facetCountDelta: number;
  observationCountDelta: number;
  from: OperationalOntologyObjectBundle | null;
  to: OperationalOntologyObjectBundle | null;
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

function diffCheckpointLattices(
  rootCheckpointId: string,
  from: CheckpointLattice | null,
  to: CheckpointLattice | null,
): OperationalOntologyCheckpointDiff {
  if (!from && !to) {
    throw new Error(`Checkpoint diff requires at least one side: ${rootCheckpointId}`);
  }
  if (!from) {
    return {
      rootCheckpointId,
      status: "added",
      changedSections: [],
      definitionCountDelta: to!.definitions.length,
      observationCountDelta: to!.observations.length,
      linkCountDelta: to!.links.length,
      from: null,
      to,
    };
  }
  if (!to) {
    return {
      rootCheckpointId,
      status: "removed",
      changedSections: [],
      definitionCountDelta: -from.definitions.length,
      observationCountDelta: -from.observations.length,
      linkCountDelta: -from.links.length,
      from,
      to: null,
    };
  }

  const changedSections: string[] = [];
  if (!isDeepStrictEqual(from.definitions, to.definitions)) changedSections.push("definitions");
  if (!isDeepStrictEqual(from.observations, to.observations)) changedSections.push("observations");
  if (!isDeepStrictEqual(from.links, to.links)) changedSections.push("links");

  return {
    rootCheckpointId,
    status: changedSections.length > 0 ? "changed" : "unchanged",
    changedSections,
    definitionCountDelta: to.definitions.length - from.definitions.length,
    observationCountDelta: to.observations.length - from.observations.length,
    linkCountDelta: to.links.length - from.links.length,
    from,
    to,
  };
}

function diffJunctions(
  junctionId: string,
  from: JunctionDefinition | null,
  to: JunctionDefinition | null,
  fromRouteDecisionCount: number,
  toRouteDecisionCount: number,
): OperationalOntologyJunctionDiff {
  if (!from && !to) {
    throw new Error(`Junction diff requires at least one side: ${junctionId}`);
  }
  if (!from) {
    return {
      junctionId,
      status: "added",
      changedSections: [],
      pathCountDelta: to!.paths.length,
      routeDecisionCountDelta: toRouteDecisionCount,
      from: null,
      to,
    };
  }
  if (!to) {
    return {
      junctionId,
      status: "removed",
      changedSections: [],
      pathCountDelta: -from.paths.length,
      routeDecisionCountDelta: -fromRouteDecisionCount,
      from,
      to: null,
    };
  }

  const changedSections: string[] = [];
  if (!isDeepStrictEqual(from, to)) changedSections.push("junction");
  if (fromRouteDecisionCount !== toRouteDecisionCount) changedSections.push("routeDecisions");

  return {
    junctionId,
    status: changedSections.length > 0 ? "changed" : "unchanged",
    changedSections,
    pathCountDelta: to.paths.length - from.paths.length,
    routeDecisionCountDelta: toRouteDecisionCount - fromRouteDecisionCount,
    from,
    to,
  };
}

function diffRouteDecisions(
  branchNodeId: string,
  from: RouteDecision | null,
  to: RouteDecision | null,
): OperationalOntologyRouteDecisionDiff {
  if (!from && !to) {
    throw new Error(`Route decision diff requires at least one side: ${branchNodeId}`);
  }
  if (!from) {
    return {
      branchNodeId,
      status: "added",
      changedSections: [],
      selectedPathCountDelta: to!.selectedPathIds.length,
      skippedPathCountDelta: to!.skippedPathIds.length,
      from: null,
      to,
    };
  }
  if (!to) {
    return {
      branchNodeId,
      status: "removed",
      changedSections: [],
      selectedPathCountDelta: -from.selectedPathIds.length,
      skippedPathCountDelta: -from.skippedPathIds.length,
      from,
      to: null,
    };
  }

  const changedSections: string[] = [];
  if (!isDeepStrictEqual(from, to)) changedSections.push("routeDecision");

  return {
    branchNodeId,
    status: changedSections.length > 0 ? "changed" : "unchanged",
    changedSections,
    selectedPathCountDelta: to.selectedPathIds.length - from.selectedPathIds.length,
    skippedPathCountDelta: to.skippedPathIds.length - from.skippedPathIds.length,
    from,
    to,
  };
}

function diffTraversalBundles(
  traversalKey: string,
  from: OperationalOntologyObjectBundle | null,
  to: OperationalOntologyObjectBundle | null,
): OperationalOntologyTraversalDiff {
  if (!from && !to) {
    throw new Error(`Traversal diff requires at least one side: ${traversalKey}`);
  }
  if (!from) {
    return {
      traversalKey,
      status: "added",
      changedSections: [],
      facetCountDelta: to!.facets.length,
      observationCountDelta: to!.observations.length,
      from: null,
      to,
    };
  }
  if (!to) {
    return {
      traversalKey,
      status: "removed",
      changedSections: [],
      facetCountDelta: -from.facets.length,
      observationCountDelta: -from.observations.length,
      from,
      to: null,
    };
  }

  const changedSections: string[] = [];
  if (!isDeepStrictEqual(from.facets, to.facets)) changedSections.push("facets");
  if (!isDeepStrictEqual(from.observations, to.observations)) changedSections.push("observations");
  if (!isDeepStrictEqual(from.object, to.object)) changedSections.push("object");

  return {
    traversalKey,
    status: changedSections.length > 0 ? "changed" : "unchanged",
    changedSections,
    facetCountDelta: to.facets.length - from.facets.length,
    observationCountDelta: to.observations.length - from.observations.length,
    from,
    to,
  };
}

export async function diffOperationalOntologyCheckpoint(
  store: Pick<OperationalOntologyStore, "listProjections" | "getObjectBundle">,
  rootCheckpointId: string,
  fromSnapshotId: string,
  toSnapshotId: string,
): Promise<OperationalOntologyCheckpointDiff | null> {
  const [from, to] = await Promise.all([
    loadOperationalOntologySnapshotView(store, fromSnapshotId),
    loadOperationalOntologySnapshotView(store, toSnapshotId),
  ]);
  const fromLattice =
    from?.checkpointLattices.find((lattice) => lattice.rootCheckpointId === rootCheckpointId) ??
    null;
  const toLattice =
    to?.checkpointLattices.find((lattice) => lattice.rootCheckpointId === rootCheckpointId) ??
    null;
  if (!fromLattice && !toLattice) {
    return null;
  }
  return diffCheckpointLattices(rootCheckpointId, fromLattice, toLattice);
}

export async function diffOperationalOntologyJunction(
  store: Pick<OperationalOntologyStore, "listProjections" | "getObjectBundle">,
  junctionId: string,
  fromSnapshotId: string,
  toSnapshotId: string,
): Promise<OperationalOntologyJunctionDiff | null> {
  const [from, to] = await Promise.all([
    loadOperationalOntologySnapshotView(store, fromSnapshotId),
    loadOperationalOntologySnapshotView(store, toSnapshotId),
  ]);
  const fromJunction =
    from?.junctions.find((junction) => junction.branchNodeId === junctionId) ?? null;
  const toJunction =
    to?.junctions.find((junction) => junction.branchNodeId === junctionId) ?? null;
  if (!fromJunction && !toJunction) {
    return null;
  }
  return diffJunctions(
    junctionId,
    fromJunction,
    toJunction,
    from?.routeDecisions.filter(
      (decision) => (decision.junctionId ?? decision.branchNodeId) === junctionId,
    ).length ?? 0,
    to?.routeDecisions.filter(
      (decision) => (decision.junctionId ?? decision.branchNodeId) === junctionId,
    ).length ?? 0,
  );
}

export async function diffOperationalOntologyRouteDecision(
  store: Pick<OperationalOntologyStore, "listProjections" | "getObjectBundle">,
  branchNodeId: string,
  fromSnapshotId: string,
  toSnapshotId: string,
): Promise<OperationalOntologyRouteDecisionDiff | null> {
  const [from, to] = await Promise.all([
    loadOperationalOntologySnapshotView(store, fromSnapshotId),
    loadOperationalOntologySnapshotView(store, toSnapshotId),
  ]);
  const fromRoute =
    from?.routeDecisions.find((route) => route.branchNodeId === branchNodeId) ?? null;
  const toRoute =
    to?.routeDecisions.find((route) => route.branchNodeId === branchNodeId) ?? null;
  if (!fromRoute && !toRoute) {
    return null;
  }
  return diffRouteDecisions(branchNodeId, fromRoute, toRoute);
}

export async function diffOperationalOntologyTraversal(
  store: Pick<OperationalOntologyStore, "listProjections" | "getObjectBundle">,
  traversalKey: string,
  fromSnapshotId: string,
  toSnapshotId: string,
): Promise<OperationalOntologyTraversalDiff | null> {
  const [from, to] = await Promise.all([
    loadOperationalOntologySnapshotView(store, fromSnapshotId),
    loadOperationalOntologySnapshotView(store, toSnapshotId),
  ]);
  const fromBundle =
    from?.traversalBundles.find((bundle) => bundle.object.canonicalKey === traversalKey) ??
    null;
  const toBundle =
    to?.traversalBundles.find((bundle) => bundle.object.canonicalKey === traversalKey) ??
    null;
  if (!fromBundle && !toBundle) {
    return null;
  }
  return diffTraversalBundles(traversalKey, fromBundle, toBundle);
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
