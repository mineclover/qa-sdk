import type {
  SemanticTransmission,
} from "./runtime-core.js";
import type { FlowCorridor } from "./corridor-core.js";
import type { RouteDecision } from "./junction-core.js";

export const CHECKPOINT_TEMPLATE_KINDS = [
  "root",
  "payload_field",
  "address_binding",
  "route_decision",
] as const;

export type CheckpointTemplateKind = (typeof CHECKPOINT_TEMPLATE_KINDS)[number];

export interface CheckpointTemplate {
  kind: CheckpointTemplateKind;
  relationToParent?: CheckpointLink["relation"];
  description: string;
  requireObservedFields?: boolean;
  requireObservedPrefixIds?: boolean;
  requireObservedNodeHit?: boolean;
}

export interface CheckpointTemplateRegistry {
  list(): CheckpointTemplate[];
  get(kind: CheckpointTemplateKind): CheckpointTemplate | undefined;
}

export const DEFAULT_CHECKPOINT_TEMPLATES = {
  root: {
    kind: "root",
    description: "Corridor root checkpoint for a single observed record",
    requireObservedNodeHit: true,
  },
  payload_field: {
    kind: "payload_field",
    relationToParent: "contains",
    description: "Checkpoint for an observed top-level payload field",
    requireObservedFields: true,
    requireObservedNodeHit: true,
  },
  address_binding: {
    kind: "address_binding",
    relationToParent: "contains",
    description: "Checkpoint for an observed address_context binding",
    requireObservedPrefixIds: true,
    requireObservedNodeHit: true,
  },
  route_decision: {
    kind: "route_decision",
    relationToParent: "decides",
    description: "Checkpoint for a route decision attached during snapshot synthesis",
    requireObservedNodeHit: true,
  },
} as const satisfies Record<CheckpointTemplateKind, CheckpointTemplate>;

export interface CheckpointTemplateValidationResult {
  valid: boolean;
  missingObservedFields: boolean;
  missingObservedPrefixIds: boolean;
  nodeNotObserved: boolean;
}

export interface AddressContextBinding {
  prefixId: string;
  address: string;
  canonicalKey?: string;
}

export interface CheckpointDefinition {
  checkpointId: string;
  templateKind: CheckpointTemplateKind;
  templateDescription?: string;
  templateValidation?: CheckpointTemplateValidationResult;
  nodeId: string;
  observedPrefixIds: string[];
  observedFields: string[];
}

export interface CheckpointLink {
  fromCheckpointId: string;
  toCheckpointId: string;
  relation: "contains" | "observes" | "decides";
}

export interface CheckpointObservation {
  checkpointId: string;
  templateKind: CheckpointTemplateKind;
  templateDescription?: string;
  templateValidation?: CheckpointTemplateValidationResult;
  recordId: string;
  traceId: string;
  eventKey: string;
  timestamp: string;
  corridorId?: string;
  junctionId?: string;
  traversalKey?: string;
  observedNodeKeys: string[];
  observedEdgeKeys: string[];
  transmissions: SemanticTransmission[];
  dataFlow: FlowCorridor;
}

export interface CheckpointLattice {
  corridorId: string;
  rootCheckpointId: string;
  definitions: CheckpointDefinition[];
  observations: CheckpointObservation[];
  links: CheckpointLink[];
}

export const defaultCheckpointTemplateRegistry: CheckpointTemplateRegistry = {
  list() {
    return Object.values(DEFAULT_CHECKPOINT_TEMPLATES);
  },
  get(kind: CheckpointTemplateKind) {
    return DEFAULT_CHECKPOINT_TEMPLATES[kind];
  },
};

export function getCheckpointTemplate(
  registry: CheckpointTemplateRegistry,
  kind: CheckpointTemplateKind,
): CheckpointTemplate {
  const template = registry.get(kind);
  if (!template) {
    throw new Error(`Unknown checkpoint template "${kind}"`);
  }
  return template;
}

export function validateCheckpointAgainstTemplate(
  template: CheckpointTemplate,
  input: {
    nodeId: string;
    observedPrefixIds: readonly string[];
    observedFields: readonly string[];
    observedNodeKeys?: readonly string[];
  },
): CheckpointTemplateValidationResult {
  const missingObservedFields =
    Boolean(template.requireObservedFields) && input.observedFields.length === 0;
  const missingObservedPrefixIds =
    Boolean(template.requireObservedPrefixIds) && input.observedPrefixIds.length === 0;
  const nodeNotObserved =
    Boolean(template.requireObservedNodeHit) &&
    Array.isArray(input.observedNodeKeys) &&
    !input.observedNodeKeys.includes(input.nodeId);

  return {
    valid: !missingObservedFields && !missingObservedPrefixIds && !nodeNotObserved,
    missingObservedFields,
    missingObservedPrefixIds,
    nodeNotObserved,
  };
}

export function createCheckpointDefinitionFromTemplate(
  registry: CheckpointTemplateRegistry,
  input: {
    checkpointId: string;
    templateKind: CheckpointTemplateKind;
    nodeId: string;
    observedPrefixIds: string[];
    observedFields: string[];
  },
): CheckpointDefinition {
  const template = getCheckpointTemplate(registry, input.templateKind);
  const templateValidation = validateCheckpointAgainstTemplate(template, {
    nodeId: input.nodeId,
    observedPrefixIds: input.observedPrefixIds,
    observedFields: input.observedFields,
  });

  return {
    checkpointId: input.checkpointId,
    templateKind: input.templateKind,
    templateDescription: template.description,
    templateValidation,
    nodeId: input.nodeId,
    observedPrefixIds: input.observedPrefixIds,
    observedFields: input.observedFields,
  };
}

export function createCheckpointObservationFromTemplate(
  registry: CheckpointTemplateRegistry,
  input: CheckpointObservation & {
    nodeId: string;
    observedPrefixIds?: string[];
    observedFields?: string[];
  },
): CheckpointObservation {
  const template = getCheckpointTemplate(registry, input.templateKind);
  const templateValidation = validateCheckpointAgainstTemplate(template, {
    nodeId: input.nodeId,
    observedPrefixIds: input.observedPrefixIds ?? [],
    observedFields: input.observedFields ?? [],
    observedNodeKeys: input.observedNodeKeys,
  });
  const {
    nodeId: _nodeId,
    observedPrefixIds: _observedPrefixIds,
    observedFields: _observedFields,
    ...rest
  } = input;
  return {
    ...rest,
    templateDescription: template.description,
    templateValidation,
  };
}

export function createCheckpointLinkFromTemplate(
  registry: CheckpointTemplateRegistry,
  input: {
    parentCheckpointId: string;
    childCheckpointId: string;
    childTemplateKind: CheckpointTemplateKind;
  },
): CheckpointLink {
  const template = getCheckpointTemplate(registry, input.childTemplateKind);

  return {
    fromCheckpointId: input.parentCheckpointId,
    toCheckpointId: input.childCheckpointId,
    relation: template.relationToParent ?? "contains",
  };
}

function dedupeByKey<T>(
  values: readonly T[],
  getKey: (value: T) => string,
): T[] {
  const map = new Map<string, T>();
  for (const value of values) {
    map.set(getKey(value), value);
  }
  return [...map.values()];
}

export function augmentCheckpointLatticeWithRouteDecisions(
  lattice: CheckpointLattice,
  routeDecisions: readonly RouteDecision[],
  checkpointTemplateRegistry: CheckpointTemplateRegistry = defaultCheckpointTemplateRegistry,
): CheckpointLattice {
  if (routeDecisions.length === 0) {
    return lattice;
  }

  const definitions = [...lattice.definitions];
  const observations = [...lattice.observations];
  const links = [...lattice.links];
  const rootObservation =
    lattice.observations.find(
      (observation) => observation.checkpointId === lattice.rootCheckpointId,
    ) ?? lattice.observations[0];

  for (const decision of routeDecisions) {
    const junctionKey = decision.junctionId ?? decision.branchNodeId;
    const checkpointId = `${lattice.rootCheckpointId}:route:${junctionKey}`;

    if (!definitions.some((definition) => definition.checkpointId === checkpointId)) {
      definitions.push(
        createCheckpointDefinitionFromTemplate(checkpointTemplateRegistry, {
          checkpointId,
          templateKind: "route_decision",
          nodeId: junctionKey,
          observedPrefixIds: [],
          observedFields: [],
        }),
      );
    }

    if (!observations.some((observation) => observation.checkpointId === checkpointId)) {
      observations.push(
        createCheckpointObservationFromTemplate(checkpointTemplateRegistry, {
          checkpointId,
          templateKind: "route_decision",
          nodeId: junctionKey,
          recordId: rootObservation.recordId,
          traceId: rootObservation.traceId,
          eventKey: rootObservation.eventKey,
          timestamp: rootObservation.timestamp,
          corridorId: decision.corridorId ?? lattice.corridorId,
          junctionId: junctionKey,
          traversalKey: decision.traversalKey,
          observedNodeKeys: dedupeByKey(
            [...rootObservation.observedNodeKeys, decision.branchNodeId],
            (key) => key,
          ),
          observedEdgeKeys: [...rootObservation.observedEdgeKeys],
          transmissions: [],
          dataFlow: rootObservation.dataFlow,
        }),
      );
    }

    if (
      !links.some(
        (link) =>
          link.fromCheckpointId === lattice.rootCheckpointId &&
          link.toCheckpointId === checkpointId &&
          link.relation === DEFAULT_CHECKPOINT_TEMPLATES.route_decision.relationToParent,
      )
    ) {
      links.push(
        createCheckpointLinkFromTemplate(checkpointTemplateRegistry, {
          parentCheckpointId: lattice.rootCheckpointId,
          childCheckpointId: checkpointId,
          childTemplateKind: "route_decision",
        }),
      );
    }
  }

  return {
    ...lattice,
    definitions,
    observations,
    links,
  };
}
