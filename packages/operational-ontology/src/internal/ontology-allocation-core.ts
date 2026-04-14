import type {
  AxisSchema,
  OperationalOntologySchema,
  TaxonomySchema,
} from "./schema-core.js";
import { validateOperationalOntologySchema } from "./schema-core.js";

export type OntologyAddressModel = "product" | "sum";
export type OntologyAddressAllocationStatus = "reserved" | "active" | "deprecated";

export interface OntologyNamespace {
  ontologyId: string;
  namespace: string;
  owner?: string;
  lifecycle: "draft" | "active" | "deprecated";
  createdAt: string;
  updatedAt: string;
}

export interface OntologyAxisRegistration {
  ontologyId: string;
  axisId: string;
  versionId: string;
  values: readonly string[];
  valuesHash: string;
  capacity: number;
  lifecycle: "draft" | "active" | "deprecated";
}

export interface OntologyTaxonomyRegistration {
  ontologyId: string;
  taxonomyId: string;
  versionId: string;
  appliesTo: readonly string[];
  axisIds: readonly string[];
  identityAxisIds: readonly string[];
  space?: string;
  lifecycle: "draft" | "active" | "deprecated";
}

export interface OntologyAddressAllocation {
  allocationId: string;
  ontologyId: string;
  taxonomyId: string;
  prefix: string;
  versionId: string;
  addressModel: OntologyAddressModel;
  capacity: number;
  addressOffset: number;
  addressSize: number;
  status: OntologyAddressAllocationStatus;
}

export interface OntologyAddressSegment {
  allocationId: string;
  segmentId: string;
  consumes: readonly string[];
  addressOffset: number;
  addressSize: number;
}

export interface OntologyAddressAllocationPolicy {
  ontologyId: string;
  namespace?: string;
  owner?: string;
  versionId?: string;
  now?: string;
  lifecycle?: "draft" | "active" | "deprecated";
  status?: OntologyAddressAllocationStatus;
  addressModel?: OntologyAddressModel;
  addressOffsetStart?: number;
  prefixByTaxonomyId?: Readonly<Record<string, string>>;
  capacityByAxisId?: Readonly<Record<string, number>>;
  capacityByTaxonomyId?: Readonly<Record<string, number>>;
}

export interface OntologyAddressAllocationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  path: string;
  target?: OntologyAddressAllocationIssueTarget;
}

export interface OntologyAddressAllocationIssueTarget {
  ontologyId?: string;
  prefix?: string;
  versionId?: string;
  taxonomyId?: string;
  axisId?: string;
  allocationId?: string;
  segmentId?: string;
  taxonomyIds?: readonly string[];
  allocationIds?: readonly string[];
}

export interface OntologyAddressAllocationValidationResult {
  valid: boolean;
  issues: readonly OntologyAddressAllocationIssue[];
}

export interface OntologyAddressAllocationPlan {
  namespace: OntologyNamespace;
  axes: readonly OntologyAxisRegistration[];
  taxonomies: readonly OntologyTaxonomyRegistration[];
  allocations: readonly OntologyAddressAllocation[];
  segments: readonly OntologyAddressSegment[];
  validation: OntologyAddressAllocationValidationResult;
}

export function allocateOntologyAddressSpace(
  schema: OperationalOntologySchema,
  policy: OntologyAddressAllocationPolicy,
): OntologyAddressAllocationPlan {
  const now = policy.now ?? new Date(0).toISOString();
  const versionId = policy.versionId ?? "v1";
  const lifecycle = policy.lifecycle ?? "draft";
  const status = policy.status ?? "reserved";
  const addressModel = policy.addressModel ?? "product";
  const namespace = normalizeIdentifier(policy.namespace ?? policy.ontologyId);
  const namespaceRecord: OntologyNamespace = {
    ontologyId: policy.ontologyId,
    namespace,
    ...(policy.owner ? { owner: policy.owner } : {}),
    lifecycle,
    createdAt: now,
    updatedAt: now,
  };

  const axes = schema.axes.map((axis): OntologyAxisRegistration => {
    const capacity = policy.capacityByAxisId?.[axis.id] ?? axis.capacity ?? nextPowerOf2(axis.values.length * 2);
    return {
      ontologyId: policy.ontologyId,
      axisId: axis.id,
      versionId,
      values: [...axis.values],
      valuesHash: stableStringHash(axis.values.join("\u0000")),
      capacity,
      lifecycle,
    };
  });
  const axesById = new Map(axes.map((axis) => [axis.axisId, axis]));
  const taxonomies = schema.taxonomies.map((taxonomy): OntologyTaxonomyRegistration => ({
    ontologyId: policy.ontologyId,
    taxonomyId: taxonomy.id,
    versionId,
    appliesTo: [...taxonomy.appliesTo],
    axisIds: [...taxonomy.axisIds],
    identityAxisIds: [...(taxonomy.identityAxisIds ?? taxonomy.axisIds)],
    ...(taxonomy.space ? { space: taxonomy.space } : {}),
    lifecycle,
  }));

  let nextOffset = policy.addressOffsetStart ?? 0;
  const allocations: OntologyAddressAllocation[] = [];
  const segments: OntologyAddressSegment[] = [];

  for (const taxonomy of taxonomies) {
    const axisCaps = taxonomy.axisIds.map((axisId) => axesById.get(axisId)?.capacity ?? 0);
    const calculatedSize = addressModel === "sum"
      ? axisCaps.reduce((sum, capacity) => sum + capacity, 0)
      : axisCaps.reduce((product, capacity) => product * capacity, 1);
    const addressSize = policy.capacityByTaxonomyId?.[taxonomy.taxonomyId] ?? calculatedSize;
    const prefix = policy.prefixByTaxonomyId?.[taxonomy.taxonomyId] ??
      `${namespace}_${normalizeIdentifier(taxonomy.taxonomyId)}`;
    const allocationId = `${policy.ontologyId}:${taxonomy.taxonomyId}:${versionId}`;

    allocations.push({
      allocationId,
      ontologyId: policy.ontologyId,
      taxonomyId: taxonomy.taxonomyId,
      prefix,
      versionId,
      addressModel,
      capacity: addressSize,
      addressOffset: nextOffset,
      addressSize,
      status,
    });

    if (addressModel === "sum") {
      let segmentOffset = nextOffset;
      for (const axisId of taxonomy.axisIds) {
        const segmentSize = axesById.get(axisId)?.capacity ?? 0;
        segments.push({
          allocationId,
          segmentId: `${allocationId}:${axisId}`,
          consumes: [axisId],
          addressOffset: segmentOffset,
          addressSize: segmentSize,
        });
        segmentOffset += segmentSize;
      }
    } else {
      segments.push({
        allocationId,
        segmentId: `${allocationId}:product`,
        consumes: [...taxonomy.axisIds],
        addressOffset: nextOffset,
        addressSize,
      });
    }

    nextOffset += addressSize;
  }

  return {
    namespace: namespaceRecord,
    axes,
    taxonomies,
    allocations,
    segments,
    validation: validateOntologyAddressAllocationPlan({
      namespace: namespaceRecord,
      axes,
      taxonomies,
      allocations,
      segments,
      schema,
    }),
  };
}

export function validateOntologyAddressAllocationPlan(input: {
  namespace: OntologyNamespace;
  axes: readonly OntologyAxisRegistration[];
  taxonomies: readonly OntologyTaxonomyRegistration[];
  allocations: readonly OntologyAddressAllocation[];
  segments?: readonly OntologyAddressSegment[];
  schema?: OperationalOntologySchema;
}): OntologyAddressAllocationValidationResult {
  const issues: OntologyAddressAllocationIssue[] = [];

  if (!input.namespace.ontologyId.trim()) {
    issues.push(issue("error", "ontology-id-empty", "Ontology id must not be empty", "namespace.ontologyId"));
  }
  if (!input.namespace.namespace.trim()) {
    issues.push(issue("error", "ontology-namespace-empty", "Ontology namespace must not be empty", "namespace.namespace"));
  }

  if (input.schema) {
    const schemaValidation = validateOperationalOntologySchema(input.schema);
    issues.push(...schemaValidation.issues.map((item) => issue(
      item.level,
      item.code,
      item.message,
      `schema.${item.path}`,
    )));
  }

  for (const duplicate of duplicates(input.axes.map((axis) => `${axis.ontologyId}:${axis.axisId}:${axis.versionId}`))) {
    const axis = input.axes.find((item) => `${item.ontologyId}:${item.axisId}:${item.versionId}` === duplicate);
    issues.push(issue("error", "ontology-axis-registration-duplicate", `Duplicate axis registration "${duplicate}"`, "axes", axis
      ? { ontologyId: axis.ontologyId, axisId: axis.axisId, versionId: axis.versionId }
      : undefined));
  }
  for (const duplicate of duplicates(input.taxonomies.map((taxonomy) => `${taxonomy.ontologyId}:${taxonomy.taxonomyId}:${taxonomy.versionId}`))) {
    const taxonomy = input.taxonomies.find((item) => `${item.ontologyId}:${item.taxonomyId}:${item.versionId}` === duplicate);
    issues.push(issue("error", "ontology-taxonomy-registration-duplicate", `Duplicate taxonomy registration "${duplicate}"`, "taxonomies", taxonomy
      ? { ontologyId: taxonomy.ontologyId, taxonomyId: taxonomy.taxonomyId, versionId: taxonomy.versionId }
      : undefined));
  }
  for (const duplicate of duplicates(input.allocations.map((allocation) => `${allocation.prefix}:${allocation.versionId}`))) {
    const allocations = input.allocations.filter((item) => `${item.prefix}:${item.versionId}` === duplicate);
    const allocation = allocations[0];
    issues.push(issue("error", "ontology-prefix-version-duplicate", `Duplicate prefix/version allocation "${duplicate}"`, "allocations", allocation
      ? {
        ontologyId: allocation.ontologyId,
        prefix: allocation.prefix,
        versionId: allocation.versionId,
        taxonomyIds: allocations.map((item) => item.taxonomyId),
        allocationIds: allocations.map((item) => item.allocationId),
      }
      : undefined));
  }
  for (const duplicate of duplicates(input.allocations.map((allocation) => `${allocation.ontologyId}:${allocation.taxonomyId}:${allocation.versionId}`))) {
    const allocations = input.allocations.filter((item) => `${item.ontologyId}:${item.taxonomyId}:${item.versionId}` === duplicate);
    const allocation = allocations[0];
    issues.push(issue("error", "ontology-taxonomy-allocation-duplicate", `Duplicate taxonomy allocation "${duplicate}"`, "allocations", allocation
      ? {
        ontologyId: allocation.ontologyId,
        taxonomyId: allocation.taxonomyId,
        versionId: allocation.versionId,
        allocationIds: allocations.map((item) => item.allocationId),
      }
      : undefined));
  }

  const axisKeys = new Set(input.axes.map((axis) => `${axis.ontologyId}:${axis.axisId}:${axis.versionId}`));
  for (const taxonomy of input.taxonomies) {
    for (const axisId of taxonomy.axisIds) {
      if (!axisKeys.has(`${taxonomy.ontologyId}:${axisId}:${taxonomy.versionId}`)) {
        issues.push(issue(
          "error",
          "ontology-taxonomy-axis-missing",
          `Taxonomy "${taxonomy.taxonomyId}" references missing axis "${axisId}"`,
          `taxonomies.${taxonomy.taxonomyId}.axisIds`,
          {
            ontologyId: taxonomy.ontologyId,
            taxonomyId: taxonomy.taxonomyId,
            versionId: taxonomy.versionId,
            axisId,
          },
        ));
      }
    }
    for (const axisId of taxonomy.identityAxisIds) {
      if (!taxonomy.axisIds.includes(axisId)) {
        issues.push(issue(
          "error",
          "ontology-taxonomy-identity-axis-missing",
          `identity axis "${axisId}" must also be listed in axisIds`,
          `taxonomies.${taxonomy.taxonomyId}.identityAxisIds`,
          {
            ontologyId: taxonomy.ontologyId,
            taxonomyId: taxonomy.taxonomyId,
            versionId: taxonomy.versionId,
            axisId,
          },
        ));
      }
    }
  }

  const allocationIds = new Set(input.allocations.map((allocation) => allocation.allocationId));
  for (const allocation of input.allocations) {
    if (allocation.capacity <= 0 || allocation.addressSize <= 0) {
      issues.push(issue(
        "error",
        "ontology-allocation-size-invalid",
        `Allocation "${allocation.allocationId}" must have positive capacity and addressSize`,
        `allocations.${allocation.allocationId}`,
        {
          ontologyId: allocation.ontologyId,
          prefix: allocation.prefix,
          versionId: allocation.versionId,
          taxonomyId: allocation.taxonomyId,
          allocationId: allocation.allocationId,
        },
      ));
    }
    if (allocation.addressOffset < 0) {
      issues.push(issue(
        "error",
        "ontology-allocation-offset-invalid",
        `Allocation "${allocation.allocationId}" must not have negative addressOffset`,
        `allocations.${allocation.allocationId}.addressOffset`,
        {
          ontologyId: allocation.ontologyId,
          prefix: allocation.prefix,
          versionId: allocation.versionId,
          taxonomyId: allocation.taxonomyId,
          allocationId: allocation.allocationId,
        },
      ));
    }
    if (allocation.capacity !== allocation.addressSize) {
      issues.push(issue(
        "warning",
        "ontology-allocation-capacity-size-drift",
        `Allocation "${allocation.allocationId}" capacity differs from addressSize`,
        `allocations.${allocation.allocationId}`,
        {
          ontologyId: allocation.ontologyId,
          prefix: allocation.prefix,
          versionId: allocation.versionId,
          taxonomyId: allocation.taxonomyId,
          allocationId: allocation.allocationId,
        },
      ));
    }
  }

  for (const segment of input.segments ?? []) {
    if (!allocationIds.has(segment.allocationId)) {
      issues.push(issue(
        "error",
        "ontology-segment-allocation-missing",
        `Segment "${segment.segmentId}" references missing allocation "${segment.allocationId}"`,
        `segments.${segment.segmentId}`,
        { allocationId: segment.allocationId, segmentId: segment.segmentId },
      ));
    }
    if (segment.addressSize <= 0) {
      issues.push(issue(
        "error",
        "ontology-segment-size-invalid",
        `Segment "${segment.segmentId}" must have positive addressSize`,
        `segments.${segment.segmentId}.addressSize`,
        { allocationId: segment.allocationId, segmentId: segment.segmentId },
      ));
    }
    if (segment.consumes.length === 0) {
      issues.push(issue(
        "error",
        "ontology-segment-consumes-empty",
        `Segment "${segment.segmentId}" must consume at least one axis`,
        `segments.${segment.segmentId}.consumes`,
        { allocationId: segment.allocationId, segmentId: segment.segmentId },
      ));
    }
  }

  return {
    valid: issues.every((item) => item.level !== "error"),
    issues,
  };
}

function issue(
  level: "error" | "warning",
  code: string,
  message: string,
  path: string,
  target?: OntologyAddressAllocationIssueTarget,
): OntologyAddressAllocationIssue {
  return target ? { level, code, message, path, target } : { level, code, message, path };
}

function nextPowerOf2(value: number): number {
  let power = 1;
  while (power < Math.max(1, value)) power *= 2;
  return power;
}

function normalizeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "ontology";
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

function stableStringHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
