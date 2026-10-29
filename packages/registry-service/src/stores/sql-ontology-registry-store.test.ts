// @def.boundary registry-system
// @def.doc registry-system

import { afterEach, describe, expect, it } from 'vitest';
import type { ExecuteResult, SqlDialect, SqlDriver } from 'index-meta-store';

import { createRegistryDatabaseDriver } from '../bootstrap/stores.js';
import { SqlOntologyRegistryStore } from './sql-ontology-registry-store.js';
import {
  OntologyRegistryStoreError,
  type OntologyAddressAllocationRecord,
  type OntologyAllocationPlanWriteSet,
  type OntologyRegistryStore,
  type OntologyRegistryStoreConflict,
} from './ontology-registry-store.js';
import {
  buildOntologyAddressAllocationRecord,
  buildOntologyAddressSegmentRecord,
  buildOntologyAxisRecord,
  buildOntologyNamespaceRecord,
  buildOntologyTaxonomyRecord,
} from './ontology-registry-validation.js';

type RegistrySqliteDriver = Awaited<ReturnType<typeof createRegistryDatabaseDriver>>;

const drivers: RegistrySqliteDriver[] = [];

afterEach(() => {
  while (drivers.length > 0) {
    drivers.pop()!.close();
  }
});

describe('SqlOntologyRegistryStore', () => {
  it('writes and reads namespaces, axes, taxonomies, allocations, active allocations, and segments', async () => {
    const driver = await createMigratedDb();
    const store = new SqlOntologyRegistryStore(driver);
    const writeSet = buildWriteSet();

    await store.writeAllocationPlan(writeSet);

    expect(await store.listNamespaces()).toEqual([writeSet.namespace]);
    expect(await store.getNamespace('ontology-a')).toEqual(writeSet.namespace);
    expect(await store.getNamespace('missing')).toBeNull();
    expect((await store.listAxes('ontology-a', 'v1')).map((axis) => axis.axisId)).toEqual([
      'env',
      'region',
    ]);
    expect(await store.getAxis('ontology-a', 'env', 'v1')).toEqual(writeSet.axes[1]);
    expect(
      (await store.listTaxonomies('ontology-a', 'v1')).map((taxonomy) => taxonomy.taxonomyId),
    ).toEqual(['deployment-surface', 'runtime-surface']);
    expect(await store.getTaxonomy('ontology-a', 'runtime-surface', 'v1')).toEqual(
      writeSet.taxonomies[0],
    );
    expect(
      (await store.listAllocations('ontology-a', 'v1')).map(
        (allocation) => allocation.allocationId,
      ),
    ).toEqual(['ontology-a:deployment-surface:v1', 'ontology-a:runtime-surface:v1']);
    expect(await store.getAllocation('ontology-a:deployment-surface:v1')).toEqual(
      writeSet.allocations[1],
    );
    expect(await store.getAllocation('missing')).toBeNull();
    expect(
      (await store.listActiveAllocations()).map((allocation) => allocation.allocationId),
    ).toEqual(['ontology-a:deployment-surface:v1']);
    expect(await store.listSegments('ontology-a:runtime-surface:v1')).toEqual([
      writeSet.segments[0],
    ]);
    expect(
      await store.getSegment(
        'ontology-a:runtime-surface:v1',
        'ontology-a:runtime-surface:v1:product',
      ),
    ).toEqual(writeSet.segments[0]);
    expect(await store.listSegments('missing')).toEqual([]);
  });

  it('serializes and deserializes json text columns explicitly', async () => {
    const driver = await createMigratedDb();
    const store = new SqlOntologyRegistryStore(driver);
    const writeSet = buildWriteSet();

    await store.writeAllocationPlan(writeSet);

    const axisRow = await driver.queryOne<{ values_json: string }>(
      'SELECT values_json FROM ontology_axis WHERE axis_id = ?',
      ['region'],
    );
    const taxonomyRow = await driver.queryOne<{
      applies_to_json: string;
      axis_ids_json: string;
      identity_axis_ids_json: string;
    }>(
      'SELECT applies_to_json, axis_ids_json, identity_axis_ids_json FROM ontology_taxonomy WHERE taxonomy_id = ?',
      ['runtime-surface'],
    );
    const segmentRow = await driver.queryOne<{ consumes_json: string }>(
      'SELECT consumes_json FROM ontology_address_segment WHERE segment_id = ?',
      ['ontology-a:runtime-surface:v1:product'],
    );

    expect(axisRow?.values_json).toBe(JSON.stringify(['us', 'eu']));
    expect(taxonomyRow?.applies_to_json).toBe(JSON.stringify(['service']));
    expect(taxonomyRow?.axis_ids_json).toBe(JSON.stringify(['region']));
    expect(taxonomyRow?.identity_axis_ids_json).toBe(JSON.stringify(['region']));
    expect(segmentRow?.consumes_json).toBe(JSON.stringify(['region']));
    expect((await store.listAxes('ontology-a', 'v1'))[0]?.values).toEqual(['prod', 'stage']);
  });

  it('rejects validation failures before writes and leaves no partial rows', async () => {
    const driver = await createMigratedDb();
    const store = new SqlOntologyRegistryStore(driver);
    const writeSet = buildWriteSet();

    const conflicts = await expectRejectedConflicts(
      store.writeAllocationPlan({
        ...writeSet,
        axes: [writeSet.axes[0]],
      }),
    );

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing-taxonomy-axis',
          ontologyId: 'ontology-a',
          taxonomyId: 'deployment-surface',
          versionId: 'v1',
          axisId: 'env',
        }),
      ]),
    );
    await expectEmptySqlTables(driver, store);
  });

  it('maps SQLite unique constraint failures to structured store conflicts', async () => {
    const driver = await createMigratedDb();
    const writeSet = buildWriteSet();
    const racingDriver = new RaceInsertDriver(driver, async () => {
      await driver.execute(
        `INSERT INTO ontology_namespace
           (ontology_id, namespace, owner, lifecycle, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          writeSet.namespace.ontologyId,
          writeSet.namespace.namespace,
          writeSet.namespace.owner ?? null,
          writeSet.namespace.lifecycle,
          writeSet.namespace.createdAt,
          writeSet.namespace.updatedAt,
        ],
      );
    });
    const store = new SqlOntologyRegistryStore(racingDriver);

    const conflicts = await expectRejectedConflicts(store.writeAllocationPlan(writeSet));

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'duplicate-key',
          key: {
            recordKind: 'namespace',
            ontologyId: 'ontology-a',
          },
        }),
      ]),
    );
  });
});

class RaceInsertDriver implements SqlDriver {
  readonly dialect: SqlDialect;
  private inserted = false;

  constructor(
    private readonly inner: SqlDriver,
    private readonly insertBeforeTransaction: () => Promise<void>,
  ) {
    this.dialect = inner.dialect;
  }

  async query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    return this.inner.query<T>(sql, params);
  }

  async queryOne<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T | null> {
    return this.inner.queryOne<T>(sql, params);
  }

  async execute(sql: string, params?: unknown[]): Promise<ExecuteResult> {
    return this.inner.execute(sql, params);
  }

  async transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T> {
    if (!this.inserted) {
      this.inserted = true;
      await this.insertBeforeTransaction();
    }
    return this.inner.transaction(fn);
  }

  async batchExecute(sql: string, paramsList: unknown[][]): Promise<void> {
    return this.inner.batchExecute(sql, paramsList);
  }
}

async function createMigratedDb(): Promise<RegistrySqliteDriver> {
  const driver = await createRegistryDatabaseDriver(':memory:');
  drivers.push(driver);
  return driver;
}

interface WriteSetOptions {
  readonly ontologyId?: string;
  readonly namespace?: string;
  readonly prefixSeed?: string;
  readonly versionId?: string;
}

function buildWriteSet(options: WriteSetOptions = {}): OntologyAllocationPlanWriteSet {
  const ontologyId = options.ontologyId ?? 'ontology-a';
  const namespace = options.namespace ?? 'qa.runtime';
  const prefixSeed = options.prefixSeed ?? 'qa';
  const versionId = options.versionId ?? 'v1';
  const runtimeAllocationId = `${ontologyId}:runtime-surface:${versionId}`;
  const deploymentAllocationId = `${ontologyId}:deployment-surface:${versionId}`;

  return {
    namespace: buildOntologyNamespaceRecord({
      ontologyId,
      namespace,
    }),
    axes: [
      buildOntologyAxisRecord({
        ontologyId,
        axisId: 'region',
        versionId,
        values: ['us', 'eu'],
        valuesHash: 'fnv1a32:region',
        capacity: 4,
      }),
      buildOntologyAxisRecord({
        ontologyId,
        axisId: 'env',
        versionId,
        values: ['prod', 'stage'],
        valuesHash: 'fnv1a32:env',
        capacity: 4,
      }),
    ],
    taxonomies: [
      buildOntologyTaxonomyRecord({
        ontologyId,
        taxonomyId: 'runtime-surface',
        versionId,
        appliesTo: ['service'],
        axisIds: ['region'],
        identityAxisIds: ['region'],
        space: 'runtime',
      }),
      buildOntologyTaxonomyRecord({
        ontologyId,
        taxonomyId: 'deployment-surface',
        versionId,
        appliesTo: ['deployment'],
        axisIds: ['env'],
        identityAxisIds: ['env'],
        space: 'deployment',
      }),
    ],
    allocations: [
      buildAllocation({
        allocationId: runtimeAllocationId,
        ontologyId,
        taxonomyId: 'runtime-surface',
        prefix: `${prefixSeed}_runtime_surface`,
        versionId,
        capacity: 16,
        addressOffset: 0,
        addressSize: 16,
        status: 'reserved',
      }),
      buildAllocation({
        allocationId: deploymentAllocationId,
        ontologyId,
        taxonomyId: 'deployment-surface',
        prefix: `${prefixSeed}_deployment_surface`,
        versionId,
        capacity: 8,
        addressOffset: 16,
        addressSize: 8,
        status: 'active',
      }),
    ],
    segments: [
      buildOntologyAddressSegmentRecord({
        allocationId: runtimeAllocationId,
        segmentId: `${runtimeAllocationId}:product`,
        consumes: ['region'],
        addressOffset: 0,
        addressSize: 16,
      }),
      buildOntologyAddressSegmentRecord({
        allocationId: deploymentAllocationId,
        segmentId: `${deploymentAllocationId}:product`,
        consumes: ['env'],
        addressOffset: 16,
        addressSize: 8,
      }),
    ],
  };
}

function buildAllocation(
  overrides: Partial<OntologyAddressAllocationRecord>,
): OntologyAddressAllocationRecord {
  return buildOntologyAddressAllocationRecord(overrides);
}

async function expectRejectedConflicts(
  write: Promise<void>,
): Promise<readonly Exclude<OntologyRegistryStoreConflict, { code: 'partial-write-rejected' }>[]> {
  let thrown: unknown;
  try {
    await write;
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(OntologyRegistryStoreError);
  const conflict = (thrown as OntologyRegistryStoreError).conflict;
  expect(conflict.code).toBe('partial-write-rejected');
  return conflict.code === 'partial-write-rejected' ? conflict.conflicts : [];
}

async function expectEmptySqlTables(
  driver: SqlDriver,
  store: OntologyRegistryStore,
): Promise<void> {
  expect(await store.listNamespaces()).toEqual([]);
  expect(await store.listAxes('ontology-a', 'v1')).toEqual([]);
  expect(await store.listTaxonomies('ontology-a', 'v1')).toEqual([]);
  expect(await store.listAllocations('ontology-a', 'v1')).toEqual([]);
  expect(await store.listActiveAllocations()).toEqual([]);
  expect(await store.listSegments('ontology-a:runtime-surface:v1')).toEqual([]);

  const counts = await Promise.all(
    [
      'ontology_namespace',
      'ontology_axis',
      'ontology_taxonomy',
      'ontology_address_allocation',
      'ontology_address_segment',
    ].map(async (tableName) => {
      const row = await driver.queryOne<{ count: number }>(
        `SELECT COUNT(*) AS count FROM ${tableName}`,
      );
      return row?.count ?? 0;
    }),
  );
  expect(counts).toEqual([0, 0, 0, 0, 0]);
}
