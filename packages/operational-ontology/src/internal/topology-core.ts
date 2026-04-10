import type {
  CheckpointLattice,
  CheckpointTemplateKind,
} from "./checkpoint-core.js";
import type {
  CorridorTemplateKind,
  FlowCorridor,
} from "./corridor-core.js";
import type {
  JunctionDefinition,
  JunctionTemplateKind,
  RouteDecision,
} from "./junction-core.js";
import type { TraversalObservation } from "./runtime-core.js";

export const OBSERVATION_TOPOLOGY_TEMPLATE_KINDS = [
  "runtime_snapshot",
] as const;

export type ObservationTopologyTemplateKind =
  (typeof OBSERVATION_TOPOLOGY_TEMPLATE_KINDS)[number];

export interface ObservationTopologyTemplate {
  kind: ObservationTopologyTemplateKind;
  description: string;
  requireCorridorKinds?: readonly CorridorTemplateKind[];
  requireJunctionTemplateKinds?: readonly JunctionTemplateKind[];
  requireCheckpointTemplateKinds?: readonly CheckpointTemplateKind[];
  requireCheckpointLattices?: boolean;
  requireRouteDecisions?: boolean;
  requireTraversals?: boolean;
  minCorridors?: number;
  maxCorridors?: number;
  minCheckpointLatticeDepth?: number;
  requireRouteDecisionReferences?: boolean;
  requireCheckpointCorridorLink?: boolean;
}

export interface ObservationTopologyTemplateRegistry {
  list(): ObservationTopologyTemplate[];
  get(kind: ObservationTopologyTemplateKind): ObservationTopologyTemplate | undefined;
}

export const DEFAULT_OBSERVATION_TOPOLOGY_TEMPLATES = {
  runtime_snapshot: {
    kind: "runtime_snapshot",
    description: "Snapshot that combines corridor, junction, checkpoint, transmission, lineage, and traversal views",
    requireCorridorKinds: ["pipe_graph", "event_record_observed"],
    requireCheckpointLattices: true,
    minCorridors: 1,
    minCheckpointLatticeDepth: 2,
    requireCheckpointCorridorLink: true,
  },
} as const satisfies Record<ObservationTopologyTemplateKind, ObservationTopologyTemplate>;

export interface ObservationTopologyTemplateValidationResult {
  valid: boolean;
  corridorCount: number;
  maxCheckpointLatticeDepth: number;
  missingCorridorKinds: CorridorTemplateKind[];
  missingJunctionTemplateKinds: JunctionTemplateKind[];
  missingCheckpointTemplateKinds: CheckpointTemplateKind[];
  missingCheckpointLattices: boolean;
  missingRouteDecisions: boolean;
  missingTraversals: boolean;
  tooFewCorridors: boolean;
  tooManyCorridors: boolean;
  checkpointDepthTooShallow: boolean;
  routeDecisionsMissingRefs: string[];
  checkpointsMissingCorridor: string[];
}

export const defaultObservationTopologyTemplateRegistry: ObservationTopologyTemplateRegistry = {
  list() {
    return Object.values(DEFAULT_OBSERVATION_TOPOLOGY_TEMPLATES);
  },
  get(kind: ObservationTopologyTemplateKind) {
    return DEFAULT_OBSERVATION_TOPOLOGY_TEMPLATES[kind];
  },
};

export function getObservationTopologyTemplate(
  registry: ObservationTopologyTemplateRegistry,
  kind: ObservationTopologyTemplateKind,
): ObservationTopologyTemplate {
  const template = registry.get(kind);
  if (!template) {
    throw new Error(`Unknown observation topology template "${kind}"`);
  }
  return template;
}

function computeCheckpointLatticeDepth(lattice: CheckpointLattice): number {
  if (lattice.links.length === 0) {
    return lattice.definitions.length > 0 ? 1 : 0;
  }

  const childrenByParent = new Map<string, string[]>();
  for (const link of lattice.links) {
    const current = childrenByParent.get(link.fromCheckpointId) ?? [];
    current.push(link.toCheckpointId);
    childrenByParent.set(link.fromCheckpointId, current);
  }

  const visit = (checkpointId: string, depth: number): number => {
    const children = childrenByParent.get(checkpointId) ?? [];
    if (children.length === 0) {
      return depth;
    }

    return Math.max(...children.map((childId) => visit(childId, depth + 1)));
  };

  return visit(lattice.rootCheckpointId, 1);
}

export function validateObservationTopologyAgainstTemplate(
  input: {
    corridors: readonly FlowCorridor[];
    junctions: readonly JunctionDefinition[];
    checkpointLattices: readonly CheckpointLattice[];
    routeDecisions: readonly RouteDecision[];
    traversals: readonly TraversalObservation[];
  },
  registry: ObservationTopologyTemplateRegistry = defaultObservationTopologyTemplateRegistry,
  kind: ObservationTopologyTemplateKind = "runtime_snapshot",
): ObservationTopologyTemplateValidationResult {
  const template = getObservationTopologyTemplate(registry, kind);
  const corridorKinds = new Set(input.corridors.map((corridor) => corridor.templateKind));
  const junctionKinds = new Set(
    input.junctions
      .map((junction) => junction.templateKind)
      .filter((templateKind): templateKind is JunctionTemplateKind => Boolean(templateKind)),
  );
  const checkpointKinds = new Set(
    input.checkpointLattices.flatMap((lattice) =>
      lattice.definitions.map((definition) => definition.templateKind),
    ),
  );

  const missingCorridorKinds = (template.requireCorridorKinds ?? []).filter(
    (requiredKind) => !corridorKinds.has(requiredKind),
  );
  const missingJunctionTemplateKinds = (template.requireJunctionTemplateKinds ?? []).filter(
    (requiredKind) => !junctionKinds.has(requiredKind),
  );
  const missingCheckpointTemplateKinds = (template.requireCheckpointTemplateKinds ?? []).filter(
    (requiredKind) => !checkpointKinds.has(requiredKind),
  );
  const missingCheckpointLattices =
    Boolean(template.requireCheckpointLattices) && input.checkpointLattices.length === 0;
  const missingRouteDecisions =
    Boolean(template.requireRouteDecisions) && input.routeDecisions.length === 0;
  const missingTraversals =
    Boolean(template.requireTraversals) && input.traversals.length === 0;
  const corridorCount = input.corridors.length;
  const tooFewCorridors =
    typeof template.minCorridors === "number" ? corridorCount < template.minCorridors : false;
  const tooManyCorridors =
    typeof template.maxCorridors === "number" ? corridorCount > template.maxCorridors : false;
  const maxCheckpointLatticeDepth = Math.max(
    0,
    ...input.checkpointLattices.map((lattice) => computeCheckpointLatticeDepth(lattice)),
  );
  const checkpointDepthTooShallow =
    typeof template.minCheckpointLatticeDepth === "number"
      ? maxCheckpointLatticeDepth < template.minCheckpointLatticeDepth
      : false;
  const routeDecisionsMissingRefs = template.requireRouteDecisionReferences
    ? input.routeDecisions
        .filter(
          (decision) =>
            !decision.junctionId || !decision.corridorId || !decision.traversalKey,
        )
        .map((decision) => decision.branchNodeId)
    : [];
  const checkpointsMissingCorridor = template.requireCheckpointCorridorLink
    ? input.checkpointLattices
        .flatMap((lattice) => lattice.observations)
        .filter((checkpoint) => !checkpoint.corridorId)
        .map((checkpoint) => checkpoint.checkpointId)
    : [];

  return {
    valid:
      missingCorridorKinds.length === 0 &&
      missingJunctionTemplateKinds.length === 0 &&
      missingCheckpointTemplateKinds.length === 0 &&
      !missingCheckpointLattices &&
      !missingRouteDecisions &&
      !missingTraversals &&
      !tooFewCorridors &&
      !tooManyCorridors &&
      !checkpointDepthTooShallow &&
      routeDecisionsMissingRefs.length === 0 &&
      checkpointsMissingCorridor.length === 0,
    corridorCount,
    maxCheckpointLatticeDepth,
    missingCorridorKinds,
    missingJunctionTemplateKinds,
    missingCheckpointTemplateKinds,
    missingCheckpointLattices,
    missingRouteDecisions,
    missingTraversals,
    tooFewCorridors,
    tooManyCorridors,
    checkpointDepthTooShallow,
    routeDecisionsMissingRefs,
    checkpointsMissingCorridor,
  };
}
