import { describe, expect, it } from "vitest";
import { InMemoryIndexMetaStore, InMemoryPrefixRegistry } from "index-meta";
import type {
  OntologyAddressAllocationRecord,
  OntologyAddressSegmentRecord,
} from "../../stores/ontology-registry-store.js";
import {
  createOntologyIndexMetaSyncAdapter,
  deriveOntologyAxisLeafPrefix,
  type OntologyIndexMetaSyncBundle,
} from "./index-meta-sync.adapter.js";

const NOW = "2026-04-14T00:00:00.000Z";
const RESOURCE_AXIS_PREFIX = "authz_axis_resource_kind";
const DECISION_AXIS_PREFIX = "authz_axis_decision_kind";
const PARENT_PREFIX = "authz_authorization_surface";
const SUM_PREFIX = "authz_resource";

describe("Ontology index-meta sync adapter", () => {
  it("materializes product allocation prefixes in taxonomy axis order", async () => {
    const prefixRegistry = new InMemoryPrefixRegistry();
    const schemaVersionStore = new InMemoryIndexMetaStore();
    const adapter = createOntologyIndexMetaSyncAdapter({
      prefixRegistry,
      schemaVersionStore,
    });

    const report = await adapter.sync(productBundle());

    expect(report.syncStatus).toBe("synced");
    if (report.syncStatus !== "synced") {
      throw new Error("expected product sync to materialize");
    }
    expect(report.materializedRecords).toHaveLength(6);
    expect(report.idempotentRecords).toEqual([]);
    expect(report.collisions).toEqual([]);
    expect(
      deriveOntologyAxisLeafPrefix("authz", "resource_kind"),
    ).toBe(RESOURCE_AXIS_PREFIX);
    expect(
      await prefixRegistry.getRecord(RESOURCE_AXIS_PREFIX, "v1"),
    ).toEqual({
      prefix: RESOURCE_AXIS_PREFIX,
      versionId: "v1",
      capacity: 8,
    });
    expect(
      await prefixRegistry.getRecord(DECISION_AXIS_PREFIX, "v1"),
    ).toEqual({
      prefix: DECISION_AXIS_PREFIX,
      versionId: "v1",
      capacity: 4,
    });
    expect(await prefixRegistry.getRecord(PARENT_PREFIX, "v1")).toEqual({
      prefix: PARENT_PREFIX,
      versionId: "v1",
      capacity: 32,
      refs: [
        { prefix: RESOURCE_AXIS_PREFIX, versionId: "v1", capacity: 8 },
        { prefix: DECISION_AXIS_PREFIX, versionId: "v1", capacity: 4 },
      ],
    });
    expect(await prefixRegistry.getShape(PARENT_PREFIX, "v1")).toEqual([8, 4]);
    expect(
      await schemaVersionStore.getSchemaVersion(RESOURCE_AXIS_PREFIX, "v1"),
    ).toEqual({
      prefix: RESOURCE_AXIS_PREFIX,
      versionId: "v1",
      capacity: 8,
      createdAt: NOW,
    });
    expect(
      await schemaVersionStore.getSchemaVersion(DECISION_AXIS_PREFIX, "v1"),
    ).toEqual({
      prefix: DECISION_AXIS_PREFIX,
      versionId: "v1",
      capacity: 4,
      createdAt: NOW,
    });
    expect(
      await schemaVersionStore.getSchemaVersion(PARENT_PREFIX, "v1"),
    ).toEqual({
      prefix: PARENT_PREFIX,
      versionId: "v1",
      capacity: 32,
      createdAt: NOW,
    });
  });

  it("treats re-running the same product sync as idempotent", async () => {
    const prefixRegistry = new InMemoryPrefixRegistry();
    const schemaVersionStore = new InMemoryIndexMetaStore();
    const adapter = createOntologyIndexMetaSyncAdapter({
      prefixRegistry,
      schemaVersionStore,
    });

    await adapter.sync(productBundle());
    const report = await adapter.sync(productBundle());

    expect(report.syncStatus).toBe("synced");
    if (report.syncStatus !== "synced") {
      throw new Error("expected repeated product sync to remain synced");
    }
    expect(report.materializedRecords).toEqual([]);
    expect(report.idempotentRecords).toHaveLength(6);
    expect(report.repairedRecords).toEqual([]);
    expect(report.collisions).toEqual([]);
    expect(await prefixRegistry.listAll()).toHaveLength(3);
  });

  it("repairs missing schema versions when prefix records match the allocation shape", async () => {
    const prefixRegistry = new InMemoryPrefixRegistry();
    const schemaVersionStore = new InMemoryIndexMetaStore();
    await prefixRegistry.register({
      prefix: RESOURCE_AXIS_PREFIX,
      versionId: "v1",
      capacity: 8,
    });
    await prefixRegistry.register({
      prefix: DECISION_AXIS_PREFIX,
      versionId: "v1",
      capacity: 4,
    });
    await prefixRegistry.register({
      prefix: PARENT_PREFIX,
      versionId: "v1",
      capacity: 32,
      refs: [
        { prefix: RESOURCE_AXIS_PREFIX, versionId: "v1", capacity: 8 },
        { prefix: DECISION_AXIS_PREFIX, versionId: "v1", capacity: 4 },
      ],
    });
    const adapter = createOntologyIndexMetaSyncAdapter({
      prefixRegistry,
      schemaVersionStore,
    });

    const report = await adapter.sync(productBundle());

    expect(report.syncStatus).toBe("synced");
    if (report.syncStatus !== "synced") {
      throw new Error("expected missing schema versions to be repaired");
    }
    expect(report.materializedRecords).toEqual([]);
    expect(report.idempotentRecords).toHaveLength(3);
    expect(report.repairedRecords).toEqual([
      expect.objectContaining({
        kind: "schema-version",
        role: "axis-leaf",
        prefix: RESOURCE_AXIS_PREFIX,
        capacity: 8,
      }),
      expect.objectContaining({
        kind: "schema-version",
        role: "axis-leaf",
        prefix: DECISION_AXIS_PREFIX,
        capacity: 4,
      }),
      expect.objectContaining({
        kind: "schema-version",
        role: "allocation-prefix",
        prefix: PARENT_PREFIX,
        capacity: 32,
      }),
    ]);
    expect(report.collisions).toEqual([]);
    expect(
      await schemaVersionStore.getSchemaVersion(RESOURCE_AXIS_PREFIX, "v1"),
    ).toEqual({
      prefix: RESOURCE_AXIS_PREFIX,
      versionId: "v1",
      capacity: 8,
      createdAt: NOW,
    });
    expect(
      await schemaVersionStore.getSchemaVersion(DECISION_AXIS_PREFIX, "v1"),
    ).toEqual({
      prefix: DECISION_AXIS_PREFIX,
      versionId: "v1",
      capacity: 4,
      createdAt: NOW,
    });
    expect(
      await schemaVersionStore.getSchemaVersion(PARENT_PREFIX, "v1"),
    ).toEqual({
      prefix: PARENT_PREFIX,
      versionId: "v1",
      capacity: 32,
      createdAt: NOW,
    });
  });

  it("repairs missing prefix records when schema versions match the allocation shape", async () => {
    const prefixRegistry = new InMemoryPrefixRegistry();
    const schemaVersionStore = new InMemoryIndexMetaStore();
    await schemaVersionStore.insertSchemaVersion({
      prefix: RESOURCE_AXIS_PREFIX,
      versionId: "v1",
      capacity: 8,
      createdAt: NOW,
    });
    await schemaVersionStore.insertSchemaVersion({
      prefix: DECISION_AXIS_PREFIX,
      versionId: "v1",
      capacity: 4,
      createdAt: NOW,
    });
    await schemaVersionStore.insertSchemaVersion({
      prefix: PARENT_PREFIX,
      versionId: "v1",
      capacity: 32,
      createdAt: NOW,
    });
    const adapter = createOntologyIndexMetaSyncAdapter({
      prefixRegistry,
      schemaVersionStore,
    });

    const report = await adapter.sync(productBundle());

    expect(report.syncStatus).toBe("synced");
    if (report.syncStatus !== "synced") {
      throw new Error("expected missing prefix records to be repaired");
    }
    expect(report.materializedRecords).toEqual([]);
    expect(report.idempotentRecords).toHaveLength(3);
    expect(report.repairedRecords).toEqual([
      expect.objectContaining({
        kind: "prefix-registry",
        role: "axis-leaf",
        prefix: RESOURCE_AXIS_PREFIX,
        capacity: 8,
      }),
      expect.objectContaining({
        kind: "prefix-registry",
        role: "axis-leaf",
        prefix: DECISION_AXIS_PREFIX,
        capacity: 4,
      }),
      expect.objectContaining({
        kind: "prefix-registry",
        role: "allocation-prefix",
        prefix: PARENT_PREFIX,
        capacity: 32,
      }),
    ]);
    expect(report.collisions).toEqual([]);
    expect(await prefixRegistry.getRecord(PARENT_PREFIX, "v1")).toEqual({
      prefix: PARENT_PREFIX,
      versionId: "v1",
      capacity: 32,
      refs: [
        { prefix: RESOURCE_AXIS_PREFIX, versionId: "v1", capacity: 8 },
        { prefix: DECISION_AXIS_PREFIX, versionId: "v1", capacity: 4 },
      ],
    });
  });

  it("blocks existing prefix capacity drift without overwriting", async () => {
    const prefixRegistry = new InMemoryPrefixRegistry();
    const schemaVersionStore = new InMemoryIndexMetaStore();
    const existing = {
      prefix: PARENT_PREFIX,
      versionId: "v1",
      capacity: 16,
      refs: [{ prefix: RESOURCE_AXIS_PREFIX, versionId: "v1", capacity: 8 }],
    };
    await prefixRegistry.register(existing);
    const adapter = createOntologyIndexMetaSyncAdapter({
      prefixRegistry,
      schemaVersionStore,
    });

    const report = await adapter.sync(productBundle());

    expect(report.syncStatus).toBe("blocked");
    if (report.syncStatus !== "blocked") {
      throw new Error("expected prefix drift to block sync");
    }
    expect(report.collisions.map((collision) => collision.code)).toEqual(
      expect.arrayContaining(["prefix-capacity-drift", "prefix-refs-drift"]),
    );
    expect(await prefixRegistry.getRecord(PARENT_PREFIX, "v1")).toEqual(existing);
    expect(
      await prefixRegistry.getRecord(RESOURCE_AXIS_PREFIX, "v1"),
    ).toBeNull();
  });

  it("blocks existing prefix refs drift without overwriting", async () => {
    const prefixRegistry = new InMemoryPrefixRegistry();
    const schemaVersionStore = new InMemoryIndexMetaStore();
    const existing = {
      prefix: PARENT_PREFIX,
      versionId: "v1",
      capacity: 32,
      refs: [
        { prefix: DECISION_AXIS_PREFIX, versionId: "v1", capacity: 4 },
        { prefix: RESOURCE_AXIS_PREFIX, versionId: "v1", capacity: 8 },
      ],
    };
    await prefixRegistry.register(existing);
    const adapter = createOntologyIndexMetaSyncAdapter({
      prefixRegistry,
      schemaVersionStore,
    });

    const report = await adapter.sync(productBundle());

    expect(report.syncStatus).toBe("blocked");
    if (report.syncStatus !== "blocked") {
      throw new Error("expected refs drift to block sync");
    }
    expect(report.collisions.map((collision) => collision.code)).toEqual([
      "prefix-refs-drift",
    ]);
    expect(await prefixRegistry.getRecord(PARENT_PREFIX, "v1")).toEqual(existing);
  });

  it("blocks existing schema version capacity drift before prefix writes", async () => {
    const prefixRegistry = new InMemoryPrefixRegistry();
    const schemaVersionStore = new InMemoryIndexMetaStore();
    await schemaVersionStore.insertSchemaVersion({
      prefix: RESOURCE_AXIS_PREFIX,
      versionId: "v1",
      capacity: 16,
      createdAt: NOW,
    });
    const adapter = createOntologyIndexMetaSyncAdapter({
      prefixRegistry,
      schemaVersionStore,
    });

    const report = await adapter.sync(productBundle());

    expect(report.syncStatus).toBe("blocked");
    if (report.syncStatus !== "blocked") {
      throw new Error("expected schema drift to block sync");
    }
    expect(report.collisions.map((collision) => collision.code)).toEqual([
      "schema-version-capacity-drift",
    ]);
    expect(await prefixRegistry.listAll()).toEqual([]);
    expect(
      await schemaVersionStore.getSchemaVersion(RESOURCE_AXIS_PREFIX, "v1"),
    ).toEqual({
      prefix: RESOURCE_AXIS_PREFIX,
      versionId: "v1",
      capacity: 16,
      createdAt: NOW,
    });
  });

  it("checks product segment shape before writing parent records", async () => {
    const prefixRegistry = new InMemoryPrefixRegistry();
    const schemaVersionStore = new InMemoryIndexMetaStore();
    const adapter = createOntologyIndexMetaSyncAdapter({
      prefixRegistry,
      schemaVersionStore,
    });

    const report = await adapter.sync(
      productBundle({
        segments: [
          {
            allocationId: "authorization-ontology:authorization-surface:v1",
            segmentId: "authorization-ontology:authorization-surface:v1:product",
            consumes: ["decision_kind", "resource_kind"],
            addressOffset: 0,
            addressSize: 32,
          },
        ],
      }),
    );

    expect(report.syncStatus).toBe("blocked");
    if (report.syncStatus !== "blocked") {
      throw new Error("expected segment shape drift to block sync");
    }
    expect(report.collisions.map((collision) => collision.code)).toEqual([
      "allocation-shape-drift",
    ]);
    expect(await prefixRegistry.listAll()).toEqual([]);
    expect(
      await schemaVersionStore.getSchemaVersion(PARENT_PREFIX, "v1"),
    ).toBeNull();
  });

  it("blocks parent capacity drift before writing prefix records", async () => {
    const prefixRegistry = new InMemoryPrefixRegistry();
    const schemaVersionStore = new InMemoryIndexMetaStore();
    const adapter = createOntologyIndexMetaSyncAdapter({
      prefixRegistry,
      schemaVersionStore,
    });

    const report = await adapter.sync(
      productBundle({
        allocation: {
          capacity: 31,
        },
      }),
    );

    expect(report.syncStatus).toBe("blocked");
    if (report.syncStatus !== "blocked") {
      throw new Error("expected allocation shape drift to block sync");
    }
    expect(report.collisions.map((collision) => collision.code)).toContain(
      "allocation-shape-drift",
    );
    expect(await prefixRegistry.listAll()).toEqual([]);
  });

  it("materializes sum allocation as a leaf prefix with segment sidecars", async () => {
    const prefixRegistry = new InMemoryPrefixRegistry();
    const schemaVersionStore = new InMemoryIndexMetaStore();
    const adapter = createOntologyIndexMetaSyncAdapter({
      prefixRegistry,
      schemaVersionStore,
    });

    const report = await adapter.sync(sumBundle());

    expect(report.syncStatus).toBe("synced");
    if (report.syncStatus !== "synced") {
      throw new Error("expected sum sync to materialize");
    }
    expect(report.materializedRecords).toEqual([
      expect.objectContaining({
        kind: "prefix-registry",
        role: "allocation-prefix",
        prefix: SUM_PREFIX,
        versionId: "v2",
        capacity: 16,
      }),
      expect.objectContaining({
        kind: "schema-version",
        role: "allocation-prefix",
        prefix: SUM_PREFIX,
        versionId: "v2",
        capacity: 16,
      }),
    ]);
    expect(report.idempotentRecords).toEqual([]);
    expect(report.repairedRecords).toEqual([]);
    expect(report.collisions).toEqual([]);
    expect(report.deferredSemantics).toEqual([
      {
        code: "sum-segment-prefix-ref-unsupported",
        message:
          'Sum allocation "authorization-ontology:authorization-resource:v2" is materialized as a leaf prefix; segment ranges are report sidecars until index-meta owns a segment model',
        coveragePolicy: "exact-allocation-range",
        segments: [
          {
            segmentId:
              "authorization-ontology:authorization-resource:v2:resource_kind",
            consumes: ["resource_kind"],
            addressOffset: 100,
            addressSize: 8,
          },
          {
            segmentId:
              "authorization-ontology:authorization-resource:v2:enforcement_kind",
            consumes: ["enforcement_kind"],
            addressOffset: 108,
            addressSize: 8,
          },
        ],
      },
    ]);
    expect(await prefixRegistry.getRecord(SUM_PREFIX, "v2")).toEqual({
      prefix: SUM_PREFIX,
      versionId: "v2",
      capacity: 16,
    });
    expect(await prefixRegistry.getDeps(SUM_PREFIX, "v2")).toEqual([]);
    expect(await prefixRegistry.getShape(SUM_PREFIX, "v2")).toEqual([16]);
    expect(
      await schemaVersionStore.getSchemaVersion(SUM_PREFIX, "v2"),
    ).toEqual({
      prefix: SUM_PREFIX,
      versionId: "v2",
      capacity: 16,
      createdAt: NOW,
    });
  });

  it("treats re-running the same sum sync as idempotent", async () => {
    const prefixRegistry = new InMemoryPrefixRegistry();
    const schemaVersionStore = new InMemoryIndexMetaStore();
    const adapter = createOntologyIndexMetaSyncAdapter({
      prefixRegistry,
      schemaVersionStore,
    });

    await adapter.sync(sumBundle());
    const report = await adapter.sync(sumBundle());

    expect(report.syncStatus).toBe("synced");
    if (report.syncStatus !== "synced") {
      throw new Error("expected repeated sum sync to remain synced");
    }
    expect(report.materializedRecords).toEqual([]);
    expect(report.idempotentRecords).toEqual([
      expect.objectContaining({
        kind: "prefix-registry",
        role: "allocation-prefix",
        prefix: SUM_PREFIX,
        capacity: 16,
      }),
      expect.objectContaining({
        kind: "schema-version",
        role: "allocation-prefix",
        prefix: SUM_PREFIX,
        capacity: 16,
      }),
    ]);
    expect(report.repairedRecords).toEqual([]);
    expect(report.collisions).toEqual([]);
    expect(report.deferredSemantics[0]?.segments).toHaveLength(2);
    expect(await prefixRegistry.listAll()).toHaveLength(1);
  });

  it.each([
    {
      name: "range outside allocation",
      segments: sumSegments([
        { axisId: "resource_kind", addressOffset: 99, addressSize: 8 },
        { axisId: "enforcement_kind", addressOffset: 108, addressSize: 8 },
      ]),
    },
    {
      name: "overlap",
      segments: sumSegments([
        { axisId: "resource_kind", addressOffset: 100, addressSize: 9 },
        { axisId: "enforcement_kind", addressOffset: 108, addressSize: 8 },
      ]),
    },
    {
      name: "gap",
      segments: sumSegments([
        { axisId: "resource_kind", addressOffset: 100, addressSize: 7 },
        { axisId: "enforcement_kind", addressOffset: 108, addressSize: 8 },
      ]),
    },
  ])(
    "blocks sum sidecar coverage drift before writing prefix records: $name",
    async ({ segments }) => {
      const prefixRegistry = new InMemoryPrefixRegistry();
      const schemaVersionStore = new InMemoryIndexMetaStore();
      const adapter = createOntologyIndexMetaSyncAdapter({
        prefixRegistry,
        schemaVersionStore,
      });

      const report = await adapter.sync(sumBundle({ segments }));

      expect(report.syncStatus).toBe("blocked");
      if (report.syncStatus !== "blocked") {
        throw new Error("expected sum sidecar coverage drift to block sync");
      }
      expect(report.collisions.map((collision) => collision.code)).toContain(
        "sum-segment-coverage-drift",
      );
      expect(await prefixRegistry.listAll()).toEqual([]);
      expect(
        await schemaVersionStore.getSchemaVersion(SUM_PREFIX, "v2"),
      ).toBeNull();
    },
  );

  it("blocks sum allocation capacity drift before writing prefix records", async () => {
    const prefixRegistry = new InMemoryPrefixRegistry();
    const schemaVersionStore = new InMemoryIndexMetaStore();
    const adapter = createOntologyIndexMetaSyncAdapter({
      prefixRegistry,
      schemaVersionStore,
    });

    const report = await adapter.sync(
      sumBundle({
        allocation: {
          capacity: 15,
        },
      }),
    );

    expect(report.syncStatus).toBe("blocked");
    if (report.syncStatus !== "blocked") {
      throw new Error("expected sum allocation capacity drift to block sync");
    }
    expect(report.collisions.map((collision) => collision.code)).toContain(
      "sum-segment-coverage-drift",
    );
    expect(await prefixRegistry.listAll()).toEqual([]);
  });
});

function productBundle(overrides?: {
  readonly allocation?: Partial<
    Omit<OntologyAddressAllocationRecord, "addressModel" | "status">
  >;
  readonly segments?: readonly OntologyAddressSegmentRecord[];
}): OntologyIndexMetaSyncBundle {
  const allocation = {
    allocationId: "authorization-ontology:authorization-surface:v1",
    ontologyId: "authorization-ontology",
    taxonomyId: "authorization-surface",
    prefix: PARENT_PREFIX,
    versionId: "v1",
    addressModel: "product",
    capacity: 32,
    addressOffset: 0,
    addressSize: 32,
    status: "active",
    ...(overrides?.allocation ?? {}),
  } satisfies OntologyAddressAllocationRecord & { readonly status: "active" };

  return {
    allocation,
    namespace: {
      ontologyId: "authorization-ontology",
      namespace: "authz",
      owner: "registry-service",
      lifecycle: "draft",
      createdAt: NOW,
      updatedAt: NOW,
    },
    taxonomy: {
      ontologyId: "authorization-ontology",
      taxonomyId: "authorization-surface",
      versionId: "v1",
      appliesTo: ["node"],
      axisIds: ["resource_kind", "decision_kind"],
      identityAxisIds: ["resource_kind"],
      space: "authorization",
      lifecycle: "draft",
    },
    axes: [
      {
        ontologyId: "authorization-ontology",
        axisId: "decision_kind",
        versionId: "v1",
        values: ["allow", "deny"],
        valuesHash: "fnv1a32:decision",
        capacity: 4,
        lifecycle: "draft",
      },
      {
        ontologyId: "authorization-ontology",
        axisId: "resource_kind",
        versionId: "v1",
        values: ["service", "route"],
        valuesHash: "fnv1a32:resource",
        capacity: 8,
        lifecycle: "draft",
      },
    ],
    segments: overrides?.segments ?? [
      {
        allocationId: "authorization-ontology:authorization-surface:v1",
        segmentId: "authorization-ontology:authorization-surface:v1:product",
        consumes: ["resource_kind", "decision_kind"],
        addressOffset: 0,
        addressSize: 32,
      },
    ],
  };
}

function sumBundle(overrides?: {
  readonly allocation?: Partial<
    Omit<OntologyAddressAllocationRecord, "addressModel" | "status">
  >;
  readonly segments?: readonly OntologyAddressSegmentRecord[];
}): OntologyIndexMetaSyncBundle {
  const allocation = {
    allocationId: "authorization-ontology:authorization-resource:v2",
    ontologyId: "authorization-ontology",
    taxonomyId: "authorization-resource",
    prefix: SUM_PREFIX,
    versionId: "v2",
    addressModel: "sum",
    capacity: 16,
    addressOffset: 100,
    addressSize: 16,
    status: "active",
    ...(overrides?.allocation ?? {}),
  } satisfies OntologyAddressAllocationRecord & { readonly status: "active" };

  return {
    allocation,
    namespace: {
      ontologyId: "authorization-ontology",
      namespace: "authz",
      owner: "registry-service",
      lifecycle: "draft",
      createdAt: NOW,
      updatedAt: NOW,
    },
    taxonomy: {
      ontologyId: "authorization-ontology",
      taxonomyId: "authorization-resource",
      versionId: "v2",
      appliesTo: ["node"],
      axisIds: ["resource_kind", "enforcement_kind"],
      identityAxisIds: ["resource_kind"],
      space: "authorization",
      lifecycle: "draft",
    },
    axes: [
      {
        ontologyId: "authorization-ontology",
        axisId: "resource_kind",
        versionId: "v2",
        values: ["service", "route"],
        valuesHash: "fnv1a32:resource",
        capacity: 8,
        lifecycle: "draft",
      },
      {
        ontologyId: "authorization-ontology",
        axisId: "enforcement_kind",
        versionId: "v2",
        values: ["allow", "deny"],
        valuesHash: "fnv1a32:enforcement",
        capacity: 8,
        lifecycle: "draft",
      },
    ],
    segments:
      overrides?.segments ??
      sumSegments([
        { axisId: "resource_kind", addressOffset: 100, addressSize: 8 },
        { axisId: "enforcement_kind", addressOffset: 108, addressSize: 8 },
      ]),
  };
}

function sumSegments(
  inputs: readonly {
    readonly axisId: string;
    readonly addressOffset: number;
    readonly addressSize: number;
  }[],
): readonly OntologyAddressSegmentRecord[] {
  return inputs.map((input) => ({
    allocationId: "authorization-ontology:authorization-resource:v2",
    segmentId: `authorization-ontology:authorization-resource:v2:${input.axisId}`,
    consumes: [input.axisId],
    addressOffset: input.addressOffset,
    addressSize: input.addressSize,
  }));
}
