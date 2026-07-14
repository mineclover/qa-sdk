import type {
  OperationalOntologyObservationRecord,
  OperationalOntologyProjectionRecord,
} from './persistence-core.js';
import type { OperationalOntologyStore } from './persistence-memory.js';
import type { OperationalOntologySnapshot } from './projector-types.js';
import { createTraversalCanonicalKey } from './runtime-core.js';

export const OPERATIONAL_ONTOLOGY_SNAPSHOT_PROJECTION_KIND = 'operational_ontology_snapshot';
export const OPERATIONAL_ONTOLOGY_CORRIDOR_PROJECTION_KIND = 'operational_ontology_corridor';
export const OPERATIONAL_ONTOLOGY_CONTROL_FLOW_PROJECTION_KIND =
  'operational_ontology_control_flow';
export const OPERATIONAL_ONTOLOGY_CHECKPOINT_LATTICE_PROJECTION_KIND =
  'operational_ontology_checkpoint_lattice';
export const OPERATIONAL_ONTOLOGY_JUNCTION_PROJECTION_KIND = 'operational_ontology_junction';
export const OPERATIONAL_ONTOLOGY_ROUTE_DECISION_PROJECTION_KIND =
  'operational_ontology_route_decision';

export interface PersistOperationalOntologySnapshotOptions {
  snapshotId?: string;
  targetScope?: string;
  builtAt?: string;
  includeSubProjections?: boolean;
  persistTraversalObjects?: boolean;
  schemaVersion?: string;
  lifecycle?: string;
}

export interface PersistOperationalOntologySnapshotResult {
  snapshotProjection: OperationalOntologyProjectionRecord;
  subProjectionIds: string[];
  traversalObjectIds: string[];
  traversalObservationIds: string[];
}

function createSnapshotProjectionId(
  snapshot: OperationalOntologySnapshot,
  builtAt: string,
): string {
  return `oo-snapshot:${snapshot.topologyTemplateKind}:${builtAt}`;
}

function ensureTraversalCanonicalKey(
  traversal: OperationalOntologySnapshot['traversals'][number]['traversal'],
): string {
  return traversal.canonicalKey ?? createTraversalCanonicalKey(traversal);
}

export async function persistOperationalOntologySnapshot(
  store: OperationalOntologyStore,
  snapshot: OperationalOntologySnapshot,
  options: PersistOperationalOntologySnapshotOptions = {},
): Promise<PersistOperationalOntologySnapshotResult> {
  const builtAt = options.builtAt ?? new Date().toISOString();
  const snapshotProjectionId = options.snapshotId ?? createSnapshotProjectionId(snapshot, builtAt);
  const snapshotProjection: OperationalOntologyProjectionRecord = {
    projectionId: snapshotProjectionId,
    projectionKind: OPERATIONAL_ONTOLOGY_SNAPSHOT_PROJECTION_KIND,
    targetScope: options.targetScope ?? snapshot.topologyTemplateKind,
    payloadJson: structuredClone(snapshot),
    builtFrom: [
      ...snapshot.corridors.map((corridor) => corridor.flowId),
      ...snapshot.traversals.map((observation) =>
        ensureTraversalCanonicalKey(observation.traversal),
      ),
    ],
    builtAt,
  };

  await store.putProjection(snapshotProjection);

  const subProjectionIds: string[] = [];
  if (options.includeSubProjections !== false) {
    const projections: OperationalOntologyProjectionRecord[] = [
      ...snapshot.corridors.map((corridor) => ({
        projectionId: `${snapshotProjectionId}:corridor:${corridor.flowId}`,
        projectionKind: OPERATIONAL_ONTOLOGY_CORRIDOR_PROJECTION_KIND,
        targetScope: corridor.flowId,
        payloadJson: structuredClone(corridor),
        builtFrom: [snapshotProjectionId],
        builtAt,
      })),
      ...snapshot.controlFlows.map((graph) => ({
        projectionId: `${snapshotProjectionId}:control-flow:${graph.graphId}`,
        projectionKind: OPERATIONAL_ONTOLOGY_CONTROL_FLOW_PROJECTION_KIND,
        targetScope: graph.graphId,
        payloadJson: structuredClone(graph),
        builtFrom: [snapshotProjectionId],
        builtAt,
      })),
      ...snapshot.checkpointLattices.map((lattice) => ({
        projectionId: `${snapshotProjectionId}:checkpoint-lattice:${lattice.rootCheckpointId}`,
        projectionKind: OPERATIONAL_ONTOLOGY_CHECKPOINT_LATTICE_PROJECTION_KIND,
        targetScope: lattice.corridorId,
        payloadJson: structuredClone(lattice),
        builtFrom: [snapshotProjectionId],
        builtAt,
      })),
      ...snapshot.junctions.map((junction) => ({
        projectionId: `${snapshotProjectionId}:junction:${junction.branchNodeId}`,
        projectionKind: OPERATIONAL_ONTOLOGY_JUNCTION_PROJECTION_KIND,
        targetScope: junction.branchNodeId,
        payloadJson: structuredClone(junction),
        builtFrom: [snapshotProjectionId],
        builtAt,
      })),
      ...snapshot.routeDecisions.map((decision) => ({
        projectionId: `${snapshotProjectionId}:route-decision:${decision.branchNodeId}`,
        projectionKind: OPERATIONAL_ONTOLOGY_ROUTE_DECISION_PROJECTION_KIND,
        targetScope: decision.corridorId ?? decision.branchNodeId,
        payloadJson: structuredClone(decision),
        builtFrom: [snapshotProjectionId],
        builtAt,
      })),
    ];

    for (const projection of projections) {
      await store.putProjection(projection);
      subProjectionIds.push(projection.projectionId);
    }
  }

  const traversalObjectIds: string[] = [];
  const traversalObservationIds: string[] = [];
  if (options.persistTraversalObjects !== false) {
    for (const traversalObservation of snapshot.traversals) {
      const traversalKey = ensureTraversalCanonicalKey(traversalObservation.traversal);
      const objectId = traversalKey;
      traversalObjectIds.push(objectId);

      await store.upsertObject({
        objectId,
        objectKind: 'traversal',
        canonicalKey: traversalKey,
        schemaVersion: options.schemaVersion ?? 'v1',
        lifecycle: options.lifecycle ?? 'observed',
        createdAt: builtAt,
        updatedAt: builtAt,
      });

      await store.putFacet({
        objectId,
        facetKind: 'route',
        version: options.schemaVersion ?? 'v1',
        payloadJson: {
          purpose: traversalObservation.traversal.purpose,
          start: traversalObservation.traversal.start,
          edges: traversalObservation.traversal.edges,
          end: traversalObservation.traversal.end,
          canonicalizable: Boolean(traversalObservation.traversal.canonicalKey),
        },
        sourceRef: snapshotProjectionId,
        recordedAt: builtAt,
      });

      await store.putFacet({
        objectId,
        facetKind: 'aggregate',
        version: options.schemaVersion ?? 'v1',
        payloadJson: {
          observationCount: 1,
          lastObservedAt: builtAt,
          reachability:
            traversalObservation.unreachableGoalIds.length === 0 ? 'complete' : 'partial',
        },
        sourceRef: snapshotProjectionId,
        recordedAt: builtAt,
      });

      const observation: OperationalOntologyObservationRecord = {
        observationId: `${snapshotProjectionId}:traversal:${objectId}`,
        targetObjectId: objectId,
        observationKind: 'traversal_observed',
        payloadJson: structuredClone(traversalObservation),
        observedAt: builtAt,
      };
      traversalObservationIds.push(observation.observationId);
      await store.appendObservation(observation);
    }
  }

  return {
    snapshotProjection,
    subProjectionIds,
    traversalObjectIds,
    traversalObservationIds,
  };
}

export async function loadOperationalOntologySnapshot(
  store: Pick<OperationalOntologyStore, 'listProjections'>,
  snapshotProjectionId: string,
): Promise<OperationalOntologySnapshot | null> {
  const projection = (
    await store.listProjections({
      targetScope: undefined,
      projectionKind: OPERATIONAL_ONTOLOGY_SNAPSHOT_PROJECTION_KIND,
    })
  ).find((candidate) => candidate.projectionId === snapshotProjectionId);

  if (!projection) {
    return null;
  }

  return structuredClone(projection.payloadJson) as OperationalOntologySnapshot;
}
