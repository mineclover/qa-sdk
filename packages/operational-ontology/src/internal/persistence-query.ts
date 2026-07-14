import type { CheckpointLattice, CheckpointObservation } from './checkpoint-core.js';
import type { FlowCorridor } from './corridor-core.js';
import type { JunctionDefinition, RouteDecision } from './junction-core.js';
import type { OperationalOntologyProjectionRecord } from './persistence-core.js';
import type {
  OperationalOntologyObjectBundle,
  OperationalOntologyStore,
} from './persistence-memory.js';
import {
  loadOperationalOntologySnapshot,
  OPERATIONAL_ONTOLOGY_CHECKPOINT_LATTICE_PROJECTION_KIND,
  OPERATIONAL_ONTOLOGY_CONTROL_FLOW_PROJECTION_KIND,
  OPERATIONAL_ONTOLOGY_CORRIDOR_PROJECTION_KIND,
  OPERATIONAL_ONTOLOGY_JUNCTION_PROJECTION_KIND,
  OPERATIONAL_ONTOLOGY_ROUTE_DECISION_PROJECTION_KIND,
  OPERATIONAL_ONTOLOGY_SNAPSHOT_PROJECTION_KIND,
} from './persistence-snapshot.js';
import type { OperationalOntologySnapshot } from './projector-types.js';
import { createTraversalCanonicalKey, type ControlFlowGraph } from './runtime-core.js';

export interface OperationalOntologySnapshotView {
  snapshotProjection: OperationalOntologyProjectionRecord;
  snapshot: OperationalOntologySnapshot;
  corridors: FlowCorridor[];
  controlFlows: ControlFlowGraph[];
  checkpointLattices: CheckpointLattice[];
  junctions: JunctionDefinition[];
  routeDecisions: RouteDecision[];
  traversalBundles: OperationalOntologyObjectBundle[];
}

export interface OperationalOntologyCorridorView {
  snapshotProjection: OperationalOntologyProjectionRecord;
  corridor: FlowCorridor;
  controlFlow: ControlFlowGraph | null;
  checkpointLattices: CheckpointLattice[];
  checkpoints: CheckpointObservation[];
  junctions: JunctionDefinition[];
  routeDecisions: RouteDecision[];
  traversalBundles: OperationalOntologyObjectBundle[];
}

export interface OperationalOntologyJunctionView {
  snapshotProjection: OperationalOntologyProjectionRecord;
  junction: JunctionDefinition;
  routeDecisions: RouteDecision[];
  corridors: FlowCorridor[];
  controlFlows: ControlFlowGraph[];
}

async function findProjectionById(
  store: Pick<OperationalOntologyStore, 'listProjections'>,
  projectionId: string,
): Promise<OperationalOntologyProjectionRecord | null> {
  const projections = await store.listProjections({
    projectionKind: OPERATIONAL_ONTOLOGY_SNAPSHOT_PROJECTION_KIND,
  });
  const matched = projections.find((projection) => projection.projectionId === projectionId);
  return matched ? structuredClone(matched) : null;
}

async function listSubProjections(
  store: Pick<OperationalOntologyStore, 'listProjections'>,
  snapshotProjectionId: string,
  projectionKind: string,
): Promise<OperationalOntologyProjectionRecord[]> {
  return (await store.listProjections({ projectionKind }))
    .filter((projection) => projection.builtFrom.includes(snapshotProjectionId))
    .map((projection) => structuredClone(projection));
}

export async function listOperationalOntologySnapshotProjections(
  store: Pick<OperationalOntologyStore, 'listProjections'>,
  targetScope?: string,
): Promise<OperationalOntologyProjectionRecord[]> {
  return store.listProjections({
    projectionKind: OPERATIONAL_ONTOLOGY_SNAPSHOT_PROJECTION_KIND,
    targetScope,
  });
}

export async function loadOperationalOntologyCorridors(
  store: Pick<OperationalOntologyStore, 'listProjections'>,
  snapshotProjectionId: string,
): Promise<FlowCorridor[]> {
  const corridorProjections = await listSubProjections(
    store,
    snapshotProjectionId,
    OPERATIONAL_ONTOLOGY_CORRIDOR_PROJECTION_KIND,
  );

  return corridorProjections.map(
    (projection) => structuredClone(projection.payloadJson) as FlowCorridor,
  );
}

export async function loadOperationalOntologyControlFlows(
  store: Pick<OperationalOntologyStore, 'listProjections'>,
  snapshotProjectionId: string,
): Promise<ControlFlowGraph[]> {
  const controlFlowProjections = await listSubProjections(
    store,
    snapshotProjectionId,
    OPERATIONAL_ONTOLOGY_CONTROL_FLOW_PROJECTION_KIND,
  );

  return controlFlowProjections.map(
    (projection) => structuredClone(projection.payloadJson) as ControlFlowGraph,
  );
}

export async function loadOperationalOntologyCheckpointLattices(
  store: Pick<OperationalOntologyStore, 'listProjections'>,
  snapshotProjectionId: string,
): Promise<CheckpointLattice[]> {
  const checkpointLatticeProjections = await listSubProjections(
    store,
    snapshotProjectionId,
    OPERATIONAL_ONTOLOGY_CHECKPOINT_LATTICE_PROJECTION_KIND,
  );

  return checkpointLatticeProjections.map(
    (projection) => structuredClone(projection.payloadJson) as CheckpointLattice,
  );
}

export async function loadOperationalOntologyCheckpointLattice(
  store: Pick<OperationalOntologyStore, 'listProjections'>,
  snapshotProjectionId: string,
  rootCheckpointId: string,
): Promise<CheckpointLattice | null> {
  const lattices = await loadOperationalOntologyCheckpointLattices(store, snapshotProjectionId);
  return lattices.find((lattice) => lattice.rootCheckpointId === rootCheckpointId) ?? null;
}

export async function loadOperationalOntologyJunctions(
  store: Pick<OperationalOntologyStore, 'listProjections'>,
  snapshotProjectionId: string,
): Promise<JunctionDefinition[]> {
  const junctionProjections = await listSubProjections(
    store,
    snapshotProjectionId,
    OPERATIONAL_ONTOLOGY_JUNCTION_PROJECTION_KIND,
  );

  return junctionProjections.map(
    (projection) => structuredClone(projection.payloadJson) as JunctionDefinition,
  );
}

export async function loadOperationalOntologyJunction(
  store: Pick<OperationalOntologyStore, 'listProjections'>,
  snapshotProjectionId: string,
  junctionId: string,
): Promise<JunctionDefinition | null> {
  const junctions = await loadOperationalOntologyJunctions(store, snapshotProjectionId);
  return junctions.find((junction) => junction.branchNodeId === junctionId) ?? null;
}

export async function loadOperationalOntologyRouteDecisions(
  store: Pick<OperationalOntologyStore, 'listProjections'>,
  snapshotProjectionId: string,
): Promise<RouteDecision[]> {
  const routeDecisionProjections = await listSubProjections(
    store,
    snapshotProjectionId,
    OPERATIONAL_ONTOLOGY_ROUTE_DECISION_PROJECTION_KIND,
  );

  return routeDecisionProjections.map(
    (projection) => structuredClone(projection.payloadJson) as RouteDecision,
  );
}

export async function loadOperationalOntologyRouteDecision(
  store: Pick<OperationalOntologyStore, 'listProjections'>,
  snapshotProjectionId: string,
  branchNodeId: string,
): Promise<RouteDecision | null> {
  const routeDecisions = await loadOperationalOntologyRouteDecisions(store, snapshotProjectionId);
  return routeDecisions.find((route) => route.branchNodeId === branchNodeId) ?? null;
}

export async function loadOperationalOntologyTraversalBundles(
  store: Pick<OperationalOntologyStore, 'listProjections' | 'getObjectBundle'>,
  snapshotProjectionId: string,
): Promise<OperationalOntologyObjectBundle[]> {
  const snapshot = await loadOperationalOntologySnapshot(store, snapshotProjectionId);
  if (!snapshot) {
    return [];
  }

  const traversalBundles = (
    await Promise.all(
      snapshot.traversals.map((traversalObservation) =>
        store.getObjectBundle(
          traversalObservation.traversal.canonicalKey ??
            createTraversalCanonicalKey(traversalObservation.traversal),
        ),
      ),
    )
  ).filter((bundle): bundle is OperationalOntologyObjectBundle => bundle !== null);

  return traversalBundles;
}

export async function loadOperationalOntologyTraversalBundle(
  store: Pick<OperationalOntologyStore, 'listProjections' | 'getObjectBundle'>,
  snapshotProjectionId: string,
  traversalKey: string,
): Promise<OperationalOntologyObjectBundle | null> {
  const bundles = await loadOperationalOntologyTraversalBundles(store, snapshotProjectionId);
  return bundles.find((bundle) => bundle.object.canonicalKey === traversalKey) ?? null;
}

export async function loadOperationalOntologySnapshotView(
  store: Pick<OperationalOntologyStore, 'listProjections' | 'getObjectBundle'>,
  snapshotProjectionId: string,
): Promise<OperationalOntologySnapshotView | null> {
  const snapshotProjection = await findProjectionById(store, snapshotProjectionId);
  if (!snapshotProjection) {
    return null;
  }

  const snapshot = await loadOperationalOntologySnapshot(store, snapshotProjectionId);
  if (!snapshot) {
    return null;
  }

  const [corridors, controlFlows, checkpointLattices, junctions, routeDecisions, traversalBundles] =
    await Promise.all([
      loadOperationalOntologyCorridors(store, snapshotProjectionId),
      loadOperationalOntologyControlFlows(store, snapshotProjectionId),
      loadOperationalOntologyCheckpointLattices(store, snapshotProjectionId),
      loadOperationalOntologyJunctions(store, snapshotProjectionId),
      loadOperationalOntologyRouteDecisions(store, snapshotProjectionId),
      loadOperationalOntologyTraversalBundles(store, snapshotProjectionId),
    ]);

  return {
    snapshotProjection,
    snapshot,
    corridors,
    controlFlows,
    checkpointLattices,
    junctions,
    routeDecisions,
    traversalBundles,
  };
}

export async function loadOperationalOntologyCorridorView(
  store: Pick<OperationalOntologyStore, 'listProjections' | 'getObjectBundle'>,
  snapshotProjectionId: string,
  corridorId: string,
): Promise<OperationalOntologyCorridorView | null> {
  const view = await loadOperationalOntologySnapshotView(store, snapshotProjectionId);
  if (!view) {
    return null;
  }

  const corridor = view.corridors.find((candidate) => candidate.flowId === corridorId) ?? null;
  if (!corridor) {
    return null;
  }

  const checkpointLattices = view.checkpointLattices.filter(
    (lattice) => lattice.corridorId === corridorId,
  );
  const checkpoints = checkpointLattices.flatMap((lattice) => lattice.observations);
  const controlFlow = view.controlFlows.find((graph) => graph.graphId === corridorId) ?? null;
  const routeDecisions = view.routeDecisions.filter(
    (decision) => decision.corridorId === corridorId,
  );
  const junctionIds = new Set(
    routeDecisions.map((decision) => decision.junctionId ?? decision.branchNodeId),
  );
  const junctions = view.junctions.filter((junction) => {
    if (junctionIds.size > 0) {
      return junctionIds.has(junction.branchNodeId);
    }
    return controlFlow ? controlFlow.graphId === corridorId : false;
  });
  const traversalKeys = new Set(
    routeDecisions
      .map((decision) => decision.traversalKey)
      .filter((key): key is string => Boolean(key)),
  );
  const traversalBundles =
    traversalKeys.size > 0
      ? view.traversalBundles.filter((bundle) => traversalKeys.has(bundle.object.canonicalKey))
      : [];

  return {
    snapshotProjection: view.snapshotProjection,
    corridor,
    controlFlow,
    checkpointLattices,
    checkpoints,
    junctions,
    routeDecisions,
    traversalBundles,
  };
}

export async function loadOperationalOntologyJunctionView(
  store: Pick<OperationalOntologyStore, 'listProjections' | 'getObjectBundle'>,
  snapshotProjectionId: string,
  junctionId: string,
): Promise<OperationalOntologyJunctionView | null> {
  const view = await loadOperationalOntologySnapshotView(store, snapshotProjectionId);
  if (!view) {
    return null;
  }

  const junction =
    view.junctions.find((candidate) => candidate.branchNodeId === junctionId) ?? null;
  if (!junction) {
    return null;
  }

  const routeDecisions = view.routeDecisions.filter(
    (decision) =>
      (decision.junctionId ?? decision.branchNodeId) === junctionId ||
      decision.branchNodeId === junctionId,
  );
  const corridorIds =
    routeDecisions.length > 0
      ? new Set(
          routeDecisions
            .map((decision) => decision.corridorId)
            .filter((id): id is string => Boolean(id)),
        )
      : new Set(
          view.controlFlows
            .filter((graph) => graph.nodes.some((node) => node.nodeId === junctionId))
            .map((graph) => graph.graphId),
        );
  const corridors = view.corridors.filter((corridor) => corridorIds.has(corridor.flowId));
  const controlFlows = view.controlFlows.filter(
    (graph) =>
      corridorIds.has(graph.graphId) || graph.nodes.some((node) => node.nodeId === junctionId),
  );

  return {
    snapshotProjection: view.snapshotProjection,
    junction,
    routeDecisions,
    corridors,
    controlFlows,
  };
}
