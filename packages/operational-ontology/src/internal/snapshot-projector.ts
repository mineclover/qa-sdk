import {
  augmentCheckpointLatticeWithRouteDecisions,
} from "./checkpoint-core.js";
import {
  projectEventRecordToOperationalOntology,
} from "./event-projector.js";
import {
  projectLineageToOperationalOntology,
} from "./lineage-projector.js";
import {
  projectPathObservationToOperationalOntology,
} from "./path-projector.js";
import {
  projectPipeGraphToOperationalOntology,
} from "./pipe-projector.js";
import type {
  PipeGraphProjectionResult,
  OperationalOntologyProjectionInput,
  OperationalOntologyRuntimePorts,
  OperationalOntologySnapshot,
} from "./projector-types.js";
import { dedupeByKey } from "./projector-shared.js";
import {
  defaultObservationTopologyTemplateRegistry,
  getObservationTopologyTemplate,
  validateObservationTopologyAgainstTemplate,
} from "./topology-core.js";

export function projectOperationalOntologySnapshot(
  input: OperationalOntologyProjectionInput,
  ports: OperationalOntologyRuntimePorts = defaultOperationalOntologyRuntimePorts,
): OperationalOntologySnapshot {
  const topologyTemplate = getObservationTopologyTemplate(
    input.topologyTemplateRegistry ?? defaultObservationTopologyTemplateRegistry,
    "runtime_snapshot",
  );
  const graphProjection = input.graph
    ? ports.controlFlow.projectPipeGraph({
        graph: input.graph,
        schemas: input.schemas,
        lineages: input.lineages,
        corridorTemplateRegistry: input.corridorTemplateRegistry,
        junctionTemplateRegistry: input.junctionTemplateRegistry,
      })
    : undefined;

  const eventProjection = input.record
    ? ports.events.projectEventRecord({
        record: input.record,
        addressBindings: input.addressBindings,
        checkpointTemplateRegistry: input.checkpointTemplateRegistry,
        corridorTemplateRegistry: input.corridorTemplateRegistry,
      })
    : undefined;

  const lineageProjection =
    !graphProjection && input.lineages && input.lineages.length > 0
      ? ports.lineage.projectLineage({
          schemas: input.schemas,
          lineages: input.lineages,
        })
      : [];

  const pathProjection = input.pathObservation
    ? ports.traversal.projectPathObservation({
        observation: input.pathObservation,
        junctionTemplateRegistry: input.junctionTemplateRegistry,
      })
    : undefined;

  const corridors = dedupeByKey(
    [
      ...(graphProjection ? [graphProjection.corridor] : []),
      ...(eventProjection ? [eventProjection.dataFlow] : []),
    ],
    (corridor) => corridor.flowId,
  );

  const controlFlows = dedupeByKey(
    graphProjection ? [graphProjection.controlFlow] : [],
    (graph) => graph.graphId,
  );

  const junctionMap = new Map<
    string,
    PipeGraphProjectionResult["junctions"][number]
  >();
  for (const junction of graphProjection?.junctions ?? []) {
    junctionMap.set(junction.branchNodeId, junction);
  }
  for (const decision of pathProjection?.branchDecisions ?? []) {
    if (junctionMap.has(decision.branchNodeId)) {
      continue;
    }

    junctionMap.set(decision.branchNodeId, {
      templateKind: decision.templateKind ?? "observed_route_decision",
      templateDescription: decision.templateDescription,
      templateValidation: decision.templateValidation,
      branchNodeId: decision.branchNodeId,
      mode: decision.mode,
      paths: [],
    });
  }
  const junctions = [...junctionMap.values()];

  const routeDecisions = dedupeByKey(
    (pathProjection?.branchDecisions ?? []).map((decision) => ({
      ...decision,
      junctionId: decision.branchNodeId,
      corridorId: graphProjection?.corridor.flowId,
      traversalKey: pathProjection?.traversalObservations[0]?.traversal.canonicalKey,
    })),
    (decision) =>
      `${decision.branchNodeId}:${decision.mode}:${decision.selectedPathIds.join(",")}:${decision.skippedPathIds.join(",")}`,
  );

  const traversals = dedupeByKey(
    pathProjection?.traversalObservations ?? [],
    (observation) =>
      observation.traversal.canonicalKey ?? observation.traversal.start,
  );

  const checkpointLattices = dedupeByKey(
    (eventProjection ? [eventProjection.checkpointLattice] : []).map((lattice) =>
      augmentCheckpointLatticeWithRouteDecisions(
        lattice,
        routeDecisions,
        input.checkpointTemplateRegistry,
      ),
    ),
    (lattice) => lattice.rootCheckpointId,
  );

  const checkpoints = dedupeByKey(
    checkpointLattices.flatMap((lattice) =>
      lattice.observations.map((checkpoint) => ({
        ...checkpoint,
        junctionId:
          checkpoint.junctionId ??
          (routeDecisions.length === 1 ? routeDecisions[0]?.junctionId : undefined),
        traversalKey:
          checkpoint.traversalKey ??
          (traversals.length === 1
            ? traversals[0]?.traversal.canonicalKey
            : undefined),
      })),
    ),
    (checkpoint) => checkpoint.checkpointId,
  );

  const transmissions = dedupeByKey(
    [
      ...(graphProjection?.transmissions ?? []),
      ...(eventProjection?.transmissions ?? []),
    ],
    (transmission) => transmission.transmissionId,
  );

  const lineageLinks = dedupeByKey(
    [...(graphProjection?.lineageLinks ?? []), ...lineageProjection],
    (lineage) => lineage.lineageId,
  );

  const observedNodeKeys = dedupeByKey(
    eventProjection?.observedNodeKeys ?? [],
    (key) => key,
  );

  const observedEdgeKeys = dedupeByKey(
    eventProjection?.observedEdgeKeys ?? [],
    (key) => key,
  );

  const topologyValidation = validateObservationTopologyAgainstTemplate(
    {
      corridors,
      junctions,
      checkpointLattices,
      routeDecisions,
      traversals,
    },
    input.topologyTemplateRegistry ?? defaultObservationTopologyTemplateRegistry,
    "runtime_snapshot",
  );

  return {
    topologyTemplateKind: "runtime_snapshot",
    topologyTemplateDescription: topologyTemplate.description,
    topologyValidation,
    corridors,
    controlFlows,
    checkpoints,
    checkpointLattices,
    junctions,
    routeDecisions,
    traversals,
    transmissions,
    lineageLinks,
    observedNodeKeys,
    observedEdgeKeys,
  };
}

export const defaultOperationalOntologyRuntimePorts: OperationalOntologyRuntimePorts = {
  events: {
    projectEventRecord: projectEventRecordToOperationalOntology,
  },
  controlFlow: {
    projectPipeGraph: projectPipeGraphToOperationalOntology,
  },
  lineage: {
    projectLineage: projectLineageToOperationalOntology,
  },
  traversal: {
    projectPathObservation: projectPathObservationToOperationalOntology,
  },
};

export function createDefaultOperationalOntologyRuntimePorts(): OperationalOntologyRuntimePorts {
  return {
    events: defaultOperationalOntologyRuntimePorts.events,
    controlFlow: defaultOperationalOntologyRuntimePorts.controlFlow,
    lineage: defaultOperationalOntologyRuntimePorts.lineage,
    traversal: defaultOperationalOntologyRuntimePorts.traversal,
  };
}
