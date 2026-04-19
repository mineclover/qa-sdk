// @def.boundary registry-system
// @def.doc registry-system

import { getTableName } from "drizzle-orm";
import type { SqlDriver } from "index-meta";
import {
  ontologyAddressAllocation,
  ontologyAddressSegment,
  ontologyAxis,
  ontologyNamespace,
  ontologyTaxonomy,
} from "../db/schema.js";
import {
  OntologyRegistryStoreError,
  type OntologyAddressAllocationRecord,
  type OntologyAddressSegmentRecord,
  type OntologyAllocationPlanWriteSet,
  type OntologyAxisRecord,
  type OntologyNamespaceRecord,
  type OntologyRegistryDuplicateKeyConflict,
  type OntologyRegistryStore,
  type OntologyTaxonomyRecord,
} from "./ontology-registry-store.js";
import {
  recordsFromOntologyAllocationPlanWriteSet,
  validateOntologyRegistryRows,
  type OntologyRegistryRecordSet,
  type OntologyRegistryValidationConflict,
} from "./ontology-registry-validation.js";

const TABLES = {
  namespace: getTableName(ontologyNamespace),
  axis: getTableName(ontologyAxis),
  taxonomy: getTableName(ontologyTaxonomy),
  allocation: getTableName(ontologyAddressAllocation),
  segment: getTableName(ontologyAddressSegment),
} as const;

export class SqlOntologyRegistryStore implements OntologyRegistryStore {
  constructor(private readonly driver: SqlDriver) {}

  async writeAllocationPlan(writeSet: OntologyAllocationPlanWriteSet): Promise<void> {
    const attempted = recordsFromOntologyAllocationPlanWriteSet(writeSet);
    const conflicts = validateOntologyRegistryRows({
      existing: await this.snapshot(),
      attempted,
    });

    if (conflicts.length > 0) {
      throw partialWriteRejected(conflicts);
    }

    try {
      await this.driver.transaction(async (tx) => {
        await insertNamespace(tx, writeSet.namespace);
        for (const axis of writeSet.axes) {
          await insertAxis(tx, axis);
        }
        for (const taxonomy of writeSet.taxonomies) {
          await insertTaxonomy(tx, taxonomy);
        }
        for (const allocation of writeSet.allocations) {
          await insertAllocation(tx, allocation);
        }
        for (const segment of writeSet.segments) {
          await insertSegment(tx, segment);
        }
      });
    } catch (error) {
      const mapped = await this.mapSqliteUniqueConstraint(error, writeSet);
      if (mapped) {
        throw partialWriteRejected(mapped);
      }
      throw error;
    }
  }

  async listNamespaces(): Promise<OntologyNamespaceRecord[]> {
    const rows = await this.driver.query<NamespaceRow>(
      `SELECT ontology_id, namespace, owner, lifecycle, created_at, updated_at
       FROM ${TABLES.namespace}
       ORDER BY ontology_id`,
    );
    return rows.map(toNamespaceRecord);
  }

  async updateAllocationStatus(
    allocationId: string,
    status: OntologyAddressAllocationRecord["status"],
  ): Promise<OntologyAddressAllocationRecord | null> {
    const existing = await this.getAllocation(allocationId);
    if (!existing) {
      return null;
    }

    await this.driver.execute(
      `UPDATE ${TABLES.allocation}
       SET status = ?
       WHERE allocation_id = ?`,
      [status, allocationId],
    );

    return { ...existing, status };
  }

  async getNamespace(ontologyId: string): Promise<OntologyNamespaceRecord | null> {
    const row = await this.driver.queryOne<NamespaceRow>(
      `SELECT ontology_id, namespace, owner, lifecycle, created_at, updated_at
       FROM ${TABLES.namespace}
       WHERE ontology_id = ?`,
      [ontologyId],
    );
    return row ? toNamespaceRecord(row) : null;
  }

  async listAxes(ontologyId: string, versionId: string): Promise<OntologyAxisRecord[]> {
    const rows = await this.driver.query<AxisRow>(
      `SELECT ontology_id, axis_id, version_id, values_json, values_hash, capacity, lifecycle
       FROM ${TABLES.axis}
       WHERE ontology_id = ? AND version_id = ?
       ORDER BY axis_id`,
      [ontologyId, versionId],
    );
    return rows.map(toAxisRecord);
  }

  async getAxis(
    ontologyId: string,
    axisId: string,
    versionId: string,
  ): Promise<OntologyAxisRecord | null> {
    const row = await this.driver.queryOne<AxisRow>(
      `SELECT ontology_id, axis_id, version_id, values_json, values_hash, capacity, lifecycle
       FROM ${TABLES.axis}
       WHERE ontology_id = ? AND axis_id = ? AND version_id = ?`,
      [ontologyId, axisId, versionId],
    );
    return row ? toAxisRecord(row) : null;
  }

  async listTaxonomies(
    ontologyId: string,
    versionId: string,
  ): Promise<OntologyTaxonomyRecord[]> {
    const rows = await this.driver.query<TaxonomyRow>(
      `SELECT ontology_id, taxonomy_id, version_id, applies_to_json,
              axis_ids_json, identity_axis_ids_json, space, lifecycle
       FROM ${TABLES.taxonomy}
       WHERE ontology_id = ? AND version_id = ?
       ORDER BY taxonomy_id`,
      [ontologyId, versionId],
    );
    return rows.map(toTaxonomyRecord);
  }

  async getTaxonomy(
    ontologyId: string,
    taxonomyId: string,
    versionId: string,
  ): Promise<OntologyTaxonomyRecord | null> {
    const row = await this.driver.queryOne<TaxonomyRow>(
      `SELECT ontology_id, taxonomy_id, version_id, applies_to_json,
              axis_ids_json, identity_axis_ids_json, space, lifecycle
       FROM ${TABLES.taxonomy}
       WHERE ontology_id = ? AND taxonomy_id = ? AND version_id = ?`,
      [ontologyId, taxonomyId, versionId],
    );
    return row ? toTaxonomyRecord(row) : null;
  }

  async listAllocations(
    ontologyId: string,
    versionId: string,
  ): Promise<OntologyAddressAllocationRecord[]> {
    const rows = await this.driver.query<AllocationRow>(
      `SELECT allocation_id, ontology_id, taxonomy_id, prefix, version_id,
              address_model, capacity, address_offset, address_size, status
       FROM ${TABLES.allocation}
       WHERE ontology_id = ? AND version_id = ?
       ORDER BY allocation_id`,
      [ontologyId, versionId],
    );
    return rows.map(toAllocationRecord);
  }

  async getAllocation(
    allocationId: string,
  ): Promise<OntologyAddressAllocationRecord | null> {
    const row = await this.driver.queryOne<AllocationRow>(
      `SELECT allocation_id, ontology_id, taxonomy_id, prefix, version_id,
              address_model, capacity, address_offset, address_size, status
       FROM ${TABLES.allocation}
       WHERE allocation_id = ?`,
      [allocationId],
    );
    return row ? toAllocationRecord(row) : null;
  }

  async listSegments(allocationId: string): Promise<OntologyAddressSegmentRecord[]> {
    const rows = await this.driver.query<SegmentRow>(
      `SELECT allocation_id, segment_id, consumes_json, address_offset, address_size
       FROM ${TABLES.segment}
       WHERE allocation_id = ?
       ORDER BY address_offset, segment_id`,
      [allocationId],
    );
    return rows.map(toSegmentRecord);
  }

  async getSegment(
    allocationId: string,
    segmentId: string,
  ): Promise<OntologyAddressSegmentRecord | null> {
    const row = await this.driver.queryOne<SegmentRow>(
      `SELECT allocation_id, segment_id, consumes_json, address_offset, address_size
       FROM ${TABLES.segment}
       WHERE allocation_id = ? AND segment_id = ?`,
      [allocationId, segmentId],
    );
    return row ? toSegmentRecord(row) : null;
  }

  async listActiveAllocations(): Promise<OntologyAddressAllocationRecord[]> {
    const rows = await this.driver.query<AllocationRow>(
      `SELECT allocation_id, ontology_id, taxonomy_id, prefix, version_id,
              address_model, capacity, address_offset, address_size, status
       FROM ${TABLES.allocation}
       WHERE status = ?
       ORDER BY allocation_id`,
      ["active"],
    );
    return rows.map(toAllocationRecord);
  }

  private async snapshot(): Promise<OntologyRegistryRecordSet> {
    const [namespaces, axes, taxonomies, allocations, segments] = await Promise.all([
      this.driver.query<NamespaceRow>(
        `SELECT ontology_id, namespace, owner, lifecycle, created_at, updated_at
         FROM ${TABLES.namespace}`,
      ),
      this.driver.query<AxisRow>(
        `SELECT ontology_id, axis_id, version_id, values_json, values_hash, capacity, lifecycle
         FROM ${TABLES.axis}`,
      ),
      this.driver.query<TaxonomyRow>(
        `SELECT ontology_id, taxonomy_id, version_id, applies_to_json,
                axis_ids_json, identity_axis_ids_json, space, lifecycle
         FROM ${TABLES.taxonomy}`,
      ),
      this.driver.query<AllocationRow>(
        `SELECT allocation_id, ontology_id, taxonomy_id, prefix, version_id,
                address_model, capacity, address_offset, address_size, status
         FROM ${TABLES.allocation}`,
      ),
      this.driver.query<SegmentRow>(
        `SELECT allocation_id, segment_id, consumes_json, address_offset, address_size
         FROM ${TABLES.segment}`,
      ),
    ]);

    return {
      namespaces: namespaces.map(toNamespaceRecord),
      axes: axes.map(toAxisRecord),
      taxonomies: taxonomies.map(toTaxonomyRecord),
      allocations: allocations.map(toAllocationRecord),
      segments: segments.map(toSegmentRecord),
    };
  }

  private async mapSqliteUniqueConstraint(
    error: unknown,
    writeSet: OntologyAllocationPlanWriteSet,
  ): Promise<OntologyRegistryValidationConflict[] | null> {
    if (!isSqliteUniqueConstraintError(error)) {
      return null;
    }

    const revalidated = validateOntologyRegistryRows({
      existing: await this.snapshot(),
      attempted: recordsFromOntologyAllocationPlanWriteSet(writeSet),
    });
    if (revalidated.length > 0) {
      return revalidated;
    }

    return [fallbackDuplicateKeyConflict(error, writeSet)];
  }
}

interface NamespaceRow extends Record<string, unknown> {
  ontology_id: string;
  namespace: string;
  owner: string | null;
  lifecycle: string;
  created_at: string;
  updated_at: string;
}

interface AxisRow extends Record<string, unknown> {
  ontology_id: string;
  axis_id: string;
  version_id: string;
  values_json: string;
  values_hash: string;
  capacity: number;
  lifecycle: string;
}

interface TaxonomyRow extends Record<string, unknown> {
  ontology_id: string;
  taxonomy_id: string;
  version_id: string;
  applies_to_json: string;
  axis_ids_json: string;
  identity_axis_ids_json: string;
  space: string | null;
  lifecycle: string;
}

interface AllocationRow extends Record<string, unknown> {
  allocation_id: string;
  ontology_id: string;
  taxonomy_id: string;
  prefix: string;
  version_id: string;
  address_model: string;
  capacity: number;
  address_offset: number;
  address_size: number;
  status: string;
}

interface SegmentRow extends Record<string, unknown> {
  allocation_id: string;
  segment_id: string;
  consumes_json: string;
  address_offset: number;
  address_size: number;
}

async function insertNamespace(
  driver: SqlDriver,
  record: OntologyNamespaceRecord,
): Promise<void> {
  await driver.execute(
    `INSERT INTO ${TABLES.namespace}
       (ontology_id, namespace, owner, lifecycle, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      record.ontologyId,
      record.namespace,
      record.owner ?? null,
      record.lifecycle,
      record.createdAt,
      record.updatedAt,
    ],
  );
}

async function insertAxis(driver: SqlDriver, record: OntologyAxisRecord): Promise<void> {
  await driver.execute(
    `INSERT INTO ${TABLES.axis}
       (ontology_id, axis_id, version_id, values_json, values_hash, capacity, lifecycle)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      record.ontologyId,
      record.axisId,
      record.versionId,
      serializeStringArray(record.values),
      record.valuesHash,
      record.capacity,
      record.lifecycle,
    ],
  );
}

async function insertTaxonomy(
  driver: SqlDriver,
  record: OntologyTaxonomyRecord,
): Promise<void> {
  await driver.execute(
    `INSERT INTO ${TABLES.taxonomy}
       (ontology_id, taxonomy_id, version_id, applies_to_json,
        axis_ids_json, identity_axis_ids_json, space, lifecycle)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.ontologyId,
      record.taxonomyId,
      record.versionId,
      serializeStringArray(record.appliesTo),
      serializeStringArray(record.axisIds),
      serializeStringArray(record.identityAxisIds),
      record.space ?? null,
      record.lifecycle,
    ],
  );
}

async function insertAllocation(
  driver: SqlDriver,
  record: OntologyAddressAllocationRecord,
): Promise<void> {
  await driver.execute(
    `INSERT INTO ${TABLES.allocation}
       (allocation_id, ontology_id, taxonomy_id, prefix, version_id,
        address_model, capacity, address_offset, address_size, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.allocationId,
      record.ontologyId,
      record.taxonomyId,
      record.prefix,
      record.versionId,
      record.addressModel,
      record.capacity,
      record.addressOffset,
      record.addressSize,
      record.status,
    ],
  );
}

async function insertSegment(
  driver: SqlDriver,
  record: OntologyAddressSegmentRecord,
): Promise<void> {
  await driver.execute(
    `INSERT INTO ${TABLES.segment}
       (allocation_id, segment_id, consumes_json, address_offset, address_size)
     VALUES (?, ?, ?, ?, ?)`,
    [
      record.allocationId,
      record.segmentId,
      serializeStringArray(record.consumes),
      record.addressOffset,
      record.addressSize,
    ],
  );
}

function toNamespaceRecord(row: NamespaceRow): OntologyNamespaceRecord {
  return {
    ontologyId: row.ontology_id,
    namespace: row.namespace,
    owner: row.owner ?? undefined,
    lifecycle: row.lifecycle as OntologyNamespaceRecord["lifecycle"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAxisRecord(row: AxisRow): OntologyAxisRecord {
  return {
    ontologyId: row.ontology_id,
    axisId: row.axis_id,
    versionId: row.version_id,
    values: parseStringArray(row.values_json, "values_json"),
    valuesHash: row.values_hash,
    capacity: Number(row.capacity),
    lifecycle: row.lifecycle as OntologyAxisRecord["lifecycle"],
  };
}

function toTaxonomyRecord(row: TaxonomyRow): OntologyTaxonomyRecord {
  return {
    ontologyId: row.ontology_id,
    taxonomyId: row.taxonomy_id,
    versionId: row.version_id,
    appliesTo: parseStringArray(row.applies_to_json, "applies_to_json"),
    axisIds: parseStringArray(row.axis_ids_json, "axis_ids_json"),
    identityAxisIds: parseStringArray(
      row.identity_axis_ids_json,
      "identity_axis_ids_json",
    ),
    space: row.space ?? undefined,
    lifecycle: row.lifecycle as OntologyTaxonomyRecord["lifecycle"],
  };
}

function toAllocationRecord(row: AllocationRow): OntologyAddressAllocationRecord {
  return {
    allocationId: row.allocation_id,
    ontologyId: row.ontology_id,
    taxonomyId: row.taxonomy_id,
    prefix: row.prefix,
    versionId: row.version_id,
    addressModel: row.address_model as OntologyAddressAllocationRecord["addressModel"],
    capacity: Number(row.capacity),
    addressOffset: Number(row.address_offset),
    addressSize: Number(row.address_size),
    status: row.status as OntologyAddressAllocationRecord["status"],
  };
}

function toSegmentRecord(row: SegmentRow): OntologyAddressSegmentRecord {
  return {
    allocationId: row.allocation_id,
    segmentId: row.segment_id,
    consumes: parseStringArray(row.consumes_json, "consumes_json"),
    addressOffset: Number(row.address_offset),
    addressSize: Number(row.address_size),
  };
}

function serializeStringArray(values: readonly string[]): string {
  return JSON.stringify([...values]);
}

function parseStringArray(raw: string, columnName: string): string[] {
  const parsed = JSON.parse(raw) as unknown;
  if (
    !Array.isArray(parsed) ||
    parsed.some((value) => typeof value !== "string")
  ) {
    throw new Error(`Invalid ontology registry ${columnName}: expected string array JSON`);
  }
  return [...parsed];
}

function partialWriteRejected(
  conflicts: readonly OntologyRegistryValidationConflict[],
): OntologyRegistryStoreError {
  return new OntologyRegistryStoreError({
    code: "partial-write-rejected",
    message: `Ontology allocation plan write rejected with ${conflicts.length} conflict(s)`,
    conflicts,
  });
}

function isSqliteUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("UNIQUE constraint failed") ||
    message.includes("SQLITE_CONSTRAINT_UNIQUE") ||
    message.includes("SQLITE_CONSTRAINT_PRIMARYKEY")
  );
}

function fallbackDuplicateKeyConflict(
  error: unknown,
  writeSet: OntologyAllocationPlanWriteSet,
): OntologyRegistryDuplicateKeyConflict {
  const message = error instanceof Error ? error.message : String(error);
  const axis = writeSet.axes[0];
  const taxonomy = writeSet.taxonomies[0];
  const allocation = writeSet.allocations[0];
  const segment = writeSet.segments[0];

  if (message.includes(TABLES.axis) && axis) {
    return {
      code: "duplicate-key",
      message: `Duplicate axis record for ontologyId=${axis.ontologyId}, axisId=${axis.axisId}, versionId=${axis.versionId}`,
      key: {
        recordKind: "axis",
        ontologyId: axis.ontologyId,
        axisId: axis.axisId,
        versionId: axis.versionId,
      },
    };
  }

  if (message.includes(TABLES.taxonomy) && taxonomy) {
    return {
      code: "duplicate-key",
      message: `Duplicate taxonomy record for ontologyId=${taxonomy.ontologyId}, taxonomyId=${taxonomy.taxonomyId}, versionId=${taxonomy.versionId}`,
      key: {
        recordKind: "taxonomy",
        ontologyId: taxonomy.ontologyId,
        taxonomyId: taxonomy.taxonomyId,
        versionId: taxonomy.versionId,
      },
    };
  }

  if (message.includes(TABLES.allocation) && allocation) {
    if (message.includes("prefix")) {
      return {
        code: "duplicate-key",
        message: `Duplicate allocation record for prefix=${allocation.prefix}, versionId=${allocation.versionId}`,
        key: {
          recordKind: "allocation",
          prefix: allocation.prefix,
          versionId: allocation.versionId,
        },
      };
    }
    if (message.includes("ontology_id") || message.includes("taxonomy_id")) {
      return {
        code: "duplicate-key",
        message: `Duplicate allocation record for ontologyId=${allocation.ontologyId}, taxonomyId=${allocation.taxonomyId}, versionId=${allocation.versionId}`,
        key: {
          recordKind: "allocation",
          ontologyId: allocation.ontologyId,
          taxonomyId: allocation.taxonomyId,
          versionId: allocation.versionId,
        },
      };
    }
    return {
      code: "duplicate-key",
      message: `Duplicate allocation record for allocationId=${allocation.allocationId}`,
      key: {
        recordKind: "allocation",
        allocationId: allocation.allocationId,
      },
    };
  }

  if (message.includes(TABLES.segment) && segment) {
    return {
      code: "duplicate-key",
      message: `Duplicate segment record for allocationId=${segment.allocationId}, segmentId=${segment.segmentId}`,
      key: {
        recordKind: "segment",
        allocationId: segment.allocationId,
        segmentId: segment.segmentId,
      },
    };
  }

  if (message.includes(TABLES.namespace)) {
    if (message.includes("ontology_id")) {
      return {
        code: "duplicate-key",
        message: `Duplicate namespace record for ontologyId=${writeSet.namespace.ontologyId}`,
        key: {
          recordKind: "namespace",
          ontologyId: writeSet.namespace.ontologyId,
        },
      };
    }

    return {
      code: "duplicate-key",
      message: `Duplicate namespace record for namespace=${writeSet.namespace.namespace}`,
      key: {
        recordKind: "namespace",
        namespace: writeSet.namespace.namespace,
      },
    };
  }

  return {
    code: "duplicate-key",
    message: `Duplicate namespace record for ontologyId=${writeSet.namespace.ontologyId}`,
    key: {
      recordKind: "namespace",
      ontologyId: writeSet.namespace.ontologyId,
    },
  };
}
