import { describe, expect, it } from "vitest";
import { InMemoryPrefixRegistry } from "index-meta";
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
  it("validates operational ontology packs without exposing transport handlers", async () => {
    const service = new OntologyRegistryService({
      store: new InMemoryOntologyRegistryStore(),
    });

    await expect(
      service.registerOntologyPack({ pack: validPack }),
    ).resolves.toEqual(
      expect.objectContaining({
        packId: "authorization-ontology",
        validation: expect.objectContaining({ valid: true }),
      }),
    );
  });

  it("reports invalid pack validation as a service-level conflict", async () => {
    const service = new OntologyRegistryService({
      store: new InMemoryOntologyRegistryStore(),
    });
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

    expect(error.conflict).toEqual(
      expect.objectContaining({
        code: "invalid-pack",
        packId: "broken-pack",
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "axis-values-duplicate" }),
        ]),
      }),
    );
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

  it("maps invalid allocation plans and duplicate reservations to service conflicts", async () => {
    const service = new OntologyRegistryService({
      store: new InMemoryOntologyRegistryStore(),
    });
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

    expect(invalidPlanError.conflict).toEqual(
      expect.objectContaining({
        code: "invalid-allocation-plan",
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "ontology-prefix-version-duplicate" }),
        ]),
      }),
    );

    await service.reserveAddressSpace({ pack: validPack });
    const duplicateError = await captureServiceError(
      service.reserveAddressSpace({ pack: validPack }),
    );

    expect(duplicateError.conflict).toEqual(
      expect.objectContaining({
        code: "duplicate-allocation",
        allocationIds: [
          "authorization-ontology:authorization-resource:v1",
          "authorization-ontology:authorization-decision:v1",
        ],
      }),
    );
  });

  it("activates reserved allocations and rejects invalid transitions", async () => {
    const service = new OntologyRegistryService({
      store: new InMemoryOntologyRegistryStore(),
    });
    await service.reserveAddressSpace({ pack: validPack });

    const activated = await service.activateAllocation({
      allocationId: "authorization-ontology:authorization-resource:v1",
    });
    expect(activated.allocation.status).toBe("active");

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

    const missingError = await captureServiceError(
      service.activateAllocation({ allocationId: "missing" }),
    );
    expect(missingError.conflict).toEqual(
      expect.objectContaining({ code: "missing-allocation" }),
    );
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
