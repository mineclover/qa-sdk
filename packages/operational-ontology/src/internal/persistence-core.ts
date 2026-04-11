import type {
  AxisSchema,
  CoordAxes,
  RelationCategorySchema,
  SchemaValidationIssue,
  TaxonomySchema,
  TraversalSchema,
} from "./schema-core.js";

export const OPERATIONAL_ONTOLOGY_OBJECT_KINDS = [
  "axis_schema",
  "taxonomy_schema",
  "relation_category_schema",
  "traversal_schema",
  "node",
  "relation_type",
  "edge",
  "traversal",
  "governance_blueprint",
  "governance_run",
] as const;

export type OperationalOntologyObjectKind =
  (typeof OPERATIONAL_ONTOLOGY_OBJECT_KINDS)[number];

export const OPERATIONAL_ONTOLOGY_FACET_KINDS = [
  "identity",
  "schema",
  "validation",
  "semantic",
  "grammar",
  "assertion",
  "status",
  "route",
  "evidence",
  "aggregate",
  "projection_meta",
] as const;

export type OperationalOntologyFacetKind =
  (typeof OPERATIONAL_ONTOLOGY_FACET_KINDS)[number];

export const REQUIRED_FACET_KINDS_BY_OBJECT_KIND = {
  axis_schema: ["schema", "validation"],
  taxonomy_schema: ["schema", "validation"],
  relation_category_schema: ["schema", "grammar", "validation"],
  traversal_schema: ["schema", "route", "validation"],
  node: ["identity"],
  relation_type: ["identity", "grammar"],
  edge: ["assertion"],
  traversal: ["route"],
  governance_blueprint: ["schema", "validation"],
  governance_run: ["evidence", "status"],
} as const satisfies Record<OperationalOntologyObjectKind, readonly OperationalOntologyFacetKind[]>;

export const OPTIONAL_FACET_KINDS_BY_OBJECT_KIND = {
  axis_schema: [],
  taxonomy_schema: [],
  relation_category_schema: [],
  traversal_schema: [],
  node: ["semantic", "status", "projection_meta"],
  relation_type: ["semantic", "status", "projection_meta"],
  edge: ["status", "evidence", "projection_meta"],
  traversal: ["aggregate", "evidence", "status", "projection_meta"],
  governance_blueprint: ["grammar", "semantic", "status", "projection_meta"],
  governance_run: ["aggregate", "projection_meta"],
} as const satisfies Record<OperationalOntologyObjectKind, readonly OperationalOntologyFacetKind[]>;

export const ALLOWED_FACET_KINDS_BY_OBJECT_KIND = {
  axis_schema: [...REQUIRED_FACET_KINDS_BY_OBJECT_KIND.axis_schema, ...OPTIONAL_FACET_KINDS_BY_OBJECT_KIND.axis_schema],
  taxonomy_schema: [...REQUIRED_FACET_KINDS_BY_OBJECT_KIND.taxonomy_schema, ...OPTIONAL_FACET_KINDS_BY_OBJECT_KIND.taxonomy_schema],
  relation_category_schema: [
    ...REQUIRED_FACET_KINDS_BY_OBJECT_KIND.relation_category_schema,
    ...OPTIONAL_FACET_KINDS_BY_OBJECT_KIND.relation_category_schema,
  ],
  traversal_schema: [...REQUIRED_FACET_KINDS_BY_OBJECT_KIND.traversal_schema, ...OPTIONAL_FACET_KINDS_BY_OBJECT_KIND.traversal_schema],
  node: [...REQUIRED_FACET_KINDS_BY_OBJECT_KIND.node, ...OPTIONAL_FACET_KINDS_BY_OBJECT_KIND.node],
  relation_type: [
    ...REQUIRED_FACET_KINDS_BY_OBJECT_KIND.relation_type,
    ...OPTIONAL_FACET_KINDS_BY_OBJECT_KIND.relation_type,
  ],
  edge: [...REQUIRED_FACET_KINDS_BY_OBJECT_KIND.edge, ...OPTIONAL_FACET_KINDS_BY_OBJECT_KIND.edge],
  traversal: [...REQUIRED_FACET_KINDS_BY_OBJECT_KIND.traversal, ...OPTIONAL_FACET_KINDS_BY_OBJECT_KIND.traversal],
  governance_blueprint: [
    ...REQUIRED_FACET_KINDS_BY_OBJECT_KIND.governance_blueprint,
    ...OPTIONAL_FACET_KINDS_BY_OBJECT_KIND.governance_blueprint,
  ],
  governance_run: [
    ...REQUIRED_FACET_KINDS_BY_OBJECT_KIND.governance_run,
    ...OPTIONAL_FACET_KINDS_BY_OBJECT_KIND.governance_run,
  ],
} as const satisfies Record<OperationalOntologyObjectKind, readonly OperationalOntologyFacetKind[]>;

export const DEFAULT_FACET_KINDS_BY_OBJECT_KIND = ALLOWED_FACET_KINDS_BY_OBJECT_KIND;

export type LifecycleState = string;

export interface OperationalOntologyObjectRecord {
  objectId: string;
  objectKind: OperationalOntologyObjectKind;
  canonicalKey: string;
  schemaVersion: string;
  lifecycle: LifecycleState;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalOntologyFacetRecord {
  objectId: string;
  facetKind: OperationalOntologyFacetKind;
  version: string;
  payloadJson: unknown;
  sourceRef?: string;
  recordedAt: string;
}

export const OPERATIONAL_ONTOLOGY_OBSERVATION_KINDS = [
  "node_observed",
  "edge_activated",
  "traversal_observed",
  "schema_drift_detected",
  "validation_warning_emitted",
] as const;

export type OperationalOntologyObservationKind =
  (typeof OPERATIONAL_ONTOLOGY_OBSERVATION_KINDS)[number];

export interface OperationalOntologyObservationRecord {
  observationId: string;
  targetObjectId: string;
  observationKind: OperationalOntologyObservationKind;
  rawContext?: Record<string, string>;
  payloadJson: unknown;
  observedAt: string;
}

export interface OperationalOntologyProjectionRecord {
  projectionId: string;
  projectionKind: string;
  targetScope: string;
  payloadJson: unknown;
  builtFrom: string[];
  builtAt: string;
}

export interface FacetKindValidationResult {
  valid: boolean;
  required: readonly OperationalOntologyFacetKind[];
  optional: readonly OperationalOntologyFacetKind[];
  allowed: readonly OperationalOntologyFacetKind[];
  missing: OperationalOntologyFacetKind[];
  disallowed: string[];
  duplicates: string[];
}

export interface ValidationFacetPayload {
  valid: boolean;
  issues: SchemaValidationIssue[];
  validatorVersion?: string;
}

export interface AxisSchemaFacetPayload {
  axis: AxisSchema;
}

export interface TaxonomySchemaFacetPayload {
  taxonomy: TaxonomySchema;
}

export interface RelationCategorySchemaFacetPayload {
  relationCategory: RelationCategorySchema;
}

export interface TraversalSchemaFacetPayload {
  traversal: TraversalSchema;
}

export interface NodeIdentityFacetPayload {
  realm: string;
  space: string;
  anchor: string;
  canonicalKey: string;
}

export interface NodeSemanticFacetPayload {
  summary: string;
  labels?: string[];
  taxonomyRefs?: string[];
}

export interface RelationTypeIdentityFacetPayload {
  category: string;
  canonicalKey: string;
}

export interface RelationTypeGrammarFacetPayload {
  relationCategory: RelationCategorySchema;
  normalizedAxes: CoordAxes;
}

export interface RelationTypeSemanticFacetPayload {
  summary: string;
  labels?: string[];
  effect?: string;
}

export interface EdgeAssertionFacetPayload {
  start: string;
  relationType: string;
  end: string;
  assertedAt?: string;
  sourceProvenance?: string;
}

export interface StatusFacetPayload {
  state: string;
  reason?: string;
  validFrom?: string;
  validTo?: string;
}

export interface EvidenceFacetPayload {
  evidenceRefs: string[];
  confidence?: number;
  sourceKind?: string;
}

export interface ProjectionMetaFacetPayload {
  projectionRefs: string[];
  lastProjectedAt?: string;
}

export interface TraversalRouteFacetPayload {
  purpose: string;
  start?: string;
  edges?: string[];
  end?: string;
  canonicalizable?: boolean;
  allowedRelationCategories?: string[];
  allowedEdgeKinds?: string[];
}

export interface AggregateFacetPayload {
  observationCount: number;
  lastObservedAt?: string;
  reachability?: string;
}

export interface FacetPayloadShapeDescriptor {
  requiredKeys: readonly string[];
  description: string;
}

export const FACET_PAYLOAD_SHAPES_BY_OBJECT_KIND = {
  axis_schema: {
    schema: {
      requiredKeys: ["axis"],
      description: "Axis schema snapshot payload",
    },
    validation: {
      requiredKeys: ["valid", "issues"],
      description: "Axis schema validation result payload",
    },
  },
  taxonomy_schema: {
    schema: {
      requiredKeys: ["taxonomy"],
      description: "Taxonomy schema snapshot payload",
    },
    validation: {
      requiredKeys: ["valid", "issues"],
      description: "Taxonomy schema validation result payload",
    },
  },
  relation_category_schema: {
    schema: {
      requiredKeys: ["relationCategory"],
      description: "Relation category schema snapshot payload",
    },
    grammar: {
      requiredKeys: ["relationCategory"],
      description: "Relation category grammar payload",
    },
    validation: {
      requiredKeys: ["valid", "issues"],
      description: "Relation category validation result payload",
    },
  },
  traversal_schema: {
    schema: {
      requiredKeys: ["traversal"],
      description: "Traversal schema snapshot payload",
    },
    route: {
      requiredKeys: ["purpose"],
      description: "Traversal schema route payload",
    },
    validation: {
      requiredKeys: ["valid", "issues"],
      description: "Traversal schema validation result payload",
    },
  },
  node: {
    identity: {
      requiredKeys: ["realm", "space", "anchor", "canonicalKey"],
      description: "Node identity payload",
    },
    semantic: {
      requiredKeys: ["summary"],
      description: "Node semantic payload",
    },
    status: {
      requiredKeys: ["state"],
      description: "Node status payload",
    },
    projection_meta: {
      requiredKeys: ["projectionRefs"],
      description: "Node projection metadata payload",
    },
  },
  relation_type: {
    identity: {
      requiredKeys: ["category", "canonicalKey"],
      description: "Relation type identity payload",
    },
    grammar: {
      requiredKeys: ["relationCategory", "normalizedAxes"],
      description: "Relation type grammar payload",
    },
    semantic: {
      requiredKeys: ["summary"],
      description: "Relation type semantic payload",
    },
    status: {
      requiredKeys: ["state"],
      description: "Relation type status payload",
    },
    projection_meta: {
      requiredKeys: ["projectionRefs"],
      description: "Relation type projection metadata payload",
    },
  },
  edge: {
    assertion: {
      requiredKeys: ["start", "relationType", "end"],
      description: "Edge assertion payload",
    },
    status: {
      requiredKeys: ["state"],
      description: "Edge status payload",
    },
    evidence: {
      requiredKeys: ["evidenceRefs"],
      description: "Edge evidence payload",
    },
    projection_meta: {
      requiredKeys: ["projectionRefs"],
      description: "Edge projection metadata payload",
    },
  },
  traversal: {
    route: {
      requiredKeys: ["purpose", "start", "edges", "end"],
      description: "Traversal route payload",
    },
    aggregate: {
      requiredKeys: ["observationCount"],
      description: "Traversal aggregate payload",
    },
    evidence: {
      requiredKeys: ["evidenceRefs"],
      description: "Traversal evidence payload",
    },
    status: {
      requiredKeys: ["state"],
      description: "Traversal status payload",
    },
    projection_meta: {
      requiredKeys: ["projectionRefs"],
      description: "Traversal projection metadata payload",
    },
  },
  governance_blueprint: {
    schema: {
      requiredKeys: ["blueprint"],
      description: "Implementation governance blueprint payload",
    },
    grammar: {
      requiredKeys: ["taxonomy"],
      description: "Implementation governance taxonomy payload",
    },
    validation: {
      requiredKeys: ["valid", "issues"],
      description: "Implementation governance taxonomy validation result payload",
    },
    semantic: {
      requiredKeys: ["summary"],
      description: "Implementation governance semantic payload",
    },
    status: {
      requiredKeys: ["state"],
      description: "Implementation governance blueprint status payload",
    },
    projection_meta: {
      requiredKeys: ["projectionRefs"],
      description: "Implementation governance blueprint projection metadata payload",
    },
  },
  governance_run: {
    evidence: {
      requiredKeys: ["implementationRefs", "verificationRefs", "constraintVerdicts"],
      description: "Implementation governance run evidence payload",
    },
    status: {
      requiredKeys: ["state"],
      description: "Implementation governance run status payload",
    },
    aggregate: {
      requiredKeys: ["adjustmentCount"],
      description: "Implementation governance run aggregate payload",
    },
    projection_meta: {
      requiredKeys: ["projectionRefs"],
      description: "Implementation governance run projection metadata payload",
    },
  },
} as const satisfies Record<
  OperationalOntologyObjectKind,
  Partial<Record<OperationalOntologyFacetKind, FacetPayloadShapeDescriptor>>
>;

export interface FacetPayloadShapeValidationResult {
  valid: boolean;
  requiredKeys: readonly string[];
  missingKeys: string[];
}

export function getAllowedFacetKindsForObjectKind(
  objectKind: OperationalOntologyObjectKind,
): readonly OperationalOntologyFacetKind[] {
  return ALLOWED_FACET_KINDS_BY_OBJECT_KIND[objectKind];
}

export function getRequiredFacetKindsForObjectKind(
  objectKind: OperationalOntologyObjectKind,
): readonly OperationalOntologyFacetKind[] {
  return REQUIRED_FACET_KINDS_BY_OBJECT_KIND[objectKind];
}

export function getOptionalFacetKindsForObjectKind(
  objectKind: OperationalOntologyObjectKind,
): readonly OperationalOntologyFacetKind[] {
  return OPTIONAL_FACET_KINDS_BY_OBJECT_KIND[objectKind];
}

export function validateFacetKindsForObjectKind(
  objectKind: OperationalOntologyObjectKind,
  facetKinds: readonly string[],
): FacetKindValidationResult {
  const allowed = getAllowedFacetKindsForObjectKind(objectKind);
  const required = getRequiredFacetKindsForObjectKind(objectKind);
  const optional = getOptionalFacetKindsForObjectKind(objectKind);
  const allowedSet = new Set<string>(allowed);
  const facetKindSet = new Set(facetKinds);
  const missing = required.filter((facetKind) => !facetKindSet.has(facetKind));
  const disallowed = [...new Set(facetKinds.filter((facetKind) => !allowedSet.has(facetKind)))];
  const seen = new Set<string>();
  const duplicates = [...new Set(facetKinds.filter((facetKind) => {
    if (seen.has(facetKind)) {
      return true;
    }
    seen.add(facetKind);
    return false;
  }))];

  return {
    valid: missing.length === 0 && disallowed.length === 0,
    required,
    optional,
    allowed,
    missing: [...missing],
    disallowed,
    duplicates,
  };
}

export function getFacetPayloadShapeDescriptor(
  objectKind: OperationalOntologyObjectKind,
  facetKind: OperationalOntologyFacetKind,
): FacetPayloadShapeDescriptor | undefined {
  const objectShapes =
    FACET_PAYLOAD_SHAPES_BY_OBJECT_KIND[objectKind] as Partial<
      Record<OperationalOntologyFacetKind, FacetPayloadShapeDescriptor>
    >;

  return objectShapes[facetKind];
}

export function validateFacetPayloadShape(
  objectKind: OperationalOntologyObjectKind,
  facetKind: OperationalOntologyFacetKind,
  payload: unknown,
): FacetPayloadShapeValidationResult {
  const descriptor = getFacetPayloadShapeDescriptor(objectKind, facetKind);

  if (!descriptor) {
    return {
      valid: false,
      requiredKeys: [],
      missingKeys: [],
    };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      valid: false,
      requiredKeys: descriptor.requiredKeys,
      missingKeys: [...descriptor.requiredKeys],
    };
  }

  const record = payload as Record<string, unknown>;
  const missingKeys = descriptor.requiredKeys.filter((key) => !(key in record));

  return {
    valid: missingKeys.length === 0,
    requiredKeys: descriptor.requiredKeys,
    missingKeys,
  };
}
