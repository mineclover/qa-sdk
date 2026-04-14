import type {
  OntologyAddressAllocationRecord,
  OntologyAddressSegmentRecord,
  OntologyAllocationPlanWriteSet,
  OntologyAxisRecord,
  OntologyRegistryDuplicateKeyConflict,
  OntologyNamespaceRecord,
  OntologyRegistryDriftConflict,
  OntologyRegistryInvalidSegmentConflict,
  OntologyRegistryMissingTaxonomyAxisConflict,
  OntologyRegistryRecordKey,
  OntologyRegistrySegmentOverlapConflict,
  OntologyTaxonomyRecord,
} from "./ontology-registry-store.js";

const FIXTURE_NOW = "2026-04-14T00:00:00.000Z";

export type OntologyRegistryValidationConflict =
  | OntologyRegistryDuplicateKeyConflict
  | OntologyRegistryDriftConflict
  | OntologyRegistryMissingTaxonomyAxisConflict
  | OntologyRegistryInvalidSegmentConflict
  | OntologyRegistrySegmentOverlapConflict;

export interface OntologyRegistryRecordSet {
  readonly namespaces?: readonly OntologyNamespaceRecord[];
  readonly axes?: readonly OntologyAxisRecord[];
  readonly taxonomies?: readonly OntologyTaxonomyRecord[];
  readonly allocations?: readonly OntologyAddressAllocationRecord[];
  readonly segments?: readonly OntologyAddressSegmentRecord[];
}

export interface OntologyRegistryValidationInput {
  readonly existing?: OntologyRegistryRecordSet;
  readonly attempted: OntologyRegistryRecordSet;
}

export interface OntologyTaxonomyAxisReferenceValidationInput {
  readonly axes: readonly OntologyAxisRecord[];
  readonly taxonomies: readonly OntologyTaxonomyRecord[];
}

export interface OntologyAddressSegmentValidationInput {
  readonly allocations: readonly OntologyAddressAllocationRecord[];
  readonly segments: readonly OntologyAddressSegmentRecord[];
}

export function buildOntologyNamespaceRecord(
  overrides: Partial<OntologyNamespaceRecord> = {},
): OntologyNamespaceRecord {
  return {
    ontologyId: "ontology-a",
    namespace: "qa.runtime",
    owner: "registry-service",
    lifecycle: "draft",
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  };
}

export function buildOntologyAxisRecord(
  overrides: Partial<OntologyAxisRecord> = {},
): OntologyAxisRecord {
  const record: OntologyAxisRecord = {
    ontologyId: "ontology-a",
    axisId: "region",
    versionId: "v1",
    values: ["us", "eu"],
    valuesHash: "fnv1a32:region",
    capacity: 4,
    lifecycle: "draft",
    ...overrides,
  };
  return { ...record, values: [...record.values] };
}

export function buildOntologyTaxonomyRecord(
  overrides: Partial<OntologyTaxonomyRecord> = {},
): OntologyTaxonomyRecord {
  const record: OntologyTaxonomyRecord = {
    ontologyId: "ontology-a",
    taxonomyId: "runtime-surface",
    versionId: "v1",
    appliesTo: ["service"],
    axisIds: ["region"],
    identityAxisIds: ["region"],
    space: "runtime",
    lifecycle: "draft",
    ...overrides,
  };
  return {
    ...record,
    appliesTo: [...record.appliesTo],
    axisIds: [...record.axisIds],
    identityAxisIds: [...record.identityAxisIds],
  };
}

export function buildOntologyAddressAllocationRecord(
  overrides: Partial<OntologyAddressAllocationRecord> = {},
): OntologyAddressAllocationRecord {
  return {
    allocationId: "ontology-a:runtime-surface:v1",
    ontologyId: "ontology-a",
    taxonomyId: "runtime-surface",
    prefix: "qa_runtime_surface",
    versionId: "v1",
    addressModel: "product",
    capacity: 16,
    addressOffset: 0,
    addressSize: 16,
    status: "reserved",
    ...overrides,
  };
}

export function buildOntologyAddressSegmentRecord(
  overrides: Partial<OntologyAddressSegmentRecord> = {},
): OntologyAddressSegmentRecord {
  const record: OntologyAddressSegmentRecord = {
    allocationId: "ontology-a:runtime-surface:v1",
    segmentId: "ontology-a:runtime-surface:v1:product",
    consumes: ["region"],
    addressOffset: 0,
    addressSize: 16,
    ...overrides,
  };
  return { ...record, consumes: [...record.consumes] };
}

export function recordsFromOntologyAllocationPlanWriteSet(
  writeSet: OntologyAllocationPlanWriteSet,
): OntologyRegistryRecordSet {
  return {
    namespaces: [writeSet.namespace],
    axes: writeSet.axes,
    taxonomies: writeSet.taxonomies,
    allocations: writeSet.allocations,
    segments: writeSet.segments,
  };
}

export function validateOntologyRegistryRows(
  input: OntologyRegistryValidationInput,
): OntologyRegistryValidationConflict[] {
  const existing = input.existing ?? {};
  const attempted = input.attempted;
  const axes = [...(existing.axes ?? []), ...(attempted.axes ?? [])];
  const taxonomies = [
    ...(existing.taxonomies ?? []),
    ...(attempted.taxonomies ?? []),
  ];
  const allocations = [
    ...(existing.allocations ?? []),
    ...(attempted.allocations ?? []),
  ];
  const segments = [...(existing.segments ?? []), ...(attempted.segments ?? [])];

  return [
    ...detectOntologyRegistryDuplicateKeys(input),
    ...detectOntologyRegistrySameKeyDrift(input),
    ...validateOntologyTaxonomyAxisReferences({ axes, taxonomies }),
    ...validateOntologyAddressSegments({ allocations, segments }),
  ];
}

export function validateOntologyTaxonomyAxisReferences(
  input: OntologyTaxonomyAxisReferenceValidationInput,
): OntologyRegistryMissingTaxonomyAxisConflict[] {
  const axisKeys = new Set(
    input.axes.map((axis) =>
      compoundKey(axis.ontologyId, axis.axisId, axis.versionId),
    ),
  );
  const conflicts: OntologyRegistryMissingTaxonomyAxisConflict[] = [];

  for (const taxonomy of input.taxonomies) {
    for (const axisId of unique([
      ...taxonomy.axisIds,
      ...taxonomy.identityAxisIds,
    ])) {
      if (
        axisKeys.has(
          compoundKey(taxonomy.ontologyId, axisId, taxonomy.versionId),
        )
      ) {
        continue;
      }
      conflicts.push({
        code: "missing-taxonomy-axis",
        message: `Taxonomy "${taxonomy.taxonomyId}" references missing axis "${axisId}" for ontology "${taxonomy.ontologyId}" version "${taxonomy.versionId}"`,
        ontologyId: taxonomy.ontologyId,
        taxonomyId: taxonomy.taxonomyId,
        versionId: taxonomy.versionId,
        axisId,
      });
    }
  }

  return conflicts;
}

export function validateOntologyAddressSegments(
  input: OntologyAddressSegmentValidationInput,
): (OntologyRegistryInvalidSegmentConflict | OntologyRegistrySegmentOverlapConflict)[] {
  const allocationsById = new Map(
    input.allocations.map((allocation) => [allocation.allocationId, allocation]),
  );
  const conflicts: (
    | OntologyRegistryInvalidSegmentConflict
    | OntologyRegistrySegmentOverlapConflict
  )[] = [];
  const overlapCandidates = new Map<string, OntologyAddressSegmentRecord[]>();

  for (const segment of input.segments) {
    const allocation = allocationsById.get(segment.allocationId);
    if (!allocation) {
      conflicts.push(invalidSegment(segment, "missing-allocation"));
    }
    if (segment.consumes.length === 0) {
      conflicts.push(invalidSegment(segment, "empty-consumes"));
    }
    if (segment.addressSize <= 0) {
      conflicts.push(invalidSegment(segment, "non-positive-size"));
    }
    if (segment.addressOffset < 0) {
      conflicts.push(invalidSegment(segment, "negative-offset"));
    }

    if (!allocation || segment.addressSize <= 0 || segment.addressOffset < 0) {
      continue;
    }

    const allocationStart = allocation.addressOffset;
    const allocationEnd = allocation.addressOffset + allocation.addressSize;
    const segmentEnd = segment.addressOffset + segment.addressSize;
    if (
      segment.addressOffset < allocationStart ||
      segmentEnd > allocationEnd
    ) {
      conflicts.push(invalidSegment(segment, "outside-allocation-range"));
      continue;
    }

    const candidates = overlapCandidates.get(segment.allocationId) ?? [];
    candidates.push(segment);
    overlapCandidates.set(segment.allocationId, candidates);
  }

  for (const [allocationId, segments] of overlapCandidates.entries()) {
    const sorted = [...segments].sort(
      (left, right) =>
        left.addressOffset - right.addressOffset ||
        left.addressSize - right.addressSize ||
        left.segmentId.localeCompare(right.segmentId),
    );
    let previous = sorted[0];
    if (!previous) continue;

    for (const current of sorted.slice(1)) {
      const previousEnd = previous.addressOffset + previous.addressSize;
      if (current.addressOffset < previousEnd) {
        conflicts.push({
          code: "segment-overlap",
          message: `Segment "${current.segmentId}" overlaps segment "${previous.segmentId}" in allocation "${allocationId}"`,
          allocationId,
          segmentId: current.segmentId,
          overlapsWithSegmentId: previous.segmentId,
          addressOffset: current.addressOffset,
          addressSize: current.addressSize,
        });
      }

      const currentEnd = current.addressOffset + current.addressSize;
      if (currentEnd > previousEnd) {
        previous = current;
      }
    }
  }

  return conflicts;
}

export function detectOntologyRegistrySameKeyDrift(
  input: OntologyRegistryValidationInput,
): OntologyRegistryDriftConflict[] {
  const existing = input.existing ?? {};
  const attempted = input.attempted;

  return [
    ...detectDriftForKind(
      "namespace",
      existing.namespaces ?? [],
      attempted.namespaces ?? [],
      namespaceDriftKeySpecs,
      namespaceDriftFields,
    ),
    ...detectDriftForKind(
      "axis",
      existing.axes ?? [],
      attempted.axes ?? [],
      axisDriftKeySpecs,
      axisDriftFields,
    ),
    ...detectDriftForKind(
      "taxonomy",
      existing.taxonomies ?? [],
      attempted.taxonomies ?? [],
      taxonomyDriftKeySpecs,
      taxonomyDriftFields,
    ),
    ...detectDriftForKind(
      "allocation",
      existing.allocations ?? [],
      attempted.allocations ?? [],
      allocationDriftKeySpecs,
      allocationDriftFields,
    ),
    ...detectDriftForKind(
      "segment",
      existing.segments ?? [],
      attempted.segments ?? [],
      segmentDriftKeySpecs,
      segmentDriftFields,
    ),
  ];
}

export function detectOntologyRegistryDuplicateKeys(
  input: OntologyRegistryValidationInput,
): OntologyRegistryDuplicateKeyConflict[] {
  const existing = input.existing ?? {};
  const attempted = input.attempted;

  return [
    ...detectDuplicatesForKind(
      "namespace",
      existing.namespaces ?? [],
      attempted.namespaces ?? [],
      namespaceDriftKeySpecs,
      namespaceDriftFields,
    ),
    ...detectDuplicatesForKind(
      "axis",
      existing.axes ?? [],
      attempted.axes ?? [],
      axisDriftKeySpecs,
      axisDriftFields,
    ),
    ...detectDuplicatesForKind(
      "taxonomy",
      existing.taxonomies ?? [],
      attempted.taxonomies ?? [],
      taxonomyDriftKeySpecs,
      taxonomyDriftFields,
    ),
    ...detectDuplicatesForKind(
      "allocation",
      existing.allocations ?? [],
      attempted.allocations ?? [],
      allocationDriftKeySpecs,
      allocationDriftFields,
    ),
    ...detectDuplicatesForKind(
      "segment",
      existing.segments ?? [],
      attempted.segments ?? [],
      segmentDriftKeySpecs,
      segmentDriftFields,
    ),
  ];
}

type RecordKindName = OntologyRegistryRecordKey["recordKind"];

interface DriftKeySpec<T extends object> {
  readonly keyOf: (record: T) => string;
  readonly conflictKeyOf: (record: T) => OntologyRegistryRecordKey;
}

const namespaceDriftFields = [
  "ontologyId",
  "namespace",
  "owner",
  "lifecycle",
  "createdAt",
  "updatedAt",
] as const satisfies readonly (keyof OntologyNamespaceRecord)[];

const namespaceDriftKeySpecs: readonly DriftKeySpec<OntologyNamespaceRecord>[] =
  [
    {
      keyOf: (record) => compoundKey(record.ontologyId),
      conflictKeyOf: (record) => ({
        recordKind: "namespace",
        ontologyId: record.ontologyId,
      }),
    },
    {
      keyOf: (record) => compoundKey(record.namespace),
      conflictKeyOf: (record) => ({
        recordKind: "namespace",
        namespace: record.namespace,
      }),
    },
  ];

const axisDriftFields = [
  "values",
  "valuesHash",
  "capacity",
  "lifecycle",
] as const satisfies readonly (keyof OntologyAxisRecord)[];

const axisDriftKeySpecs: readonly DriftKeySpec<OntologyAxisRecord>[] = [
  {
    keyOf: (record) =>
      compoundKey(record.ontologyId, record.axisId, record.versionId),
    conflictKeyOf: (record) => ({
      recordKind: "axis",
      ontologyId: record.ontologyId,
      axisId: record.axisId,
      versionId: record.versionId,
    }),
  },
];

const taxonomyDriftFields = [
  "appliesTo",
  "axisIds",
  "identityAxisIds",
  "space",
  "lifecycle",
] as const satisfies readonly (keyof OntologyTaxonomyRecord)[];

const taxonomyDriftKeySpecs: readonly DriftKeySpec<OntologyTaxonomyRecord>[] = [
  {
    keyOf: (record) =>
      compoundKey(record.ontologyId, record.taxonomyId, record.versionId),
    conflictKeyOf: (record) => ({
      recordKind: "taxonomy",
      ontologyId: record.ontologyId,
      taxonomyId: record.taxonomyId,
      versionId: record.versionId,
    }),
  },
];

const allocationDriftFields = [
  "allocationId",
  "ontologyId",
  "taxonomyId",
  "prefix",
  "versionId",
  "addressModel",
  "capacity",
  "addressOffset",
  "addressSize",
  "status",
] as const satisfies readonly (keyof OntologyAddressAllocationRecord)[];

const allocationDriftKeySpecs: readonly DriftKeySpec<OntologyAddressAllocationRecord>[] =
  [
    {
      keyOf: (record) => compoundKey(record.allocationId),
      conflictKeyOf: (record) => ({
        recordKind: "allocation",
        allocationId: record.allocationId,
      }),
    },
    {
      keyOf: (record) => compoundKey(record.prefix, record.versionId),
      conflictKeyOf: (record) => ({
        recordKind: "allocation",
        prefix: record.prefix,
        versionId: record.versionId,
      }),
    },
    {
      keyOf: (record) =>
        compoundKey(record.ontologyId, record.taxonomyId, record.versionId),
      conflictKeyOf: (record) => ({
        recordKind: "allocation",
        ontologyId: record.ontologyId,
        taxonomyId: record.taxonomyId,
        versionId: record.versionId,
      }),
    },
  ];

const segmentDriftFields = [
  "consumes",
  "addressOffset",
  "addressSize",
] as const satisfies readonly (keyof OntologyAddressSegmentRecord)[];

const segmentDriftKeySpecs: readonly DriftKeySpec<OntologyAddressSegmentRecord>[] =
  [
    {
      keyOf: (record) => compoundKey(record.allocationId, record.segmentId),
      conflictKeyOf: (record) => ({
        recordKind: "segment",
        allocationId: record.allocationId,
        segmentId: record.segmentId,
      }),
    },
  ];

function detectDriftForKind<T extends object>(
  recordKind: RecordKindName,
  existingRecords: readonly T[],
  attemptedRecords: readonly T[],
  keySpecs: readonly DriftKeySpec<T>[],
  fields: readonly (keyof T & string)[],
): OntologyRegistryDriftConflict[] {
  const conflicts: OntologyRegistryDriftConflict[] = [];
  const objectIds = new WeakMap<object, number>();
  let nextObjectId = 1;
  const emittedPairs = new Set<string>();

  const objectId = (record: T): number => {
    const known = objectIds.get(record);
    if (known !== undefined) return known;
    const id = nextObjectId;
    nextObjectId += 1;
    objectIds.set(record, id);
    return id;
  };

  for (const keySpec of keySpecs) {
    const recordsByKey = new Map<string, T>();
    for (const record of existingRecords) {
      if (!recordsByKey.has(keySpec.keyOf(record))) {
        recordsByKey.set(keySpec.keyOf(record), record);
      }
    }

    for (const record of attemptedRecords) {
      const key = keySpec.keyOf(record);
      const existing = recordsByKey.get(key);
      if (!existing) {
        recordsByKey.set(key, record);
        continue;
      }

      const pairKey = `${objectId(existing)}:${objectId(record)}`;
      if (emittedPairs.has(pairKey)) continue;

      const changedFields = fields.filter(
        (field) => !sameValue(existing[field], record[field]),
      );
      if (changedFields.length === 0) continue;

      emittedPairs.add(pairKey);
      conflicts.push({
        code: "drift",
        message: `${recordKind} record drift detected for ${formatRecordKey(
          keySpec.conflictKeyOf(record),
        )}`,
        key: keySpec.conflictKeyOf(record),
        fields: changedFields,
        existing: existing as OntologyRegistryDriftConflict["existing"],
        attempted: record as OntologyRegistryDriftConflict["attempted"],
      });
    }
  }

  return conflicts;
}

function detectDuplicatesForKind<T extends object>(
  recordKind: RecordKindName,
  existingRecords: readonly T[],
  attemptedRecords: readonly T[],
  keySpecs: readonly DriftKeySpec<T>[],
  fields: readonly (keyof T & string)[],
): OntologyRegistryDuplicateKeyConflict[] {
  const conflicts: OntologyRegistryDuplicateKeyConflict[] = [];
  const objectIds = new WeakMap<object, number>();
  let nextObjectId = 1;
  const emittedPairs = new Set<string>();

  const objectId = (record: T): number => {
    const known = objectIds.get(record);
    if (known !== undefined) return known;
    const id = nextObjectId;
    nextObjectId += 1;
    objectIds.set(record, id);
    return id;
  };

  for (const keySpec of keySpecs) {
    const recordsByKey = new Map<string, T>();
    for (const record of existingRecords) {
      if (!recordsByKey.has(keySpec.keyOf(record))) {
        recordsByKey.set(keySpec.keyOf(record), record);
      }
    }

    for (const record of attemptedRecords) {
      const key = keySpec.keyOf(record);
      const existing = recordsByKey.get(key);
      if (!existing) {
        recordsByKey.set(key, record);
        continue;
      }

      const isExactDuplicate = fields.every((field) =>
        sameValue(existing[field], record[field]),
      );
      if (!isExactDuplicate) continue;

      const pairKey = `${objectId(existing)}:${objectId(record)}`;
      if (emittedPairs.has(pairKey)) continue;

      emittedPairs.add(pairKey);
      conflicts.push({
        code: "duplicate-key",
        message: `Duplicate ${recordKind} record for ${formatRecordKey(
          keySpec.conflictKeyOf(record),
        )}`,
        key: keySpec.conflictKeyOf(record),
      });
    }
  }

  return conflicts;
}

function invalidSegment(
  segment: OntologyAddressSegmentRecord,
  reason: OntologyRegistryInvalidSegmentConflict["reason"],
): OntologyRegistryInvalidSegmentConflict {
  return {
    code: "invalid-segment",
    message: `Segment "${segment.segmentId}" is invalid: ${reason}`,
    allocationId: segment.allocationId,
    segmentId: segment.segmentId,
    reason,
  };
}

function compoundKey(...parts: readonly string[]): string {
  return parts.join("\u0000");
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => sameValue(value, right[index]))
    );
  }
  return Object.is(left, right);
}

function formatRecordKey(key: OntologyRegistryRecordKey): string {
  return Object.entries(key)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}=${String(value)}`)
    .join(", ");
}
