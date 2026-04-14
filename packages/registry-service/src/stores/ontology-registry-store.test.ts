import { afterEach, describe, expect, it } from "vitest";
import type { SqlDriver } from "index-meta";

import { createRegistryDatabaseDriver } from "../bootstrap/stores.js";
import { InMemoryOntologyRegistryStore } from "./in-memory-ontology-registry-store.js";
import {
  OntologyRegistryStoreError,
  type OntologyAddressAllocationRecord,
  type OntologyAllocationPlanWriteSet,
  type OntologyRegistryStore,
  type OntologyRegistryStoreConflict,
} from "./ontology-registry-store.js";
import { SqlOntologyRegistryStore } from "./sql-ontology-registry-store.js";
import {
  buildOntologyAddressAllocationRecord,
  buildOntologyAddressSegmentRecord,
  buildOntologyAxisRecord,
  buildOntologyNamespaceRecord,
  buildOntologyTaxonomyRecord,
} from "./ontology-registry-validation.js";

interface StoreContractContext {
  readonly store: OntologyRegistryStore;
  readonly cleanup?: () => void | Promise<void>;
  readonly assertNoBackendRows?: () => Promise<void>;
}

interface StoreContractCase {
  readonly name: string;
  readonly create: () => Promise<StoreContractContext>;
}

const activeContexts: StoreContractContext[] = [];

const storeContractCases = [
  {
    name: "InMemoryOntologyRegistryStore",
    create: async () => ({
      store: new InMemoryOntologyRegistryStore(),
    }),
  },
  {
    name: "SqlOntologyRegistryStore",
    create: async () => {
      const driver = await createRegistryDatabaseDriver(":memory:");
      return {
        store: new SqlOntologyRegistryStore(driver),
        cleanup: () => driver.close(),
        assertNoBackendRows: () => expectEmptySqlTables(driver),
      };
    },
  },
] satisfies readonly StoreContractCase[];

afterEach(async () => {
  while (activeContexts.length > 0) {
    await activeContexts.pop()?.cleanup?.();
  }
});

describe.each(storeContractCases)("$name contract", ({ create }) => {
  async function setup(): Promise<StoreContractContext> {
    const context = await create();
    activeContexts.push(context);
    return context;
  }

  it("persists a complete allocation plan", async () => {
    const { store } = await setup();
    const writeSet = buildWriteSet();

    await store.writeAllocationPlan(writeSet);

    expect(await store.listNamespaces()).toEqual([writeSet.namespace]);
    expect(await store.getNamespace("ontology-a")).toEqual(writeSet.namespace);
    expect(await store.getNamespace("missing")).toBeNull();
    expect(await store.listAxes("ontology-a", "v1")).toEqual([
      writeSet.axes[1],
      writeSet.axes[0],
    ]);
    expect(await store.listTaxonomies("ontology-a", "v1")).toEqual([
      writeSet.taxonomies[1],
      writeSet.taxonomies[0],
    ]);
    expect(await store.listAllocations("ontology-a", "v1")).toEqual([
      writeSet.allocations[1],
      writeSet.allocations[0],
    ]);
    expect(await store.getAllocation("ontology-a:deployment-surface:v1")).toEqual(
      writeSet.allocations[1],
    );
    expect(await store.getAllocation("missing")).toBeNull();
    expect(await store.listActiveAllocations()).toEqual([writeSet.allocations[1]]);
    expect(await store.listSegments("ontology-a:runtime-surface:v1")).toEqual([
      writeSet.segments[0],
    ]);
    expect(await store.listSegments("missing")).toEqual([]);
  });

  it("rejects namespace reuse and exact duplicate keys without changing existing rows", async () => {
    const { store } = await setup();
    const writeSet = buildWriteSet();

    await store.writeAllocationPlan(writeSet);
    const beforeDuplicate = await readOntologySnapshot(store, "ontology-a", "v1");

    const duplicateConflicts = await expectRejectedConflicts(
      store.writeAllocationPlan(writeSet),
    );

    expect(duplicateConflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "duplicate-key",
          key: {
            recordKind: "namespace",
            ontologyId: "ontology-a",
          },
        }),
        expect.objectContaining({
          code: "duplicate-key",
          key: expect.objectContaining({ recordKind: "axis" }),
        }),
        expect.objectContaining({
          code: "duplicate-key",
          key: expect.objectContaining({ recordKind: "taxonomy" }),
        }),
        expect.objectContaining({
          code: "duplicate-key",
          key: expect.objectContaining({ recordKind: "allocation" }),
        }),
        expect.objectContaining({
          code: "duplicate-key",
          key: expect.objectContaining({ recordKind: "segment" }),
        }),
      ]),
    );
    expect(await readOntologySnapshot(store, "ontology-a", "v1")).toEqual(
      beforeDuplicate,
    );

    const namespaceConflicts = await expectRejectedConflicts(
      store.writeAllocationPlan(
        buildWriteSet({
          ontologyId: "ontology-b",
          namespace: "qa.runtime",
          prefixSeed: "qb",
        }),
      ),
    );

    expect(namespaceConflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "drift",
          key: {
            recordKind: "namespace",
            namespace: "qa.runtime",
          },
          fields: ["ontologyId"],
        }),
      ]),
    );
    expect(await readOntologySnapshot(store, "ontology-a", "v1")).toEqual(
      beforeDuplicate,
    );
    expect(await store.getNamespace("ontology-b")).toBeNull();
    expect(await store.listAllocations("ontology-b", "v1")).toEqual([]);
  });

  it("rejects same-key drift for changed hash, capacity, axis list, prefix, and segment shape", async () => {
    const { store } = await setup();
    const writeSet = buildWriteSet();

    await store.writeAllocationPlan(writeSet);
    const before = await readOntologySnapshot(store, "ontology-a", "v1");
    const drifted = buildWriteSet();
    const runtimeAllocationId = drifted.allocations[0]?.allocationId;
    if (!runtimeAllocationId) {
      throw new Error("test fixture is missing the runtime allocation");
    }

    const conflicts = await expectRejectedConflicts(
      store.writeAllocationPlan({
        ...drifted,
        axes: [
          buildOntologyAxisRecord({
            axisId: "region",
            valuesHash: "fnv1a32:region-v2",
            capacity: 8,
          }),
          drifted.axes[1],
        ],
        taxonomies: [
          buildOntologyTaxonomyRecord({
            taxonomyId: "runtime-surface",
            axisIds: ["region", "env"],
            identityAxisIds: ["region"],
            space: "runtime",
          }),
          drifted.taxonomies[1],
        ],
        allocations: [
          {
            ...drifted.allocations[0],
            prefix: "qa_runtime_surface_v2",
          },
          drifted.allocations[1],
        ],
        segments: [
          buildOntologyAddressSegmentRecord({
            allocationId: runtimeAllocationId,
            segmentId: `${runtimeAllocationId}:product`,
            consumes: ["region"],
            addressOffset: 4,
            addressSize: 12,
          }),
          drifted.segments[1],
        ],
      }),
    );

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "drift",
          key: expect.objectContaining({
            recordKind: "axis",
            axisId: "region",
          }),
          fields: expect.arrayContaining(["valuesHash", "capacity"]),
        }),
        expect.objectContaining({
          code: "drift",
          key: expect.objectContaining({
            recordKind: "taxonomy",
            taxonomyId: "runtime-surface",
          }),
          fields: ["axisIds"],
        }),
        expect.objectContaining({
          code: "drift",
          key: expect.objectContaining({
            recordKind: "allocation",
            allocationId: runtimeAllocationId,
          }),
          fields: ["prefix"],
        }),
        expect.objectContaining({
          code: "drift",
          key: expect.objectContaining({
            recordKind: "segment",
            allocationId: runtimeAllocationId,
          }),
          fields: expect.arrayContaining(["addressOffset", "addressSize"]),
        }),
      ]),
    );
    expect(await readOntologySnapshot(store, "ontology-a", "v1")).toEqual(before);
  });

  it("rejects taxonomy records that reference missing axes and leaves no rows", async () => {
    const context = await setup();
    const writeSet = buildWriteSet();

    const conflicts = await expectRejectedConflicts(
      context.store.writeAllocationPlan({
        ...writeSet,
        axes: [writeSet.axes[0]],
      }),
    );

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-taxonomy-axis",
          ontologyId: "ontology-a",
          taxonomyId: "deployment-surface",
          versionId: "v1",
          axisId: "env",
        }),
      ]),
    );
    await expectEmptyStore(context.store);
    await context.assertNoBackendRows?.();
  });

  it("rejects out-of-range and overlapping segments and leaves no rows", async () => {
    const context = await setup();
    const writeSet = buildWriteSet();

    const conflicts = await expectRejectedConflicts(
      context.store.writeAllocationPlan({
        ...writeSet,
        segments: [
          buildOntologyAddressSegmentRecord({
            allocationId: "ontology-a:runtime-surface:v1",
            segmentId: "runtime-base",
            addressOffset: 0,
            addressSize: 8,
          }),
          buildOntologyAddressSegmentRecord({
            allocationId: "ontology-a:runtime-surface:v1",
            segmentId: "runtime-overlap",
            addressOffset: 7,
            addressSize: 4,
          }),
          buildOntologyAddressSegmentRecord({
            allocationId: "ontology-a:runtime-surface:v1",
            segmentId: "runtime-outside",
            addressOffset: 15,
            addressSize: 2,
          }),
        ],
      }),
    );

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-segment",
          allocationId: "ontology-a:runtime-surface:v1",
          segmentId: "runtime-outside",
          reason: "outside-allocation-range",
        }),
        expect.objectContaining({
          code: "segment-overlap",
          allocationId: "ontology-a:runtime-surface:v1",
          segmentId: "runtime-overlap",
          overlapsWithSegmentId: "runtime-base",
        }),
      ]),
    );
    await expectEmptyStore(context.store);
    await context.assertNoBackendRows?.();
  });
});

interface WriteSetOptions {
  readonly ontologyId?: string;
  readonly namespace?: string;
  readonly prefixSeed?: string;
  readonly versionId?: string;
}

function buildWriteSet(options: WriteSetOptions = {}): OntologyAllocationPlanWriteSet {
  const ontologyId = options.ontologyId ?? "ontology-a";
  const namespace = options.namespace ?? "qa.runtime";
  const prefixSeed = options.prefixSeed ?? "qa";
  const versionId = options.versionId ?? "v1";
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
        axisId: "region",
        versionId,
        values: ["us", "eu"],
        valuesHash: "fnv1a32:region",
        capacity: 4,
      }),
      buildOntologyAxisRecord({
        ontologyId,
        axisId: "env",
        versionId,
        values: ["prod", "stage"],
        valuesHash: "fnv1a32:env",
        capacity: 4,
      }),
    ],
    taxonomies: [
      buildOntologyTaxonomyRecord({
        ontologyId,
        taxonomyId: "runtime-surface",
        versionId,
        appliesTo: ["service"],
        axisIds: ["region"],
        identityAxisIds: ["region"],
        space: "runtime",
      }),
      buildOntologyTaxonomyRecord({
        ontologyId,
        taxonomyId: "deployment-surface",
        versionId,
        appliesTo: ["deployment"],
        axisIds: ["env"],
        identityAxisIds: ["env"],
        space: "deployment",
      }),
    ],
    allocations: [
      buildAllocation({
        allocationId: runtimeAllocationId,
        ontologyId,
        taxonomyId: "runtime-surface",
        prefix: `${prefixSeed}_runtime_surface`,
        versionId,
        capacity: 16,
        addressOffset: 0,
        addressSize: 16,
        status: "reserved",
      }),
      buildAllocation({
        allocationId: deploymentAllocationId,
        ontologyId,
        taxonomyId: "deployment-surface",
        prefix: `${prefixSeed}_deployment_surface`,
        versionId,
        capacity: 8,
        addressOffset: 16,
        addressSize: 8,
        status: "active",
      }),
    ],
    segments: [
      buildOntologyAddressSegmentRecord({
        allocationId: runtimeAllocationId,
        segmentId: `${runtimeAllocationId}:product`,
        consumes: ["region"],
        addressOffset: 0,
        addressSize: 16,
      }),
      buildOntologyAddressSegmentRecord({
        allocationId: deploymentAllocationId,
        segmentId: `${deploymentAllocationId}:product`,
        consumes: ["env"],
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
): Promise<readonly Exclude<OntologyRegistryStoreConflict, { code: "partial-write-rejected" }>[]> {
  let thrown: unknown;
  try {
    await write;
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(OntologyRegistryStoreError);
  const conflict = (thrown as OntologyRegistryStoreError).conflict;
  expect(conflict.code).toBe("partial-write-rejected");
  return conflict.code === "partial-write-rejected" ? conflict.conflicts : [];
}

async function expectEmptyStore(store: OntologyRegistryStore): Promise<void> {
  expect(await store.listNamespaces()).toEqual([]);
  expect(await store.listAxes("ontology-a", "v1")).toEqual([]);
  expect(await store.listTaxonomies("ontology-a", "v1")).toEqual([]);
  expect(await store.listAllocations("ontology-a", "v1")).toEqual([]);
  expect(await store.listActiveAllocations()).toEqual([]);
  expect(await store.listSegments("ontology-a:runtime-surface:v1")).toEqual([]);
  expect(await store.listSegments("ontology-a:deployment-surface:v1")).toEqual([]);
}

async function readOntologySnapshot(
  store: OntologyRegistryStore,
  ontologyId: string,
  versionId: string,
) {
  const allocations = await store.listAllocations(ontologyId, versionId);

  return {
    namespaces: await store.listNamespaces(),
    axes: await store.listAxes(ontologyId, versionId),
    taxonomies: await store.listTaxonomies(ontologyId, versionId),
    allocations,
    activeAllocations: await store.listActiveAllocations(),
    segments: await Promise.all(
      allocations.map(async (allocation) => ({
        allocationId: allocation.allocationId,
        records: await store.listSegments(allocation.allocationId),
      })),
    ),
  };
}

async function expectEmptySqlTables(driver: SqlDriver): Promise<void> {
  const counts = await Promise.all(
    [
      "ontology_namespace",
      "ontology_axis",
      "ontology_taxonomy",
      "ontology_address_allocation",
      "ontology_address_segment",
    ].map(async (tableName) => {
      const row = await driver.queryOne<{ count: number }>(
        `SELECT COUNT(*) AS count FROM ${tableName}`,
      );
      return row?.count ?? 0;
    }),
  );
  expect(counts).toEqual([0, 0, 0, 0, 0]);
}
