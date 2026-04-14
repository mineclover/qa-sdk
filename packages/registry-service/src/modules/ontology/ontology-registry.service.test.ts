import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryPrefixRegistry } from "index-meta";
import { operationalOntologyAllocationPlane } from "operational-ontology/allocation";
import type { OperationalOntologyPack } from "operational-ontology/pack";

import { InMemoryOntologyRegistryStore } from "../../stores/in-memory-ontology-registry-store.js";
import {
  OntologyRegistryService,
  OntologyRegistryServiceError,
} from "./ontology-registry.service.js";

const validPack = {
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

describe("OntologyRegistryService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers valid packs by allocating, validating, and writing reserved rows", async () => {
    const store = new InMemoryOntologyRegistryStore();
    const service = new OntologyRegistryService({ store });
    const allocate = vi.spyOn(
      operationalOntologyAllocationPlane,
      "allocateOntologyAddressSpace",
    );
    const validatePlan = vi.spyOn(
      operationalOntologyAllocationPlane,
      "validateOntologyAddressAllocationPlan",
    );

    await expect(
      service.registerOntologyPack(validPack, {
        namespace: "authz",
        owner: "registry-service",
        versionId: "v1",
        now: "2026-04-14T00:00:00.000Z",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        packId: "authorization-ontology",
        ontologyId: "authorization-ontology",
        validation: expect.objectContaining({ valid: true }),
        allocationValidation: expect.objectContaining({ valid: true }),
        allocations: expect.arrayContaining([
          expect.objectContaining({
            allocationId: "authorization-ontology:authorization-resource:v1",
            status: "reserved",
          }),
          expect.objectContaining({
            allocationId: "authorization-ontology:authorization-decision:v1",
            status: "reserved",
          }),
        ]),
      }),
    );
    expect(allocate).toHaveBeenCalledWith(
      validPack.schema,
      expect.objectContaining({ ontologyId: "authorization-ontology" }),
    );
    expect(validatePlan).toHaveBeenCalledWith(
      expect.objectContaining({ schema: validPack.schema }),
    );
    expect(await store.listNamespaces()).toEqual([
      expect.objectContaining({
        ontologyId: "authorization-ontology",
        namespace: "authz",
      }),
    ]);
    expect(await store.listAxes("authorization-ontology", "v1")).toHaveLength(2);
    expect(await store.listTaxonomies("authorization-ontology", "v1")).toHaveLength(
      2,
    );
    expect(await store.listAllocations("authorization-ontology", "v1")).toHaveLength(
      2,
    );
    expect(
      await store.listSegments("authorization-ontology:authorization-resource:v1"),
    ).toHaveLength(1);
  });

  it("uses pack id as default ontology id unless options override it", async () => {
    const store = new InMemoryOntologyRegistryStore();
    const service = new OntologyRegistryService({ store });

    const result = await service.registerOntologyPack({
      pack: validPack,
      options: {
        ontologyId: "authz-runtime",
        namespace: "authz",
        versionId: "v2",
      },
    });

    expect(result.ontologyId).toBe("authz-runtime");
    expect(await store.getNamespace("authz-runtime")).toEqual(
      expect.objectContaining({
        ontologyId: "authz-runtime",
        namespace: "authz",
      }),
    );
    expect(await store.listAllocations("authz-runtime", "v2")).toEqual([
      expect.objectContaining({
        allocationId: "authz-runtime:authorization-decision:v2",
      }),
      expect.objectContaining({
        allocationId: "authz-runtime:authorization-resource:v2",
      }),
    ]);
  });

  it("reports invalid pack validation as a service-level no-write conflict", async () => {
    const store = new InMemoryOntologyRegistryStore();
    const service = new OntologyRegistryService({ store });
    const allocate = vi.spyOn(
      operationalOntologyAllocationPlane,
      "allocateOntologyAddressSpace",
    );
    const write = vi.spyOn(store, "writeAllocationPlan");
    const error = await captureServiceError(
      service.registerOntologyPack({
        pack: {
          packId: "broken-pack",
          schema: {
            axes: [{ id: "resource_kind", values: ["service", "service"] }],
            taxonomies: [],
            relationCategories: [],
          },
        },
      }),
    );

    expect(allocate).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(error.conflict).toEqual(
      expect.objectContaining({
        code: "invalid-pack",
        packId: "broken-pack",
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "axis-values-duplicate" }),
        ]),
      }),
    );
    await expectOntologyStoreEmpty(store);
  });

  it("reserves allocation plans through OntologyRegistryStore only", async () => {
    const store = new InMemoryOntologyRegistryStore();
    const service = new OntologyRegistryService({ store });

    const result = await service.reserveAddressSpace({
      pack: validPack,
      policy: {
        namespace: "authz",
        owner: "registry-service",
        versionId: "v1",
        now: "2026-04-14T00:00:00.000Z",
      },
    });

    expect(result.allocations.map((allocation) => allocation.allocationId)).toEqual([
      "authorization-ontology:authorization-resource:v1",
      "authorization-ontology:authorization-decision:v1",
    ]);
    expect(await store.listNamespaces()).toEqual([
      expect.objectContaining({
        ontologyId: "authorization-ontology",
        namespace: "authz",
      }),
    ]);
    expect(
      (await store.listAllocations("authorization-ontology", "v1")).map(
        (allocation) => allocation.status,
      ),
    ).toEqual(["reserved", "reserved"]);
  });

  it("accepts allocation schema and policy inputs while keeping reservations inactive", async () => {
    const store = new InMemoryOntologyRegistryStore();
    const service = new OntologyRegistryService({ store });
    const prefixRegistry = new InMemoryPrefixRegistry();
    const allocate = vi.spyOn(
      operationalOntologyAllocationPlane,
      "allocateOntologyAddressSpace",
    );
    const indexMetaRegister = vi.spyOn(prefixRegistry, "register");

    const result = await service.reserveAddressSpace(validPack.schema, {
      ontologyId: "authz-schema",
      namespace: "authz.schema",
      owner: "registry-service",
      versionId: "v3",
      status: "active",
      addressModel: "sum",
    });

    expect(result).toEqual(
      expect.objectContaining({
        packId: "authz-schema",
        ontologyId: "authz-schema",
        plan: expect.objectContaining({
          validation: expect.objectContaining({ valid: true }),
        }),
      }),
    );
    expect(allocate).toHaveBeenCalledWith(
      validPack.schema,
      expect.objectContaining({
        ontologyId: "authz-schema",
        namespace: "authz.schema",
        status: "reserved",
        addressModel: "sum",
      }),
    );
    expect(result.allocations.map((allocation) => allocation.status)).toEqual([
      "reserved",
      "reserved",
    ]);
    expect(
      (await store.listAllocations("authz-schema", "v3")).map(
        (allocation) => allocation.status,
      ),
    ).toEqual(["reserved", "reserved"]);
    expect(indexMetaRegister).not.toHaveBeenCalled();
    expect(await prefixRegistry.listAll()).toEqual([]);
  });

  it("rejects invalid allocation plans before persistence", async () => {
    const store = new InMemoryOntologyRegistryStore();
    const service = new OntologyRegistryService({ store });
    const write = vi.spyOn(store, "writeAllocationPlan");
    const invalidPlanError = await captureServiceError(
      service.reserveAddressSpace({
        pack: validPack,
        policy: {
          prefixByTaxonomyId: {
            "authorization-resource": "authz_shared",
            "authorization-decision": "authz_shared",
          },
        },
      }),
    );

    expect(write).not.toHaveBeenCalled();
    expect(invalidPlanError.conflict).toEqual(
      expect.objectContaining({
        code: "invalid-allocation-plan",
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "ontology-prefix-version-duplicate" }),
        ]),
      }),
    );
    await expectOntologyStoreEmpty(store);
  });

  it("maps duplicate prefix/version reservations to structured service conflicts", async () => {
    const service = new OntologyRegistryService({
      store: new InMemoryOntologyRegistryStore(),
    });

    await service.reserveAddressSpace(validPack.schema, {
      ontologyId: "authz-a",
      namespace: "authz-a",
      versionId: "v1",
      prefixByTaxonomyId: {
        "authorization-resource": "shared_prefix",
        "authorization-decision": "authz_a_decision",
      },
    });
    const duplicateError = await captureServiceError(
      service.reserveAddressSpace(validPack.schema, {
        ontologyId: "authz-b",
        namespace: "authz-b",
        versionId: "v1",
        prefixByTaxonomyId: {
          "authorization-resource": "shared_prefix",
          "authorization-decision": "authz_b_decision",
        },
      }),
    );

    expect(duplicateError.conflict).toEqual(
      expect.objectContaining({
        code: "duplicate-allocation",
        allocationIds: [
          "authz-b:authorization-resource:v1",
          "authz-b:authorization-decision:v1",
        ],
        allocationKeys: expect.arrayContaining([
          {
            recordKind: "allocation",
            prefix: "shared_prefix",
            versionId: "v1",
          },
        ]),
        storeConflicts: expect.arrayContaining([
          expect.objectContaining({
            code: "drift",
            key: {
              recordKind: "allocation",
              prefix: "shared_prefix",
              versionId: "v1",
            },
          }),
        ]),
      }),
    );
  });

  it("maps duplicate ontology/taxonomy/version reservations without dropping store details", async () => {
    const service = new OntologyRegistryService({
      store: new InMemoryOntologyRegistryStore(),
    });

    await service.reserveAddressSpace(validPack.schema, {
      ontologyId: "authz",
      namespace: "authz",
      versionId: "v1",
      prefixByTaxonomyId: {
        "authorization-resource": "authz_resource",
        "authorization-decision": "authz_decision",
      },
    });
    const duplicateError = await captureServiceError(
      service.reserveAddressSpace(validPack.schema, {
        ontologyId: "authz",
        namespace: "authz",
        versionId: "v1",
        prefixByTaxonomyId: {
          "authorization-resource": "authz_resource_v2",
          "authorization-decision": "authz_decision_v2",
        },
      }),
    );

    expect(duplicateError.conflict).toEqual(
      expect.objectContaining({
        code: "duplicate-allocation",
        allocationKeys: expect.arrayContaining([
          {
            recordKind: "allocation",
            ontologyId: "authz",
            taxonomyId: "authorization-resource",
            versionId: "v1",
          },
        ]),
        storeConflicts: expect.arrayContaining([
          expect.objectContaining({
            code: "drift",
            key: {
              recordKind: "allocation",
              allocationId: "authz:authorization-resource:v1",
            },
            fields: expect.arrayContaining(["prefix"]),
          }),
        ]),
      }),
    );
  });

  it("activates reserved allocations through the store boundary without index-meta calls", async () => {
    const store = new InMemoryOntologyRegistryStore();
    const service = new OntologyRegistryService({ store });
    const prefixRegistry = new InMemoryPrefixRegistry();
    const updateStatus = vi.spyOn(store, "updateAllocationStatus");
    const indexMetaGet = vi.spyOn(prefixRegistry, "getRecord");
    const indexMetaRegister = vi.spyOn(prefixRegistry, "register");
    await service.reserveAddressSpace({ pack: validPack });

    const activated = await service.activateAllocation(
      "authorization-ontology:authorization-resource:v1",
    );

    expect(activated.allocation.status).toBe("active");
    expect(updateStatus).toHaveBeenCalledWith(
      "authorization-ontology:authorization-resource:v1",
      "active",
    );
    expect(indexMetaGet).not.toHaveBeenCalled();
    expect(indexMetaRegister).not.toHaveBeenCalled();
  });

  it("rejects missing, active-again, and deprecated activation paths", async () => {
    const store = new InMemoryOntologyRegistryStore();
    const service = new OntologyRegistryService({ store });
    await service.reserveAddressSpace({ pack: validPack });

    await service.activateAllocation({
      allocationId: "authorization-ontology:authorization-resource:v1",
    });

    const transitionError = await captureServiceError(
      service.activateAllocation({
        allocationId: "authorization-ontology:authorization-resource:v1",
      }),
    );
    expect(transitionError.conflict).toEqual(
      expect.objectContaining({
        code: "invalid-transition",
        from: "active",
        to: "active",
      }),
    );

    await store.updateAllocationStatus(
      "authorization-ontology:authorization-decision:v1",
      "deprecated",
    );
    const deprecatedError = await captureServiceError(
      service.activateAllocation("authorization-ontology:authorization-decision:v1"),
    );
    expect(deprecatedError.conflict).toEqual(
      expect.objectContaining({
        code: "invalid-transition",
        from: "deprecated",
        to: "active",
      }),
    );

    const missingError = await captureServiceError(
      service.activateAllocation("missing"),
    );
    expect(missingError.conflict).toEqual(
      expect.objectContaining({
        code: "missing-allocation",
        allocationId: "missing",
      }),
    );
  });

  it("blocks activation when another active allocation owns the prefix/version", async () => {
    const store = new InMemoryOntologyRegistryStore();
    const service = new OntologyRegistryService({ store });
    await service.reserveAddressSpace({ pack: validPack });
    const allocation = await store.getAllocation(
      "authorization-ontology:authorization-resource:v1",
    );
    if (!allocation) {
      throw new Error("test fixture is missing the reserved allocation");
    }
    const activeAllocation = {
      ...allocation,
      allocationId: "legacy-ontology:authorization-resource:v1",
      ontologyId: "legacy-ontology",
      status: "active" as const,
    };
    const listActive = vi
      .spyOn(store, "listActiveAllocations")
      .mockResolvedValue([activeAllocation]);
    const updateStatus = vi.spyOn(store, "updateAllocationStatus");

    const duplicateError = await captureServiceError(
      service.activateAllocation(allocation.allocationId),
    );

    expect(listActive).toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
    expect(duplicateError.conflict).toEqual(
      expect.objectContaining({
        code: "duplicate-allocation",
        allocationIds: [
          "authorization-ontology:authorization-resource:v1",
          "legacy-ontology:authorization-resource:v1",
        ],
        allocationKeys: expect.arrayContaining([
          {
            recordKind: "allocation",
            prefix: "authorization_ontology_authorization_resource",
            versionId: "v1",
          },
        ]),
        storeConflicts: expect.arrayContaining([
          expect.objectContaining({
            code: "duplicate-key",
            key: {
              recordKind: "allocation",
              prefix: "authorization_ontology_authorization_resource",
              versionId: "v1",
            },
          }),
        ]),
      }),
    );
    expect(
      await store.getAllocation("authorization-ontology:authorization-resource:v1"),
    ).toEqual(expect.objectContaining({ status: "reserved" }));
  });

  it("syncs active allocations to PrefixRegistry with explicit preconditions", async () => {
    const service = new OntologyRegistryService({
      store: new InMemoryOntologyRegistryStore(),
    });
    const prefixRegistry = new InMemoryPrefixRegistry();
    await service.reserveAddressSpace({ pack: validPack });

    const reservedSyncError = await captureServiceError(
      service.syncToPrefixRegistry({
        allocationId: "authorization-ontology:authorization-resource:v1",
        prefixRegistry,
      }),
    );
    expect(reservedSyncError.conflict).toEqual(
      expect.objectContaining({
        code: "sync-precondition-failure",
        reason: "allocation-not-active",
      }),
    );

    await service.activateAllocation({
      allocationId: "authorization-ontology:authorization-resource:v1",
    });
    const synced = await service.syncToPrefixRegistry({
      allocationId: "authorization-ontology:authorization-resource:v1",
      prefixRegistry,
    });
    expect(synced).toEqual(
      expect.objectContaining({
        synced: true,
        prefixRecord: {
          prefix: "authorization_ontology_authorization_resource",
          versionId: "v1",
          capacity: 8,
        },
      }),
    );
    expect(
      await prefixRegistry.getRecord(
        "authorization_ontology_authorization_resource",
        "v1",
      ),
    ).toEqual(synced.prefixRecord);

    await expect(
      service.syncToPrefixRegistry({
        allocationId: "authorization-ontology:authorization-resource:v1",
        prefixRegistry,
      }),
    ).resolves.toEqual(expect.objectContaining({ synced: false }));
  });
});

async function captureServiceError(
  action: Promise<unknown>,
): Promise<OntologyRegistryServiceError> {
  let thrown: unknown;
  try {
    await action;
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(OntologyRegistryServiceError);
  return thrown as OntologyRegistryServiceError;
}

async function expectOntologyStoreEmpty(
  store: InMemoryOntologyRegistryStore,
): Promise<void> {
  expect(await store.listNamespaces()).toEqual([]);
  expect(await store.listAxes("authorization-ontology", "v1")).toEqual([]);
  expect(await store.listTaxonomies("authorization-ontology", "v1")).toEqual([]);
  expect(await store.listAllocations("authorization-ontology", "v1")).toEqual([]);
  expect(
    await store.listSegments("authorization-ontology:authorization-resource:v1"),
  ).toEqual([]);
  expect(
    await store.listSegments("authorization-ontology:authorization-decision:v1"),
  ).toEqual([]);
}
