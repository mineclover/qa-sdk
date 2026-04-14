import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryIndexMetaStore, InMemoryPrefixRegistry } from "index-meta";
import { operationalOntologyAllocationPlane } from "operational-ontology/allocation";
import { operationalOntologyPackPlane } from "operational-ontology/pack";
import type { OperationalOntologyPack } from "operational-ontology/pack";
import { InMemoryOntologyRegistryStore } from "../../stores/in-memory-ontology-registry-store.js";
import type {
  OntologyAddressAllocationRecord,
  OntologyNamespaceRecord,
} from "../../stores/ontology-registry-store.js";
import {
  createOntologyIndexMetaSyncAdapter,
  type OntologyIndexMetaSyncReport,
} from "./index-meta-sync.adapter.js";
import {
  activateOntologyPack,
  OntologyPackActivationHelper,
  type OntologyPackActivationRegistryServicePort,
} from "./ontology-activation.helper.js";
import { OntologyRegistryService } from "./ontology-registry.service.js";

const validPack = {
  packId: "authorization-ontology",
  schema: {
    axes: [
      { id: "resource_kind", values: ["service", "route"], capacity: 8 },
    ],
    taxonomies: [
      {
        id: "authorization-resource",
        appliesTo: ["node"],
        axisIds: ["resource_kind"],
        identityAxisIds: ["resource_kind"],
        space: "authorization",
      },
    ],
    relationCategories: [],
  },
} satisfies OperationalOntologyPack;

const multiAllocationPack = {
  packId: "authorization-ontology",
  schema: {
    axes: [
      { id: "resource_kind", values: ["service", "route"], capacity: 8 },
      { id: "decision_kind", values: ["allow", "deny"], capacity: 4 },
    ],
    taxonomies: [
      {
        id: "authorization-resource",
        appliesTo: ["node"],
        axisIds: ["resource_kind"],
        identityAxisIds: ["resource_kind"],
        space: "authorization",
      },
      {
        id: "authorization-decision",
        appliesTo: ["node"],
        axisIds: ["decision_kind"],
        identityAxisIds: ["decision_kind"],
        space: "authorization",
      },
    ],
    relationCategories: [],
  },
} satisfies OperationalOntologyPack;

describe("OntologyPackActivationHelper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("orchestrates activation through the ontology registry service port", async () => {
    const namespace = namespaceRecord();
    const allocation = allocationRecord({ status: "reserved" });
    const syncReport = syncedReport(allocation);
    const registryService = {
      registerOntologyPack: vi.fn(async () => ({
        packId: "authorization-ontology",
        ontologyId: "authz-runtime",
        validation:
          operationalOntologyPackPlane.validateOperationalOntologyPack(validPack),
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
        allocation: allocationRecord({ status: "active" }),
      })),
      syncToPrefixRegistry: vi.fn(async () => syncReport),
    } satisfies OntologyPackActivationRegistryServicePort;

    const result = await activateOntologyPack(registryService, validPack, {
      ontologyId: "authz-runtime",
      namespace: "authz",
      owner: "registry-service",
      versionId: "v2",
      addressModel: "sum",
      capacityByAxisId: { resource_kind: 16 },
      capacityByTaxonomyId: { "authorization-resource": 16 },
      prefixByTaxonomyId: {
        "authorization-resource": "authz_runtime_resource",
      },
      timestamp: "2026-04-14T00:00:00.000Z",
    });

    expect(registryService.registerOntologyPack).toHaveBeenCalledWith({
      pack: validPack,
      options: {
        ontologyId: "authz-runtime",
        namespace: "authz",
        owner: "registry-service",
        versionId: "v2",
        now: "2026-04-14T00:00:00.000Z",
        addressModel: "sum",
        capacityByAxisId: { resource_kind: 16 },
        capacityByTaxonomyId: { "authorization-resource": 16 },
        prefixByTaxonomyId: {
          "authorization-resource": "authz_runtime_resource",
        },
      },
    });
    expect(registryService.activateAllocation).toHaveBeenCalledWith({
      allocationId: "authz-runtime:authorization-resource:v2",
    });
    expect(registryService.syncToPrefixRegistry).toHaveBeenCalledWith({
      allocationId: "authz-runtime:authorization-resource:v2",
    });
    expect(result).toEqual(
      expect.objectContaining({
        status: "succeeded",
        packId: "authorization-ontology",
        ontologyId: "authz-runtime",
        namespaceRecord: namespace,
        allocations: [allocationRecord({ status: "active" })],
        activationStatuses: [
          {
            allocationId: "authz-runtime:authorization-resource:v2",
            taxonomyId: "authorization-resource",
            prefix: "authz_runtime_resource",
            versionId: "v2",
            status: "active",
            activationStatus: "active",
            syncStatus: "synced",
          },
        ],
        syncReports: [syncReport],
        smokeChecks: [],
        warnings: [],
        errors: [],
      }),
    );
  });

  it("validates, reserves, activates, and syncs every allocation from a valid pack", async () => {
    const store = new InMemoryOntologyRegistryStore();
    const prefixRegistry = new InMemoryPrefixRegistry();
    const schemaVersionStore = new InMemoryIndexMetaStore();
    const validatePack = vi.spyOn(
      operationalOntologyPackPlane,
      "validateOperationalOntologyPack",
    );
    const allocate = vi.spyOn(
      operationalOntologyAllocationPlane,
      "allocateOntologyAddressSpace",
    );
    const syncAdapter = createOntologyIndexMetaSyncAdapter({
      prefixRegistry,
      schemaVersionStore,
    });
    const sync = vi.spyOn(syncAdapter, "sync");
    const service = new OntologyRegistryService({
      store,
      syncAdapter,
    });
    const helper = new OntologyPackActivationHelper(service);

    const result = await helper.activateOntologyPack(multiAllocationPack, {
      ontologyId: "authz-runtime",
      namespace: "authz",
      owner: "registry-service",
      versionId: "v2",
      timestamp: "2026-04-14T00:00:00.000Z",
    });

    const [validationCallOrder] = validatePack.mock.invocationCallOrder;
    const [allocationCallOrder] = allocate.mock.invocationCallOrder;
    if (validationCallOrder === undefined || allocationCallOrder === undefined) {
      throw new Error("expected validation and allocation calls to be recorded");
    }
    expect(validationCallOrder).toBeLessThan(allocationCallOrder);
    expect(result.status).toBe("succeeded");
    expect(result.namespaceRecord).toEqual({
      ontologyId: "authz-runtime",
      namespace: "authz",
      owner: "registry-service",
      lifecycle: "draft",
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:00:00.000Z",
    });
    expect(await store.listAxes("authz-runtime", "v2")).toEqual([
      expect.objectContaining({
        axisId: "decision_kind",
        values: ["allow", "deny"],
        capacity: 4,
      }),
      expect.objectContaining({
        axisId: "resource_kind",
        values: ["service", "route"],
        capacity: 8,
      }),
    ]);
    expect(
      (await store.listTaxonomies("authz-runtime", "v2")).map(
        (taxonomy) => taxonomy.taxonomyId,
      ),
    ).toEqual(["authorization-decision", "authorization-resource"]);
    expect(await store.listAllocations("authz-runtime", "v2")).toEqual([
      expect.objectContaining({
        allocationId: "authz-runtime:authorization-decision:v2",
        prefix: "authz_authorization_decision",
        versionId: "v2",
        status: "active",
      }),
      expect.objectContaining({
        allocationId: "authz-runtime:authorization-resource:v2",
        prefix: "authz_authorization_resource",
        versionId: "v2",
        status: "active",
      }),
    ]);
    expect(
      await store.listSegments("authz-runtime:authorization-resource:v2"),
    ).toEqual([
      expect.objectContaining({
        allocationId: "authz-runtime:authorization-resource:v2",
        segmentId: "authz-runtime:authorization-resource:v2:product",
        consumes: ["resource_kind"],
      }),
    ]);
    expect(
      await store.listSegments("authz-runtime:authorization-decision:v2"),
    ).toEqual([
      expect.objectContaining({
        allocationId: "authz-runtime:authorization-decision:v2",
        segmentId: "authz-runtime:authorization-decision:v2:product",
        consumes: ["decision_kind"],
      }),
    ]);
    expect(result.activationStatuses).toEqual([
      {
        allocationId: "authz-runtime:authorization-resource:v2",
        taxonomyId: "authorization-resource",
        prefix: "authz_authorization_resource",
        versionId: "v2",
        status: "active",
        activationStatus: "active",
        syncStatus: "synced",
      },
      {
        allocationId: "authz-runtime:authorization-decision:v2",
        taxonomyId: "authorization-decision",
        prefix: "authz_authorization_decision",
        versionId: "v2",
        status: "active",
        activationStatus: "active",
        syncStatus: "synced",
      },
    ]);
    expect(result.syncReports.map((report) => report.allocationId)).toEqual([
      "authz-runtime:authorization-resource:v2",
      "authz-runtime:authorization-decision:v2",
    ]);
    expect(result.syncReports.map((report) => report.syncStatus)).toEqual([
      "synced",
      "synced",
    ]);
    expect(result.smokeChecks).toEqual([
      expect.objectContaining({
        allocationId: "authz-runtime:authorization-resource:v2",
        taxonomyId: "authorization-resource",
        prefix: "authz_authorization_resource",
        versionId: "v2",
        addressModel: "product",
        kind: "product",
        syncStatus: "synced",
        passed: true,
        checks: expect.arrayContaining([
          expect.objectContaining({
            name: "source-allocation-active",
            passed: true,
          }),
          expect.objectContaining({
            name: "product-prefix-record-matches",
            passed: true,
          }),
          expect.objectContaining({
            name: "schema-version-capacity-matches-prefix-registry",
            passed: true,
          }),
          expect.objectContaining({
            name: "product-shape-matches-ordered-axis-capacities",
            passed: true,
          }),
          expect.objectContaining({
            name: "last-valid-address-in-range",
            passed: true,
          }),
          expect.objectContaining({
            name: "capacity-address-out-of-range",
            passed: true,
          }),
        ]),
      }),
      expect.objectContaining({
        allocationId: "authz-runtime:authorization-decision:v2",
        taxonomyId: "authorization-decision",
        prefix: "authz_authorization_decision",
        versionId: "v2",
        addressModel: "product",
        kind: "product",
        syncStatus: "synced",
        passed: true,
      }),
    ]);
    expect(result.smokeChecks.flatMap((check) => check.checks)).toHaveLength(12);
    expect(sync).toHaveBeenCalledTimes(2);
    expect(
      sync.mock.calls.map(([bundle]) => bundle.allocation.allocationId),
    ).toEqual([
      "authz-runtime:authorization-resource:v2",
      "authz-runtime:authorization-decision:v2",
    ]);
    await expect(
      prefixRegistry.getRecord("authz_authorization_resource", "v2"),
    ).resolves.toEqual(
      expect.objectContaining({
        prefix: "authz_authorization_resource",
        versionId: "v2",
        capacity: 8,
      }),
    );
    await expect(
      schemaVersionStore.getSchemaVersion("authz_authorization_resource", "v2"),
    ).resolves.toEqual(
      expect.objectContaining({
        prefix: "authz_authorization_resource",
        versionId: "v2",
        capacity: 8,
      }),
    );
    await expect(
      prefixRegistry.getRecord("authz_authorization_decision", "v2"),
    ).resolves.toEqual(
      expect.objectContaining({
        prefix: "authz_authorization_decision",
        versionId: "v2",
        capacity: 4,
      }),
    );
    await expect(
      schemaVersionStore.getSchemaVersion("authz_authorization_decision", "v2"),
    ).resolves.toEqual(
      expect.objectContaining({
        prefix: "authz_authorization_decision",
        versionId: "v2",
        capacity: 4,
      }),
    );
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("activates a pack and returns namespace, allocation, sync, warning, and error payload fields", async () => {
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
      ontologyId: "authz-runtime",
      namespace: "authz",
      owner: "registry-service",
      versionId: "v2",
      addressModel: "sum",
      capacityByAxisId: { resource_kind: 16 },
      prefixByTaxonomyId: {
        "authorization-resource": "authz_runtime_resource",
      },
      timestamp: "2026-04-14T00:00:00.000Z",
    });

    expect(result.status).toBe("succeeded");
    expect(result.namespaceRecord).toEqual({
      ontologyId: "authz-runtime",
      namespace: "authz",
      owner: "registry-service",
      lifecycle: "draft",
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:00:00.000Z",
    });
    expect(result.allocations).toEqual([
      expect.objectContaining({
        allocationId: "authz-runtime:authorization-resource:v2",
        prefix: "authz_runtime_resource",
        versionId: "v2",
        addressModel: "sum",
        capacity: 16,
        status: "active",
      }),
    ]);
    expect(result.activationStatuses).toEqual([
      expect.objectContaining({
        allocationId: "authz-runtime:authorization-resource:v2",
        status: "active",
        activationStatus: "active",
        syncStatus: "synced",
      }),
    ]);
    expect(result.syncReports).toHaveLength(1);
    expect(result.syncReports[0]).toEqual(
      expect.objectContaining({
        allocationId: "authz-runtime:authorization-resource:v2",
        prefix: "authz_runtime_resource",
        versionId: "v2",
        syncStatus: "synced",
      }),
    );
    expect(result.smokeChecks).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
    await expect(
      prefixRegistry.getRecord("authz_runtime_resource", "v2"),
    ).resolves.toEqual(
      expect.objectContaining({
        prefix: "authz_runtime_resource",
        versionId: "v2",
        capacity: 16,
      }),
    );
  });
});

function namespaceRecord(): OntologyNamespaceRecord {
  return {
    ontologyId: "authz-runtime",
    namespace: "authz",
    owner: "registry-service",
    lifecycle: "draft",
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
}

function allocationRecord(input: {
  readonly status: OntologyAddressAllocationRecord["status"];
}): OntologyAddressAllocationRecord {
  return {
    allocationId: "authz-runtime:authorization-resource:v2",
    ontologyId: "authz-runtime",
    taxonomyId: "authorization-resource",
    prefix: "authz_runtime_resource",
    versionId: "v2",
    addressModel: "sum",
    capacity: 16,
    addressOffset: 0,
    addressSize: 16,
    status: input.status,
  };
}

function syncedReport(
  allocation: OntologyAddressAllocationRecord,
): OntologyIndexMetaSyncReport {
  return {
    allocationId: allocation.allocationId,
    prefix: allocation.prefix,
    versionId: allocation.versionId,
    taxonomyId: allocation.taxonomyId,
    status: "active",
    syncStatus: "synced",
    materializedRecords: [],
    idempotentRecords: [],
    repairedRecords: [],
    collisions: [],
    deferredSemantics: [],
    postSyncChecks: {
      targetRecords: [
        {
          role: "allocation-prefix",
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
      productAllocation: {
        prefix: allocation.prefix,
        versionId: allocation.versionId,
        expectedShape: [allocation.capacity],
        actualShape: [allocation.capacity],
        shapeMatchesOrderedAxisCapacities: true,
        resolverChecks: {
          lastValidAddress: {
            serialized: `${allocation.prefix}:${allocation.versionId}:${allocation.capacity - 1}`,
            index: allocation.capacity - 1,
            resolved: true,
            valid: true,
          },
          capacityAddress: {
            serialized: `${allocation.prefix}:${allocation.versionId}:${allocation.capacity}`,
            index: allocation.capacity,
            resolved: true,
            valid: false,
          },
          lastValidAddressInRange: true,
          capacityAddressOutOfRange: true,
        },
      },
    },
  };
}
