// @def.boundary registry-system
// @def.doc registry-system

import { describe, expect, it } from "vitest";

import { InMemoryOntologyRegistryStore } from "./in-memory-ontology-registry-store.js";
import {
  OntologyRegistryStoreError,
  type OntologyAddressAllocationRecord,
  type OntologyAllocationPlanWriteSet,
  type OntologyRegistryStore,
  type OntologyRegistryStoreConflict,
} from "./ontology-registry-store.js";
import {
  buildOntologyAddressAllocationRecord,
  buildOntologyAddressSegmentRecord,
  buildOntologyAxisRecord,
  buildOntologyNamespaceRecord,
  buildOntologyTaxonomyRecord,
} from "./ontology-registry-validation.js";

describe("InMemoryOntologyRegistryStore", () => {
  it("writes and reads namespaces, axes, taxonomies, allocations, active allocations, and segments", async () => {
    const store = new InMemoryOntologyRegistryStore();
    const writeSet = buildWriteSet();

    await store.writeAllocationPlan(writeSet);

    expect(await store.listNamespaces()).toEqual([writeSet.namespace]);
    expect(await store.getNamespace("ontology-a")).toEqual(writeSet.namespace);
    expect(await store.getNamespace("missing")).toBeNull();
    expect((await store.listAxes("ontology-a", "v1")).map((axis) => axis.axisId)).toEqual([
      "env",
      "region",
    ]);
    expect(
      (await store.listTaxonomies("ontology-a", "v1")).map((taxonomy) => taxonomy.taxonomyId),
    ).toEqual(["deployment-surface", "runtime-surface"]);
    expect(
      (await store.listAllocations("ontology-a", "v1")).map(
        (allocation) => allocation.allocationId,
      ),
    ).toEqual(["ontology-a:deployment-surface:v1", "ontology-a:runtime-surface:v1"]);
    expect(await store.getAllocation("ontology-a:deployment-surface:v1")).toEqual(
      writeSet.allocations[1],
    );
    expect(await store.getAllocation("missing")).toBeNull();
    expect(
      (await store.listActiveAllocations()).map((allocation) => allocation.allocationId),
    ).toEqual(["ontology-a:deployment-surface:v1"]);
    expect(await store.listSegments("ontology-a:runtime-surface:v1")).toEqual([
      writeSet.segments[0],
    ]);
    expect(await store.listSegments("missing")).toEqual([]);
  });

  it("returns defensive copies for array-backed records", async () => {
    const store = new InMemoryOntologyRegistryStore();
    await store.writeAllocationPlan(buildWriteSet());

    const [axis] = await store.listAxes("ontology-a", "v1");
    const [taxonomy] = await store.listTaxonomies("ontology-a", "v1");
    const [segment] = await store.listSegments("ontology-a:runtime-surface:v1");

    (axis.values as string[]).push("apac");
    (taxonomy.axisIds as string[]).push("mutated-axis");
    (segment.consumes as string[]).push("mutated-consume");

    expect(
      (await store.listAxes("ontology-a", "v1")).find((item) => item.axisId === axis.axisId)
        ?.values,
    ).not.toContain("apac");
    expect(
      (await store.listTaxonomies("ontology-a", "v1")).find(
        (item) => item.taxonomyId === taxonomy.taxonomyId,
      )?.axisIds,
    ).not.toContain("mutated-axis");
    expect((await store.listSegments("ontology-a:runtime-surface:v1"))[0]?.consumes).not.toContain(
      "mutated-consume",
    );
  });

  it("rejects a repeated plan as duplicate keys and leaves existing rows unchanged", async () => {
    const store = new InMemoryOntologyRegistryStore();
    const writeSet = buildWriteSet();
    await store.writeAllocationPlan(writeSet);
    const before = await readOntologySnapshot(store, "ontology-a", "v1");

    const conflicts = await expectRejectedConflicts(store.writeAllocationPlan(writeSet));

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "duplicate-key",
          key: {
            recordKind: "namespace",
            ontologyId: "ontology-a",
          },
        }),
      ]),
    );
    expect(await readOntologySnapshot(store, "ontology-a", "v1")).toEqual(before);
  });

  it("rejects namespace uniqueness drift and leaves the attempted ontology unwritten", async () => {
    const store = new InMemoryOntologyRegistryStore();
    await store.writeAllocationPlan(buildWriteSet());

    const conflicts = await expectRejectedConflicts(
      store.writeAllocationPlan(
        buildWriteSet({
          ontologyId: "ontology-b",
          namespace: "qa.runtime",
          prefixSeed: "qb",
        }),
      ),
    );

    expect(conflicts).toEqual(
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
    expect(await store.getNamespace("ontology-b")).toBeNull();
    expect(await store.listAllocations("ontology-b", "v1")).toEqual([]);
  });

  it("rejects exact duplicate row keys inside one write set and keeps the store empty", async () => {
    const store = new InMemoryOntologyRegistryStore();
    const writeSet = buildWriteSet();

    const conflicts = await expectRejectedConflicts(
      store.writeAllocationPlan({
        ...writeSet,
        axes: [...writeSet.axes, writeSet.axes[0]],
        taxonomies: [...writeSet.taxonomies, writeSet.taxonomies[0]],
        allocations: [...writeSet.allocations, writeSet.allocations[0]],
        segments: [...writeSet.segments, writeSet.segments[0]],
      }),
    );

    expect(conflicts).toEqual(
      expect.arrayContaining([
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
    await expectEmptyStore(store);
  });

  it("rejects natural-key drift for axes, taxonomies, allocations, and segments", async () => {
    const store = new InMemoryOntologyRegistryStore();
    await store.writeAllocationPlan(buildWriteSet());
    const before = await readOntologySnapshot(store, "ontology-a", "v1");
    const drifted = buildWriteSet();

    const conflicts = await expectRejectedConflicts(
      store.writeAllocationPlan({
        ...drifted,
        axes: [
          buildOntologyAxisRecord({
            axisId: "region",
            capacity: 8,
            valuesHash: "fnv1a32:region-v2",
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
            addressSize: 20,
          },
          drifted.allocations[1],
        ],
        segments: [
          buildOntologyAddressSegmentRecord({
            allocationId: "ontology-a:runtime-surface:v1",
            segmentId: "ontology-a:runtime-surface:v1:product",
            consumes: ["region", "env"],
            addressOffset: 0,
            addressSize: 16,
          }),
          drifted.segments[1],
        ],
      }),
    );

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "drift",
          key: expect.objectContaining({ recordKind: "axis" }),
          fields: expect.arrayContaining(["valuesHash", "capacity"]),
        }),
        expect.objectContaining({
          code: "drift",
          key: expect.objectContaining({ recordKind: "taxonomy" }),
          fields: ["axisIds"],
        }),
        expect.objectContaining({
          code: "drift",
          key: expect.objectContaining({ recordKind: "allocation" }),
          fields: ["addressSize"],
        }),
        expect.objectContaining({
          code: "drift",
          key: expect.objectContaining({ recordKind: "segment" }),
          fields: ["consumes"],
        }),
      ]),
    );
    expect(await readOntologySnapshot(store, "ontology-a", "v1")).toEqual(before);
  });

  it("rejects taxonomy records whose axis references are missing and keeps the store empty", async () => {
    const store = new InMemoryOntologyRegistryStore();
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
          code: "missing-taxonomy-axis",
          ontologyId: "ontology-a",
          taxonomyId: "deployment-surface",
          versionId: "v1",
          axisId: "env",
        }),
      ]),
    );
    await expectEmptyStore(store);
  });

  it("rejects invalid, out-of-range, and overlapping segments without partial writes", async () => {
    const store = new InMemoryOntologyRegistryStore();
    const writeSet = buildWriteSet();

    const conflicts = await expectRejectedConflicts(
      store.writeAllocationPlan({
        ...writeSet,
        segments: [
          buildOntologyAddressSegmentRecord({
            allocationId: "missing-allocation",
            segmentId: "missing-allocation:segment",
            addressOffset: 0,
            addressSize: 4,
          }),
          buildOntologyAddressSegmentRecord({
            allocationId: "ontology-a:runtime-surface:v1",
            segmentId: "runtime-empty-consumes",
            consumes: [],
            addressOffset: 0,
            addressSize: 4,
          }),
          buildOntologyAddressSegmentRecord({
            allocationId: "ontology-a:runtime-surface:v1",
            segmentId: "runtime-non-positive",
            addressOffset: 0,
            addressSize: 0,
          }),
          buildOntologyAddressSegmentRecord({
            allocationId: "ontology-a:runtime-surface:v1",
            segmentId: "runtime-negative",
            addressOffset: -1,
            addressSize: 4,
          }),
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
          segmentId: "missing-allocation:segment",
          reason: "missing-allocation",
        }),
        expect.objectContaining({
          code: "invalid-segment",
          segmentId: "runtime-empty-consumes",
          reason: "empty-consumes",
        }),
        expect.objectContaining({
          code: "invalid-segment",
          segmentId: "runtime-non-positive",
          reason: "non-positive-size",
        }),
        expect.objectContaining({
          code: "invalid-segment",
          segmentId: "runtime-negative",
          reason: "negative-offset",
        }),
        expect.objectContaining({
          code: "invalid-segment",
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
    await expectEmptyStore(store);
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
