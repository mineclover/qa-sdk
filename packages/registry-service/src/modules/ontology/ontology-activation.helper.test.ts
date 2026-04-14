import { describe, expect, it, vi } from "vitest";
import { InMemoryIndexMetaStore, InMemoryPrefixRegistry } from "index-meta";
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

describe("OntologyPackActivationHelper", () => {
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
        warnings: [],
        errors: [],
      }),
    );
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
      targetRecords: [],
    },
  };
}
