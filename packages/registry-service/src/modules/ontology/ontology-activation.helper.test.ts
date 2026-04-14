import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  InMemoryIndexMetaStore,
  InMemoryPrefixRegistry,
  SqlIndexMetaStore,
  SqlPrefixRegistry,
  type SqlDriver,
} from 'index-meta';
import { operationalOntologyAllocationPlane } from 'operational-ontology/allocation';
import { operationalOntologyPackPlane } from 'operational-ontology/pack';
import type { OperationalOntologyPack } from 'operational-ontology/pack';
import { createRegistryDatabaseDriver } from '../../bootstrap/stores.js';
import { InMemoryOntologyRegistryStore } from '../../stores/in-memory-ontology-registry-store.js';
import { SqlOntologyRegistryStore } from '../../stores/sql-ontology-registry-store.js';
import type {
  OntologyAddressAllocationRecord,
  OntologyNamespaceRecord,
  OntologyRegistryStore,
} from '../../stores/ontology-registry-store.js';
import {
  createOntologyIndexMetaSyncAdapter,
  type OntologyIndexMetaSyncReport,
} from './index-meta-sync.adapter.js';
import {
  activateOntologyPack,
  OntologyPackActivationHelper,
  type OntologyPackActivationRegistryServicePort,
} from './ontology-activation.helper.js';
import { OntologyRegistryService } from './ontology-registry.service.js';

const validPack = {
  packId: 'authorization-ontology',
  schema: {
    axes: [{ id: 'resource_kind', values: ['service', 'route'], capacity: 8 }],
    taxonomies: [
      {
        id: 'authorization-resource',
        appliesTo: ['node'],
        axisIds: ['resource_kind'],
        identityAxisIds: ['resource_kind'],
        space: 'authorization',
      },
    ],
    relationCategories: [],
  },
} satisfies OperationalOntologyPack;

const multiAllocationPack = {
  packId: 'authorization-ontology',
  schema: {
    axes: [
      { id: 'resource_kind', values: ['service', 'route'], capacity: 8 },
      { id: 'decision_kind', values: ['allow', 'deny'], capacity: 4 },
    ],
    taxonomies: [
      {
        id: 'authorization-resource',
        appliesTo: ['node'],
        axisIds: ['resource_kind'],
        identityAxisIds: ['resource_kind'],
        space: 'authorization',
      },
      {
        id: 'authorization-decision',
        appliesTo: ['node'],
        axisIds: ['decision_kind'],
        identityAxisIds: ['decision_kind'],
        space: 'authorization',
      },
    ],
    relationCategories: [],
  },
} satisfies OperationalOntologyPack;

const invalidPack = {
  packId: 'broken-pack',
  schema: {
    axes: [{ id: 'resource_kind', values: ['service', 'service'] }],
    taxonomies: [],
    relationCategories: [],
  },
} satisfies OperationalOntologyPack;

interface ActivationBackendContext {
  readonly store: OntologyRegistryStore;
  readonly prefixRegistry: InMemoryPrefixRegistry | SqlPrefixRegistry;
  readonly schemaVersionStore: InMemoryIndexMetaStore | SqlIndexMetaStore;
  readonly cleanup?: () => void | Promise<void>;
  readonly assertNoBackendRows?: () => Promise<void>;
}

interface ActivationBackendCase {
  readonly name: string;
  readonly create: () => Promise<ActivationBackendContext>;
}

const activeBackends: ActivationBackendContext[] = [];

const activationBackendCases = [
  {
    name: 'in-memory stores',
    create: async () => ({
      store: new InMemoryOntologyRegistryStore(),
      prefixRegistry: new InMemoryPrefixRegistry(),
      schemaVersionStore: new InMemoryIndexMetaStore(),
    }),
  },
  {
    name: 'SQL-backed stores',
    create: async () => {
      const driver = await createRegistryDatabaseDriver(':memory:');
      return {
        store: new SqlOntologyRegistryStore(driver),
        prefixRegistry: new SqlPrefixRegistry(driver),
        schemaVersionStore: new SqlIndexMetaStore(driver),
        cleanup: () => driver.close(),
        assertNoBackendRows: () => expectNoSqlRegistryOrIndexMetaRows(driver),
      };
    },
  },
] satisfies readonly ActivationBackendCase[];

describe('OntologyPackActivationHelper', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    while (activeBackends.length > 0) {
      await activeBackends.pop()?.cleanup?.();
    }
  });

  it('orchestrates activation through the ontology registry service port', async () => {
    const namespace = namespaceRecord();
    const allocation = allocationRecord({ status: 'reserved' });
    const syncReport = syncedReport(allocation);
    const registryService = {
      registerOntologyPack: vi.fn(async () => ({
        packId: 'authorization-ontology',
        ontologyId: 'authz-runtime',
        validation: operationalOntologyPackPlane.validateOperationalOntologyPack(validPack),
        allocationValidation: { valid: true, issues: [] },
        plan: {
          namespace,
          axes: [],
          taxonomies: [],
          allocations: [allocation],
          segments: [],
          validation: { valid: true, issues: [] },
        },
        allocations: [allocation],
      })),
      activateAllocation: vi.fn(async () => ({
        allocation: allocationRecord({ status: 'active' }),
      })),
      syncToPrefixRegistry: vi.fn(async () => syncReport),
    } satisfies OntologyPackActivationRegistryServicePort;

    const result = await activateOntologyPack(registryService, validPack, {
      ontologyId: 'authz-runtime',
      namespace: 'authz',
      owner: 'registry-service',
      versionId: 'v2',
      addressModel: 'sum',
      capacityByAxisId: { resource_kind: 16 },
      capacityByTaxonomyId: { 'authorization-resource': 16 },
      prefixByTaxonomyId: {
        'authorization-resource': 'authz_runtime_resource',
      },
      timestamp: '2026-04-14T00:00:00.000Z',
    });

    expect(registryService.registerOntologyPack).toHaveBeenCalledWith({
      pack: validPack,
      options: {
        ontologyId: 'authz-runtime',
        namespace: 'authz',
        owner: 'registry-service',
        versionId: 'v2',
        now: '2026-04-14T00:00:00.000Z',
        addressModel: 'sum',
        capacityByAxisId: { resource_kind: 16 },
        capacityByTaxonomyId: { 'authorization-resource': 16 },
        prefixByTaxonomyId: {
          'authorization-resource': 'authz_runtime_resource',
        },
      },
    });
    expect(registryService.activateAllocation).toHaveBeenCalledWith({
      allocationId: 'authz-runtime:authorization-resource:v2',
    });
    expect(registryService.syncToPrefixRegistry).toHaveBeenCalledWith({
      allocationId: 'authz-runtime:authorization-resource:v2',
    });
    expect(result).toEqual(
      expect.objectContaining({
        status: 'succeeded',
        packId: 'authorization-ontology',
        ontologyId: 'authz-runtime',
        namespaceRecord: namespace,
        allocations: [allocationRecord({ status: 'active' })],
        activationStatuses: [
          {
            allocationId: 'authz-runtime:authorization-resource:v2',
            taxonomyId: 'authorization-resource',
            prefix: 'authz_runtime_resource',
            versionId: 'v2',
            status: 'active',
            activationStatus: 'active',
            syncStatus: 'synced',
          },
        ],
        syncReports: [syncReport],
        smokeChecks: [
          expect.objectContaining({
            allocationId: 'authz-runtime:authorization-resource:v2',
            taxonomyId: 'authorization-resource',
            prefix: 'authz_runtime_resource',
            versionId: 'v2',
            addressModel: 'sum',
            kind: 'sum',
            syncStatus: 'synced',
            passed: true,
            checks: [
              expect.objectContaining({
                name: 'source-allocation-active',
                passed: true,
              }),
              expect.objectContaining({
                name: 'sum-prefix-leaf-record-exists',
                passed: true,
              }),
              expect.objectContaining({
                name: 'schema-version-capacity-matches-sum-allocation',
                passed: true,
              }),
              expect.objectContaining({
                name: 'sum-segment-sidecar-covers-allocation-range',
                passed: true,
              }),
            ],
          }),
        ],
        warnings: [],
        errors: [],
      }),
    );
  });

  it('validates, reserves, activates, and syncs every allocation from a valid pack', async () => {
    const store = new InMemoryOntologyRegistryStore();
    const prefixRegistry = new InMemoryPrefixRegistry();
    const schemaVersionStore = new InMemoryIndexMetaStore();
    const validatePack = vi.spyOn(operationalOntologyPackPlane, 'validateOperationalOntologyPack');
    const allocate = vi.spyOn(operationalOntologyAllocationPlane, 'allocateOntologyAddressSpace');
    const syncAdapter = createOntologyIndexMetaSyncAdapter({
      prefixRegistry,
      schemaVersionStore,
    });
    const sync = vi.spyOn(syncAdapter, 'sync');
    const service = new OntologyRegistryService({
      store,
      syncAdapter,
    });
    const helper = new OntologyPackActivationHelper(service);

    const result = await helper.activateOntologyPack(multiAllocationPack, {
      ontologyId: 'authz-runtime',
      namespace: 'authz',
      owner: 'registry-service',
      versionId: 'v2',
      timestamp: '2026-04-14T00:00:00.000Z',
    });

    const [validationCallOrder] = validatePack.mock.invocationCallOrder;
    const [allocationCallOrder] = allocate.mock.invocationCallOrder;
    if (validationCallOrder === undefined || allocationCallOrder === undefined) {
      throw new Error('expected validation and allocation calls to be recorded');
    }
    expect(validationCallOrder).toBeLessThan(allocationCallOrder);
    expect(result.status).toBe('succeeded');
    expect(result.namespaceRecord).toEqual({
      ontologyId: 'authz-runtime',
      namespace: 'authz',
      owner: 'registry-service',
      lifecycle: 'draft',
      createdAt: '2026-04-14T00:00:00.000Z',
      updatedAt: '2026-04-14T00:00:00.000Z',
    });
    expect(await store.listAxes('authz-runtime', 'v2')).toEqual([
      expect.objectContaining({
        axisId: 'decision_kind',
        values: ['allow', 'deny'],
        capacity: 4,
      }),
      expect.objectContaining({
        axisId: 'resource_kind',
        values: ['service', 'route'],
        capacity: 8,
      }),
    ]);
    expect(
      (await store.listTaxonomies('authz-runtime', 'v2')).map((taxonomy) => taxonomy.taxonomyId),
    ).toEqual(['authorization-decision', 'authorization-resource']);
    expect(await store.listAllocations('authz-runtime', 'v2')).toEqual([
      expect.objectContaining({
        allocationId: 'authz-runtime:authorization-decision:v2',
        prefix: 'authz_authorization_decision',
        versionId: 'v2',
        status: 'active',
      }),
      expect.objectContaining({
        allocationId: 'authz-runtime:authorization-resource:v2',
        prefix: 'authz_authorization_resource',
        versionId: 'v2',
        status: 'active',
      }),
    ]);
    expect(await store.listSegments('authz-runtime:authorization-resource:v2')).toEqual([
      expect.objectContaining({
        allocationId: 'authz-runtime:authorization-resource:v2',
        segmentId: 'authz-runtime:authorization-resource:v2:product',
        consumes: ['resource_kind'],
      }),
    ]);
    expect(await store.listSegments('authz-runtime:authorization-decision:v2')).toEqual([
      expect.objectContaining({
        allocationId: 'authz-runtime:authorization-decision:v2',
        segmentId: 'authz-runtime:authorization-decision:v2:product',
        consumes: ['decision_kind'],
      }),
    ]);
    expect(result.activationStatuses).toEqual([
      {
        allocationId: 'authz-runtime:authorization-resource:v2',
        taxonomyId: 'authorization-resource',
        prefix: 'authz_authorization_resource',
        versionId: 'v2',
        status: 'active',
        activationStatus: 'active',
        syncStatus: 'synced',
      },
      {
        allocationId: 'authz-runtime:authorization-decision:v2',
        taxonomyId: 'authorization-decision',
        prefix: 'authz_authorization_decision',
        versionId: 'v2',
        status: 'active',
        activationStatus: 'active',
        syncStatus: 'synced',
      },
    ]);
    expect(result.syncReports.map((report) => report.allocationId)).toEqual([
      'authz-runtime:authorization-resource:v2',
      'authz-runtime:authorization-decision:v2',
    ]);
    expect(result.syncReports.map((report) => report.syncStatus)).toEqual(['synced', 'synced']);
    expect(result.smokeChecks).toEqual([
      expect.objectContaining({
        allocationId: 'authz-runtime:authorization-resource:v2',
        taxonomyId: 'authorization-resource',
        prefix: 'authz_authorization_resource',
        versionId: 'v2',
        addressModel: 'product',
        kind: 'product',
        syncStatus: 'synced',
        passed: true,
        checks: expect.arrayContaining([
          expect.objectContaining({
            name: 'source-allocation-active',
            passed: true,
          }),
          expect.objectContaining({
            name: 'product-prefix-record-matches',
            passed: true,
          }),
          expect.objectContaining({
            name: 'schema-version-capacity-matches-prefix-registry',
            passed: true,
          }),
          expect.objectContaining({
            name: 'product-shape-matches-ordered-axis-capacities',
            passed: true,
          }),
          expect.objectContaining({
            name: 'last-valid-address-in-range',
            passed: true,
          }),
          expect.objectContaining({
            name: 'capacity-address-out-of-range',
            passed: true,
          }),
        ]),
      }),
      expect.objectContaining({
        allocationId: 'authz-runtime:authorization-decision:v2',
        taxonomyId: 'authorization-decision',
        prefix: 'authz_authorization_decision',
        versionId: 'v2',
        addressModel: 'product',
        kind: 'product',
        syncStatus: 'synced',
        passed: true,
      }),
    ]);
    expect(result.smokeChecks.flatMap((check) => check.checks)).toHaveLength(12);
    expect(sync).toHaveBeenCalledTimes(2);
    expect(sync.mock.calls.map(([bundle]) => bundle.allocation.allocationId)).toEqual([
      'authz-runtime:authorization-resource:v2',
      'authz-runtime:authorization-decision:v2',
    ]);
    await expect(prefixRegistry.getRecord('authz_authorization_resource', 'v2')).resolves.toEqual(
      expect.objectContaining({
        prefix: 'authz_authorization_resource',
        versionId: 'v2',
        capacity: 8,
      }),
    );
    await expect(
      schemaVersionStore.getSchemaVersion('authz_authorization_resource', 'v2'),
    ).resolves.toEqual(
      expect.objectContaining({
        prefix: 'authz_authorization_resource',
        versionId: 'v2',
        capacity: 8,
      }),
    );
    await expect(prefixRegistry.getRecord('authz_authorization_decision', 'v2')).resolves.toEqual(
      expect.objectContaining({
        prefix: 'authz_authorization_decision',
        versionId: 'v2',
        capacity: 4,
      }),
    );
    await expect(
      schemaVersionStore.getSchemaVersion('authz_authorization_decision', 'v2'),
    ).resolves.toEqual(
      expect.objectContaining({
        prefix: 'authz_authorization_decision',
        versionId: 'v2',
        capacity: 4,
      }),
    );
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('activates a pack and returns namespace, allocation, sync, warning, and error payload fields', async () => {
    const store = new InMemoryOntologyRegistryStore();
    const prefixRegistry = new InMemoryPrefixRegistry();
    const schemaVersionStore = new InMemoryIndexMetaStore();
    const service = new OntologyRegistryService({
      store,
      syncAdapter: createOntologyIndexMetaSyncAdapter({
        prefixRegistry,
        schemaVersionStore,
      }),
    });
    const helper = new OntologyPackActivationHelper(service);

    const result = await helper.activateOntologyPack(validPack, {
      ontologyId: 'authz-runtime',
      namespace: 'authz',
      owner: 'registry-service',
      versionId: 'v2',
      addressModel: 'sum',
      capacityByAxisId: { resource_kind: 16 },
      prefixByTaxonomyId: {
        'authorization-resource': 'authz_runtime_resource',
      },
      timestamp: '2026-04-14T00:00:00.000Z',
    });

    expect(result.status).toBe('succeeded');
    expect(result.namespaceRecord).toEqual({
      ontologyId: 'authz-runtime',
      namespace: 'authz',
      owner: 'registry-service',
      lifecycle: 'draft',
      createdAt: '2026-04-14T00:00:00.000Z',
      updatedAt: '2026-04-14T00:00:00.000Z',
    });
    expect(result.allocations).toEqual([
      expect.objectContaining({
        allocationId: 'authz-runtime:authorization-resource:v2',
        prefix: 'authz_runtime_resource',
        versionId: 'v2',
        addressModel: 'sum',
        capacity: 16,
        status: 'active',
      }),
    ]);
    expect(result.activationStatuses).toEqual([
      expect.objectContaining({
        allocationId: 'authz-runtime:authorization-resource:v2',
        status: 'active',
        activationStatus: 'active',
        syncStatus: 'synced',
      }),
    ]);
    expect(result.syncReports).toHaveLength(1);
    expect(result.syncReports[0]).toEqual(
      expect.objectContaining({
        allocationId: 'authz-runtime:authorization-resource:v2',
        prefix: 'authz_runtime_resource',
        versionId: 'v2',
        syncStatus: 'synced',
      }),
    );
    expect(result.smokeChecks).toEqual([
      expect.objectContaining({
        allocationId: 'authz-runtime:authorization-resource:v2',
        taxonomyId: 'authorization-resource',
        prefix: 'authz_runtime_resource',
        versionId: 'v2',
        addressModel: 'sum',
        kind: 'sum',
        syncStatus: 'synced',
        passed: true,
      }),
    ]);
    expect(result.smokeChecks[0]?.checks.map((check) => check.name)).toEqual([
      'source-allocation-active',
      'sum-prefix-leaf-record-exists',
      'schema-version-capacity-matches-sum-allocation',
      'sum-segment-sidecar-covers-allocation-range',
    ]);
    expect(result.smokeChecks[0]?.checks.map((check) => check.name)).not.toContain(
      'product-shape-matches-ordered-axis-capacities',
    );
    expect(result.smokeChecks[0]?.checks[3]).toEqual(
      expect.objectContaining({
        name: 'sum-segment-sidecar-covers-allocation-range',
        passed: true,
        details: expect.objectContaining({
          coveragePolicy: 'exact-allocation-range',
          allocationStart: 0,
          allocationEnd: 16,
          coveredSize: 16,
          segmentSidecarCoversAllocation: true,
          segments: [
            {
              segmentId: 'authz-runtime:authorization-resource:v2:resource_kind',
              consumes: ['resource_kind'],
              addressOffset: 0,
              addressSize: 16,
            },
          ],
        }),
      }),
    );
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
    await expect(prefixRegistry.getRecord('authz_runtime_resource', 'v2')).resolves.toEqual(
      expect.objectContaining({
        prefix: 'authz_runtime_resource',
        versionId: 'v2',
        capacity: 16,
      }),
    );
  });

  describe.each(activationBackendCases)(
    'invalid activation no-write with $name',
    ({ create }) => {
      async function setup(): Promise<ActivationBackendContext> {
        const context = await create();
        activeBackends.push(context);
        return context;
      }

      it('returns a structured invalid-pack error and leaves no registry or index-meta rows', async () => {
        const context = await setup();
        const service = new OntologyRegistryService({
          store: context.store,
          syncAdapter: createOntologyIndexMetaSyncAdapter({
            prefixRegistry: context.prefixRegistry,
            schemaVersionStore: context.schemaVersionStore,
          }),
        });
        const helper = new OntologyPackActivationHelper(service);
        const write = vi.spyOn(context.store, 'writeAllocationPlan');
        const prefixRegister = vi.spyOn(context.prefixRegistry, 'register');
        const schemaVersionInsert = vi.spyOn(
          context.schemaVersionStore,
          'insertSchemaVersion',
        );

        const result = await helper.activateOntologyPack(invalidPack, {
          ontologyId: 'broken-runtime',
          namespace: 'broken',
          versionId: 'v2',
        });

        expect(result).toEqual(
          expect.objectContaining({
            status: 'failed',
            packId: 'broken-pack',
            ontologyId: 'broken-runtime',
            namespaceRecord: null,
            allocations: [],
            activationStatuses: [],
            syncReports: [],
            smokeChecks: [],
            warnings: [],
            errors: [
              expect.objectContaining({
                level: 'error',
                phase: 'register',
                code: 'invalid-pack',
                details: expect.objectContaining({
                  code: 'invalid-pack',
                  packId: 'broken-pack',
                  issues: expect.arrayContaining([
                    expect.objectContaining({ code: 'axis-values-duplicate' }),
                  ]),
                }),
              }),
            ],
          }),
        );
        expect(write).not.toHaveBeenCalled();
        expect(prefixRegister).not.toHaveBeenCalled();
        expect(schemaVersionInsert).not.toHaveBeenCalled();
        await expectActivationStoresEmpty(context, {
          ontologyId: 'broken-runtime',
          versionId: 'v2',
          allocationIds: [],
          indexMetaTargets: [
            { prefix: 'broken_axis_resource_kind', versionId: 'v2' },
            { prefix: 'broken_authorization_resource', versionId: 'v2' },
          ],
        });
      });

      it('returns a structured invalid-allocation-plan error and leaves no registry or index-meta rows', async () => {
        const context = await setup();
        const service = new OntologyRegistryService({
          store: context.store,
          syncAdapter: createOntologyIndexMetaSyncAdapter({
            prefixRegistry: context.prefixRegistry,
            schemaVersionStore: context.schemaVersionStore,
          }),
        });
        const helper = new OntologyPackActivationHelper(service);
        const write = vi.spyOn(context.store, 'writeAllocationPlan');
        const prefixRegister = vi.spyOn(context.prefixRegistry, 'register');
        const schemaVersionInsert = vi.spyOn(
          context.schemaVersionStore,
          'insertSchemaVersion',
        );

        const result = await helper.activateOntologyPack(multiAllocationPack, {
          ontologyId: 'authz-runtime',
          namespace: 'authz',
          owner: 'registry-service',
          versionId: 'v2',
          prefixByTaxonomyId: {
            'authorization-resource': 'authz_shared',
            'authorization-decision': 'authz_shared',
          },
          timestamp: '2026-04-14T00:00:00.000Z',
        });

        expect(result).toEqual(
          expect.objectContaining({
            status: 'failed',
            packId: 'authorization-ontology',
            ontologyId: 'authz-runtime',
            namespaceRecord: null,
            allocations: [],
            activationStatuses: [],
            syncReports: [],
            smokeChecks: [],
            warnings: [],
            errors: [
              expect.objectContaining({
                level: 'error',
                phase: 'register',
                code: 'invalid-allocation-plan',
                details: expect.objectContaining({
                  code: 'invalid-allocation-plan',
                  packId: 'authorization-ontology',
                  issues: expect.arrayContaining([
                    expect.objectContaining({ code: 'ontology-prefix-version-duplicate' }),
                  ]),
                }),
              }),
            ],
          }),
        );
        expect(write).not.toHaveBeenCalled();
        expect(prefixRegister).not.toHaveBeenCalled();
        expect(schemaVersionInsert).not.toHaveBeenCalled();
        await expectActivationStoresEmpty(context, {
          ontologyId: 'authz-runtime',
          versionId: 'v2',
          allocationIds: [
            'authz-runtime:authorization-resource:v2',
            'authz-runtime:authorization-decision:v2',
          ],
          indexMetaTargets: [
            { prefix: 'authz_axis_resource_kind', versionId: 'v2' },
            { prefix: 'authz_axis_decision_kind', versionId: 'v2' },
            { prefix: 'authz_shared', versionId: 'v2' },
          ],
        });
      });
    },
  );
});

async function expectActivationStoresEmpty(
  context: ActivationBackendContext,
  input: {
    readonly ontologyId: string;
    readonly versionId: string;
    readonly allocationIds: readonly string[];
    readonly indexMetaTargets: readonly { prefix: string; versionId: string }[];
  },
): Promise<void> {
  expect(await context.store.listNamespaces()).toEqual([]);
  expect(await context.store.getNamespace(input.ontologyId)).toBeNull();
  expect(await context.store.listAxes(input.ontologyId, input.versionId)).toEqual([]);
  expect(await context.store.listTaxonomies(input.ontologyId, input.versionId)).toEqual([]);
  expect(await context.store.listAllocations(input.ontologyId, input.versionId)).toEqual([]);
  expect(await context.store.listActiveAllocations()).toEqual([]);
  for (const allocationId of input.allocationIds) {
    expect(await context.store.getAllocation(allocationId)).toBeNull();
    expect(await context.store.listSegments(allocationId)).toEqual([]);
  }

  expect(await context.prefixRegistry.listAll()).toEqual([]);
  for (const target of input.indexMetaTargets) {
    expect(
      await context.schemaVersionStore.getSchemaVersion(target.prefix, target.versionId),
    ).toBeNull();
  }
  await context.assertNoBackendRows?.();
}

async function expectNoSqlRegistryOrIndexMetaRows(driver: SqlDriver): Promise<void> {
  const tableNames = [
    'ontology_namespace',
    'ontology_axis',
    'ontology_taxonomy',
    'ontology_address_allocation',
    'ontology_address_segment',
    'prefix_registry',
    'prefix_ref',
    'schema_version',
  ];
  const counts = await Promise.all(
    tableNames.map(async (tableName) => {
      const row = await driver.queryOne<{ count: number }>(
        `SELECT COUNT(*) AS count FROM ${tableName}`,
      );
      return row?.count ?? 0;
    }),
  );
  expect(counts).toEqual(tableNames.map(() => 0));
}

function namespaceRecord(): OntologyNamespaceRecord {
  return {
    ontologyId: 'authz-runtime',
    namespace: 'authz',
    owner: 'registry-service',
    lifecycle: 'draft',
    createdAt: '2026-04-14T00:00:00.000Z',
    updatedAt: '2026-04-14T00:00:00.000Z',
  };
}

function allocationRecord(input: {
  readonly status: OntologyAddressAllocationRecord['status'];
}): OntologyAddressAllocationRecord {
  return {
    allocationId: 'authz-runtime:authorization-resource:v2',
    ontologyId: 'authz-runtime',
    taxonomyId: 'authorization-resource',
    prefix: 'authz_runtime_resource',
    versionId: 'v2',
    addressModel: 'sum',
    capacity: 16,
    addressOffset: 0,
    addressSize: 16,
    status: input.status,
  };
}

function syncedReport(allocation: OntologyAddressAllocationRecord): OntologyIndexMetaSyncReport {
  return {
    allocationId: allocation.allocationId,
    prefix: allocation.prefix,
    versionId: allocation.versionId,
    taxonomyId: allocation.taxonomyId,
    status: 'active',
    syncStatus: 'synced',
    materializedRecords: [],
    idempotentRecords: [],
    repairedRecords: [],
    collisions: [],
    deferredSemantics: [
      {
        code: 'sum-segment-prefix-ref-unsupported',
        message:
          'Sum allocation "authz-runtime:authorization-resource:v2" is materialized as a leaf prefix; segment ranges are report sidecars until index-meta owns a segment model',
        coveragePolicy: 'exact-allocation-range',
        segments: [
          {
            segmentId: 'authz-runtime:authorization-resource:v2:resource_kind',
            consumes: ['resource_kind'],
            addressOffset: 0,
            addressSize: allocation.capacity,
          },
        ],
      },
    ],
    postSyncChecks: {
      targetRecords: [
        {
          role: 'allocation-prefix',
          prefix: allocation.prefix,
          versionId: allocation.versionId,
          expectedCapacity: allocation.capacity,
          prefixRegistryRecordExists: true,
          prefixRegistryRecordMatchesIntended: true,
          prefixRegistryCapacityMatches: true,
          prefixRegistryRefsMatch: true,
          schemaVersionCapacityExists: true,
          schemaVersionCapacityMatches: true,
          prefixRegistryCapacity: allocation.capacity,
          schemaVersionCapacity: allocation.capacity,
        },
      ],
      sumAllocation: {
        prefix: allocation.prefix,
        versionId: allocation.versionId,
        coveragePolicy: 'exact-allocation-range',
        segmentSidecarCoversAllocation: true,
        allocationStart: 0,
        allocationEnd: allocation.capacity,
        coveredSize: allocation.capacity,
        segments: [
          {
            segmentId: 'authz-runtime:authorization-resource:v2:resource_kind',
            consumes: ['resource_kind'],
            addressOffset: 0,
            addressSize: allocation.capacity,
          },
        ],
      },
    },
  };
}
