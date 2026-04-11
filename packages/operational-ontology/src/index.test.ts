import { describe, expect, it } from "vitest";
import type {
  DataSchema,
  EventRecord,
  FieldLineage,
  NonLinearPathObservation,
  PipeGraph,
} from "@qa-sdk/core";

import {
  type ObservationTopologyTemplateRegistry,
  type CorridorTemplateRegistry,
  type CheckpointTemplateRegistry,
  projectEventRecordToOperationalOntology,
  projectLineageToOperationalOntology,
  projectOperationalOntologySnapshot,
  projectPathObservationToOperationalOntology,
  projectPipeGraphToOperationalOntology,
} from "./index.js";
import { operationalOntologySchemaPlane } from "./schema.js";
import { operationalOntologyLineagePlane } from "./lineage.js";
import { operationalOntologyCorridorPlane } from "./corridor.js";
import { operationalOntologyJunctionPlane } from "./junction.js";
import { operationalOntologyCheckpointPlane } from "./checkpoint.js";
import { operationalOntologyTopologyPlane } from "./topology.js";
import { operationalOntologyProjectors } from "./projectors.js";
import { operationalOntologyImplementationGovernancePlane } from "./governance.js";
import {
  diffOperationalOntologyCorridor,
  diffOperationalOntologySnapshots,
  ingestOperationalOntologyProjection,
  ingestEventRecordProjection,
  ingestPipeGraphProjection,
  InMemoryOperationalOntologyStore,
  listOperationalOntologyCheckpointLatticesByScope,
  listOperationalOntologyCorridorViewsByScope,
  listOperationalOntologyCorridorsByScope,
  listOperationalOntologySnapshotProjections,
  listOperationalOntologySnapshotViewsByScope,
  listOperationalOntologyTraversalBundlesByScope,
  loadLatestOperationalOntologyCorridorViewByScope,
  loadOperationalOntologyCheckpointLattices,
  loadOperationalOntologyCorridorView,
  loadOperationalOntologyCorridors,
  loadLatestOperationalOntologySnapshotViewByScope,
  loadOperationalOntologySnapshot,
  loadOperationalOntologySnapshotView,
  loadOperationalOntologyTraversalBundles,
  operationalOntologyPersistencePlane,
  persistOperationalOntologySnapshot,
} from "./persistence.js";
import { createNodeCoord } from "./runtime.js";
import { InMemoryOperationalOntologySchemaRegistry } from "./schema.js";
import { projectEventRecordToOperationalOntology as projectEventRecordProjectorOnly } from "./projectors-event.js";
import { projectPipeGraphToOperationalOntology as projectPipeGraphProjectorOnly } from "./projectors-pipe.js";
import { projectPathObservationToOperationalOntology as projectPathProjectorOnly } from "./projectors-path.js";
import { projectOperationalOntologySnapshot as projectSnapshotProjectorOnly } from "./projectors-snapshot.js";

describe("submodule facades", () => {
  it("exposes plane-specific public surfaces", () => {
    expect(typeof operationalOntologySchemaPlane.validateOperationalOntologySchema).toBe("function");
    expect(typeof operationalOntologyLineagePlane.projectLineageToOperationalOntology).toBe("function");
    expect(typeof operationalOntologyCorridorPlane.validateCorridorAgainstTemplate).toBe("function");
    expect(typeof operationalOntologyJunctionPlane.defaultJunctionTemplateRegistry.get).toBe("function");
    expect(typeof operationalOntologyCheckpointPlane.defaultCheckpointTemplateRegistry.get).toBe("function");
    expect(typeof operationalOntologyTopologyPlane.validateObservationTopologyAgainstTemplate).toBe("function");
    expect(typeof operationalOntologyProjectors.projectOperationalOntologySnapshot).toBe("function");
    expect(typeof operationalOntologyImplementationGovernancePlane.evaluateImplementationGovernance).toBe(
      "function",
    );
    expect(typeof operationalOntologyImplementationGovernancePlane.validateImplementationGovernanceTaxonomy).toBe(
      "function",
    );
    expect(typeof operationalOntologyImplementationGovernancePlane.validateImplementationBlueprint).toBe(
      "function",
    );
    expect(typeof operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceBlueprint).toBe(
      "function",
    );
    expect(typeof operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceRun).toBe(
      "function",
    );
    expect(typeof operationalOntologyPersistencePlane.validateFacetKindsForObjectKind).toBe("function");
    expect(typeof projectEventRecordProjectorOnly).toBe("function");
    expect(typeof projectPipeGraphProjectorOnly).toBe("function");
    expect(typeof projectPathProjectorOnly).toBe("function");
    expect(typeof projectSnapshotProjectorOnly).toBe("function");

    expect(
      createNodeCoord({
        realm: "software",
        space: "delivery",
        anchor: "checkout",
        taxonomies: {},
      }),
    ).toEqual({
      realm: "software",
      space: "delivery",
      anchor: "checkout",
      taxonomies: {},
      canonicalKey: "node:software/delivery/checkout",
    });
  });
});

describe("implementation governance evaluator", () => {
  const schema = {
    axes: [
      {
        id: "facet_role",
        values: ["definition", "production", "consumption"],
      },
    ],
    taxonomies: [
      {
        id: "information-role",
        appliesTo: ["node"],
        axisIds: ["facet_role"],
      },
    ],
    relationCategories: [
      {
        category: "flow",
        requiredAxes: ["facet_role"],
      },
    ],
  };

  it("validates the finite governance taxonomy interface", () => {
    expect(
      operationalOntologyImplementationGovernancePlane.validateImplementationGovernanceTaxonomy(),
    ).toEqual({ valid: true, issues: [] });

    expect(
      operationalOntologyImplementationGovernancePlane.validateImplementationGovernanceTaxonomy({
        taxonomyId: "broken-governance",
        unitKinds: ["corridor_bundle", "corridor_bundle"],
        implementationSurfaceKinds: ["code"],
        verificationSurfaceKinds: ["test"],
        constraintKinds: ["unit_boundary"],
        constraintSeverities: ["core"],
        adjustmentActions: ["defer"],
        evolutionPolicies: ["append_only"],
      }),
    ).toEqual(
      expect.objectContaining({
        valid: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "governance-axis-duplicate" }),
        ]),
      }),
    );
  });

  it("passes when implementation and verification bindings match the same coordinate", () => {
    const result = operationalOntologyImplementationGovernancePlane.evaluateImplementationGovernance({
      schema,
      blueprint: {
        blueprintId: "event-ingest-governance",
        coordinateRef: "corridor:event-ingest",
        unitKind: "corridor_bundle",
        requiredSchemas: ["information-role", "flow"],
        implementationBinding: {
          coordinateRef: "corridor:event-ingest",
          implementationRefs: [
            { kind: "code", ref: "packages/operational-ontology/src/internal/event-projector.ts" },
          ],
          facets: ["identity", "route"],
          relationCategories: ["flow"],
        },
        verificationBinding: {
          coordinateRef: "corridor:event-ingest",
          verificationRefs: [{ kind: "test", ref: "packages/operational-ontology/src/index.test.ts" }],
        },
        constraints: [
          { kind: "unit_boundary", severity: "core" },
          { kind: "required_facets", requiredRefs: ["identity", "route"] },
          { kind: "allowed_relations", allowedRefs: ["flow"] },
          { kind: "validation_surface", requiredRefs: ["test"] },
        ],
        evolutionPolicy: { kind: "append_only" },
      },
    });

    expect(result.valid).toBe(true);
    expect(result.verdicts).toEqual([]);
    expect(result.governanceRun.familyKey).toBe("governance:corridor:event-ingest:corridor_bundle");
  });

  it("validates blueprint contracts before runtime binding evaluation", () => {
    const result = operationalOntologyImplementationGovernancePlane.validateImplementationBlueprint({
      schema,
      blueprint: {
        blueprintId: "event-ingest-governance",
        coordinateRef: "corridor:event-ingest",
        unitKind: "corridor_bundle",
        requiredSchemas: ["information-role"],
        constraints: [{ kind: "unit_boundary" }],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.verdicts).toEqual([]);
  });

  it("suggests defer when verification binding is missing", () => {
    const result = operationalOntologyImplementationGovernancePlane.evaluateImplementationGovernance({
      blueprint: {
        blueprintId: "checkpoint-governance",
        coordinateRef: "checkpoint:event-ingest",
        unitKind: "checkpoint_lattice",
        implementationBinding: {
          coordinateRef: "checkpoint:event-ingest",
          implementationRefs: [{ kind: "runtime_projection", ref: "checkpoint:lattice" }],
        },
      },
    });

    expect(result.valid).toBe(false);
    expect(result.verdicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "verification-binding-missing" }),
      ]),
    );
    expect(result.adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "defer",
          constraintKind: "validation_surface",
          proposedChange: "Defer validation_surface completion to a follow-up governance run",
          requiresDecision: false,
        }),
      ]),
    );
  });

  it("fails closed when required schemas are declared without a schema registry", () => {
    const result = operationalOntologyImplementationGovernancePlane.evaluateImplementationGovernance({
      blueprint: {
        blueprintId: "schema-bound-governance",
        coordinateRef: "corridor:event-ingest",
        unitKind: "corridor_bundle",
        requiredSchemas: ["information-role"],
        implementationBinding: {
          coordinateRef: "corridor:event-ingest",
          implementationRefs: [{ kind: "code", ref: "src/event-projector.ts" }],
        },
        verificationBinding: {
          coordinateRef: "corridor:event-ingest",
          verificationRefs: [{ kind: "test", ref: "src/event-projector.test.ts" }],
        },
      },
    });

    expect(result.valid).toBe(false);
    expect(result.verdicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "required-schema-registry-missing" }),
      ]),
    );
    expect(result.adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "escalate",
          constraintKind: "unit_boundary",
          requiresDecision: true,
        }),
      ]),
    );
  });

  it("escalates core coordinate mismatches", () => {
    const result = operationalOntologyImplementationGovernancePlane.evaluateImplementationGovernance({
      blueprint: {
        blueprintId: "route-governance",
        coordinateRef: "traversal:observe",
        unitKind: "traversal_bundle",
        implementationBinding: {
          coordinateRef: "traversal:implement",
          implementationRefs: [{ kind: "code", ref: "src/traversal.ts" }],
        },
        verificationBinding: {
          coordinateRef: "traversal:observe",
          verificationRefs: [{ kind: "simulation", ref: "simulation:observe-route" }],
        },
        constraints: [{ kind: "unit_boundary", severity: "core" }],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "escalate", constraintKind: "unit_boundary" }),
      ]),
    );
  });

  it("rejects implementation bindings outside the governance taxonomy", () => {
    const result = operationalOntologyImplementationGovernancePlane.evaluateImplementationGovernance({
      blueprint: {
        blueprintId: "unknown-surface-governance",
        coordinateRef: "corridor:event-ingest",
        unitKind: "unknown_unit",
        implementationBinding: {
          coordinateRef: "corridor:event-ingest",
          implementationRefs: [{ kind: "spreadsheet" as never, ref: "sheet:manual-map" }],
        },
        verificationBinding: {
          coordinateRef: "corridor:event-ingest",
          verificationRefs: [{ kind: "test", ref: "packages/operational-ontology/src/index.test.ts" }],
        },
      },
    });

    expect(result.valid).toBe(false);
    expect(result.verdicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "governance-unit-kind-unknown" }),
        expect.objectContaining({ code: "implementation-surface-kind-unknown" }),
      ]),
    );
    expect(result.adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "escalate" }),
      ]),
    );
  });

  it("requires an evaluator for custom governance constraints", () => {
    const blueprint = {
      blueprintId: "custom-governance",
      coordinateRef: "corridor:event-ingest",
      unitKind: "corridor_bundle",
      implementationBinding: {
        coordinateRef: "corridor:event-ingest",
        implementationRefs: [{ kind: "code", ref: "src/event-projector.ts" }],
      },
      verificationBinding: {
        coordinateRef: "corridor:event-ingest",
        verificationRefs: [{ kind: "test", ref: "src/event-projector.test.ts" }],
      },
      constraints: [{ kind: "security_review" }],
    };
    const taxonomy = {
      taxonomyId: "custom-governance",
      unitKinds: ["corridor_bundle"],
      implementationSurfaceKinds: ["code"],
      verificationSurfaceKinds: ["test"],
      constraintKinds: ["unit_boundary", "security_review"],
      constraintSeverities: ["core", "required"],
      adjustmentActions: ["escalate", "manual_review"],
      evolutionPolicies: ["append_only"],
    };

    const missingEvaluator = operationalOntologyImplementationGovernancePlane.evaluateImplementationGovernance({
      blueprint,
      taxonomy,
    });
    const customEvaluator = operationalOntologyImplementationGovernancePlane.evaluateImplementationGovernance({
      blueprint,
      taxonomy,
      constraintEvaluators: {
        security_review: () => [],
      },
    });

    expect(missingEvaluator.valid).toBe(false);
    expect(missingEvaluator.verdicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unsupported-constraint-evaluator" }),
      ]),
    );
    expect(customEvaluator.valid).toBe(true);
  });

  it("uses runtime override bindings without validating stale blueprint bindings", () => {
    const result = operationalOntologyImplementationGovernancePlane.evaluateImplementationGovernance({
      blueprint: {
        blueprintId: "override-governance",
        coordinateRef: "corridor:event-ingest",
        unitKind: "corridor_bundle",
        implementationBinding: {
          coordinateRef: "corridor:event-ingest",
          implementationRefs: [{ kind: "spreadsheet" as never, ref: "sheet:old-binding" }],
        },
      },
      implementationBinding: {
        coordinateRef: "corridor:event-ingest",
        implementationRefs: [{ kind: "code", ref: "src/event-projector.ts" }],
      },
      verificationBinding: {
        coordinateRef: "corridor:event-ingest",
        verificationRefs: [{ kind: "test", ref: "src/event-projector.test.ts" }],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.verdicts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "implementation-surface-kind-unknown" }),
      ]),
    );
  });
});

describe("in-memory adapters", () => {
  it("validates schema replacement in the in-memory schema registry", () => {
    const registry = new InMemoryOperationalOntologySchemaRegistry();

    const validation = registry.replace({
      axes: [
        {
          id: "facet_role",
          values: ["definition", "production"],
          capacity: 4,
        },
      ],
      taxonomies: [
        {
          id: "information-role",
          appliesTo: ["node"],
          axisIds: ["facet_role"],
          identityAxisIds: ["facet_role"],
        },
      ],
      relationCategories: [
        {
          category: "flows_to",
          requiredAxes: ["facet_role"],
        },
      ],
      traversals: [
        {
          purpose: "observe",
          allowedRelationCategories: ["flows_to"],
          canonicalizable: true,
        },
      ],
    });

    expect(validation.valid).toBe(true);
    expect(registry.get("flows_to")).toEqual(
      expect.objectContaining({ category: "flows_to" }),
    );
    expect(registry.getAxis("facet_role")).toEqual(
      expect.objectContaining({ id: "facet_role" }),
    );

    expect(() =>
      registry.replace({
        axes: [],
        taxonomies: [
          {
            id: "broken",
            appliesTo: ["node"],
            axisIds: ["missing_axis"],
          },
        ],
        relationCategories: [],
      }),
    ).toThrow(/Operational ontology schema is invalid/);
  });

  it("stores validated objects/facets/observations in the in-memory persistence store", async () => {
    const store = new InMemoryOperationalOntologyStore();

    await store.upsertObject({
      objectId: "node:checkout",
      objectKind: "node",
      canonicalKey: "node:software/delivery/checkout",
      schemaVersion: "v1",
      lifecycle: "active",
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    });

    await store.putFacet({
      objectId: "node:checkout",
      facetKind: "identity",
      version: "v1",
      payloadJson: {
        realm: "software",
        space: "delivery",
        anchor: "checkout",
        canonicalKey: "node:software/delivery/checkout",
      },
      recordedAt: "2026-04-10T00:00:01.000Z",
    });

    await store.putFacet({
      objectId: "node:checkout",
      facetKind: "semantic",
      version: "v1",
      payloadJson: {
        summary: "Checkout delivery node",
      },
      recordedAt: "2026-04-10T00:00:02.000Z",
    });

    await store.appendObservation({
      observationId: "obs-1",
      targetObjectId: "node:checkout",
      observationKind: "node_observed",
      payloadJson: { seen: true },
      observedAt: "2026-04-10T00:00:03.000Z",
    });

    const bundle = await store.getObjectBundle("node:checkout");
    expect(bundle).not.toBeNull();
    expect(bundle?.facetValidation.valid).toBe(true);
    expect(bundle?.payloadValidations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          facetKind: "identity",
          validation: expect.objectContaining({ valid: true }),
        }),
      ]),
    );

    await expect(
      store.putFacet({
        objectId: "node:checkout",
        facetKind: "grammar",
        version: "v1",
        payloadJson: {},
        recordedAt: "2026-04-10T00:00:04.000Z",
      }),
    ).rejects.toThrow(/not allowed/);

    await expect(
      store.putFacet({
        objectId: "node:checkout",
        facetKind: "identity",
        version: "v2",
        payloadJson: {
          realm: "software",
          space: "delivery",
          anchor: "checkout",
        },
        recordedAt: "2026-04-10T00:00:05.000Z",
      }),
    ).rejects.toThrow(/Invalid payload shape/);
  });

  it("stores governance blueprints and run evidence as first-class bundles", async () => {
    const store = new InMemoryOperationalOntologyStore();

    await store.upsertObject({
      objectId: "governance-blueprint:event-ingest",
      objectKind: "governance_blueprint",
      canonicalKey: "governance-blueprint:corridor:event-ingest",
      schemaVersion: "v1",
      lifecycle: "active",
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    });

    await store.putFacet({
      objectId: "governance-blueprint:event-ingest",
      facetKind: "schema",
      version: "v1",
      payloadJson: {
        blueprint: {
          blueprintId: "event-ingest-governance",
          coordinateRef: "corridor:event-ingest",
          unitKind: "corridor_bundle",
        },
      },
      recordedAt: "2026-04-10T00:00:01.000Z",
    });

    await store.putFacet({
      objectId: "governance-blueprint:event-ingest",
      facetKind: "validation",
      version: "v1",
      payloadJson: { valid: true, issues: [] },
      recordedAt: "2026-04-10T00:00:02.000Z",
    });

    await store.upsertObject({
      objectId: "governance-run:event-ingest:1",
      objectKind: "governance_run",
      canonicalKey: "governance-run:corridor:event-ingest:1",
      schemaVersion: "v1",
      lifecycle: "active",
      createdAt: "2026-04-10T00:00:03.000Z",
      updatedAt: "2026-04-10T00:00:03.000Z",
    });

    await store.putFacet({
      objectId: "governance-run:event-ingest:1",
      facetKind: "evidence",
      version: "v1",
      payloadJson: {
        implementationRefs: ["src/event-projector.ts"],
        verificationRefs: ["src/event-projector.test.ts"],
        constraintVerdicts: [],
      },
      recordedAt: "2026-04-10T00:00:04.000Z",
    });

    await store.putFacet({
      objectId: "governance-run:event-ingest:1",
      facetKind: "status",
      version: "v1",
      payloadJson: { state: "passed" },
      recordedAt: "2026-04-10T00:00:05.000Z",
    });

    const blueprintBundle = await store.getObjectBundle("governance-blueprint:event-ingest");
    const runBundle = await store.getObjectBundle("governance-run:event-ingest:1");

    expect(blueprintBundle?.facetValidation.valid).toBe(true);
    expect(runBundle?.facetValidation.valid).toBe(true);
  });

  it("persists implementation governance blueprints through the governance helper", async () => {
    const store = new InMemoryOperationalOntologyStore();

    const persisted = await operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceBlueprint(
      store,
      {
        blueprintId: "event-ingest-governance",
        coordinateRef: "corridor:event-ingest",
        unitKind: "corridor_bundle",
        constraints: [{ kind: "unit_boundary" }],
      },
      { now: "2026-04-10T00:00:06.000Z" },
    );

    const bundle = await store.getObjectBundle(persisted.objectId);

    expect(bundle?.object.objectKind).toBe("governance_blueprint");
    expect(bundle?.facetValidation.valid).toBe(true);
    expect(bundle?.payloadValidations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          facetKind: "schema",
          validation: expect.objectContaining({ valid: true }),
        }),
        expect.objectContaining({
          facetKind: "validation",
          validation: expect.objectContaining({ valid: true }),
        }),
      ]),
    );
  });

  it("rejects invalid governance blueprint persistence unless explicitly allowed", async () => {
    const store = new InMemoryOperationalOntologyStore();
    const governanceSchema = {
      axes: [
        {
          id: "facet_role",
          values: ["definition", "production", "consumption"],
        },
      ],
      taxonomies: [
        {
          id: "information-role",
          appliesTo: ["node"],
          axisIds: ["facet_role"],
        },
      ],
      relationCategories: [
        {
          category: "flow",
          requiredAxes: ["facet_role"],
        },
      ],
    };
    const blueprint = {
      blueprintId: "schema-bound-governance",
      coordinateRef: "corridor:event-ingest",
      unitKind: "corridor_bundle",
      requiredSchemas: ["missing-schema"],
    };

    await expect(
      operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceBlueprint(
        store,
        blueprint,
        { now: "2026-04-10T00:00:06.000Z", schema: governanceSchema },
      ),
    ).rejects.toThrow(/Cannot persist invalid implementation governance blueprint/);

    const persisted = await operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceBlueprint(
      store,
      blueprint,
      { now: "2026-04-10T00:00:07.000Z", schema: governanceSchema, allowInvalid: true },
    );
    const object = await store.findObjectById(persisted.objectId);

    expect(object?.lifecycle).toBe("draft");
  });

  it("persists implementation governance run results through the governance helper", async () => {
    const store = new InMemoryOperationalOntologyStore();
    const evaluation = operationalOntologyImplementationGovernancePlane.evaluateImplementationGovernance({
      blueprint: {
        blueprintId: "event-ingest-governance",
        coordinateRef: "corridor:event-ingest",
        unitKind: "corridor_bundle",
        implementationBinding: {
          coordinateRef: "corridor:event-ingest",
          implementationRefs: [{ kind: "code", ref: "src/event-projector.ts" }],
        },
        verificationBinding: {
          coordinateRef: "corridor:event-ingest",
          verificationRefs: [{ kind: "test", ref: "src/event-projector.test.ts" }],
        },
        constraints: [{ kind: "unit_boundary" }],
      },
      runId: "governance-run:event-ingest:helper",
    });

    const persisted = await operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceRun(
      store,
      evaluation.governanceRun,
      { now: "2026-04-10T00:00:06.000Z" },
    );

    const bundle = await store.getObjectBundle(persisted.objectId);
    const observations = await store.listObservations({
      observationKind: "governance_evaluated",
    });

    expect(bundle?.object.objectKind).toBe("governance_run");
    expect(bundle?.facetValidation.valid).toBe(true);
    expect(observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetObjectId: persisted.objectId,
          observationKind: "governance_evaluated",
        }),
      ]),
    );
  });

  it("preserves governance run createdAt when persisting the same run again", async () => {
    const store = new InMemoryOperationalOntologyStore();
    const evaluation = operationalOntologyImplementationGovernancePlane.evaluateImplementationGovernance({
      blueprint: {
        blueprintId: "event-ingest-governance",
        coordinateRef: "corridor:event-ingest",
        unitKind: "corridor_bundle",
        implementationBinding: {
          coordinateRef: "corridor:event-ingest",
          implementationRefs: [{ kind: "code", ref: "src/event-projector.ts" }],
        },
        verificationBinding: {
          coordinateRef: "corridor:event-ingest",
          verificationRefs: [{ kind: "test", ref: "src/event-projector.test.ts" }],
        },
      },
      runId: "governance-run:event-ingest:stable-created-at",
    });

    await operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceRun(
      store,
      evaluation.governanceRun,
      { now: "2026-04-10T00:00:06.000Z" },
    );
    await operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceRun(
      store,
      evaluation.governanceRun,
      { now: "2026-04-10T00:00:07.000Z" },
    );

    const object = await store.findObjectById("governance-run:event-ingest:stable-created-at");
    const facets = await store.listFacets("governance-run:event-ingest:stable-created-at");

    expect(object?.createdAt).toBe("2026-04-10T00:00:06.000Z");
    expect(object?.updatedAt).toBe("2026-04-10T00:00:07.000Z");
    expect(facets.filter((facet) => facet.facetKind === "evidence")).toHaveLength(2);
    expect(facets.filter((facet) => facet.facetKind === "aggregate")).toHaveLength(2);
  });

  it("persists and reloads runtime snapshots through the persistence helper", async () => {
    const store = new InMemoryOperationalOntologyStore();
    const snapshot = {
      topologyTemplateKind: "runtime_snapshot" as const,
      topologyTemplateDescription: "Snapshot topology",
      topologyValidation: {
        valid: true,
        corridorCount: 1,
        maxCheckpointLatticeDepth: 2,
        missingCorridorKinds: [],
        missingJunctionTemplateKinds: [],
        missingCheckpointTemplateKinds: [],
        missingCheckpointLattices: false,
        missingRouteDecisions: false,
        missingTraversals: false,
        tooFewCorridors: false,
        tooManyCorridors: false,
        checkpointDepthTooShallow: false,
        routeDecisionsMissingRefs: [],
        checkpointsMissingCorridor: [],
      },
      corridors: [
        {
          flowId: "corridor:checkout",
          templateKind: "pipe_graph" as const,
          entryNodeId: "collect-order",
          nodeIds: ["collect-order", "persist-order"],
          schemaIds: [],
          endpoints: [],
          contracts: [],
          links: [],
        },
      ],
      controlFlows: [],
      checkpoints: [
        {
          checkpointId: "checkpoint:checkout",
          templateKind: "root" as const,
          recordId: "log-1",
          traceId: "trace-1",
          eventKey: "order.submit",
          timestamp: "2026-04-10T00:00:00.000Z",
          corridorId: "corridor:checkout",
          observedNodeKeys: ["collect-order"],
          observedEdgeKeys: [],
          transmissions: [],
          dataFlow: {
            flowId: "corridor:checkout",
            templateKind: "pipe_graph" as const,
            entryNodeId: "collect-order",
            nodeIds: ["collect-order", "persist-order"],
            schemaIds: [],
            endpoints: [],
            contracts: [],
            links: [],
          },
        },
      ],
      checkpointLattices: [
        {
          corridorId: "corridor:checkout",
          rootCheckpointId: "checkpoint:checkout",
          definitions: [
            {
              checkpointId: "checkpoint:checkout",
              templateKind: "root" as const,
              nodeId: "collect-order",
              observedPrefixIds: [],
              observedFields: [],
            },
          ],
          observations: [
            {
              checkpointId: "checkpoint:checkout",
              templateKind: "root" as const,
              recordId: "log-1",
              traceId: "trace-1",
              eventKey: "order.submit",
              timestamp: "2026-04-10T00:00:00.000Z",
              corridorId: "corridor:checkout",
              observedNodeKeys: ["collect-order"],
              observedEdgeKeys: [],
              transmissions: [],
              dataFlow: {
                flowId: "corridor:checkout",
                templateKind: "pipe_graph" as const,
                entryNodeId: "collect-order",
                nodeIds: ["collect-order", "persist-order"],
                schemaIds: [],
                endpoints: [],
                contracts: [],
                links: [],
              },
            },
          ],
          links: [],
        },
      ],
      junctions: [],
      routeDecisions: [],
      traversals: [
        {
          traversal: {
            purpose: "observe",
            start: "collect-order",
            edges: ["edge:collect-order->pipe_connection:next->persist-order"],
            end: "persist-order",
            canonicalKey:
              "traversal:observe:collect-order->edge:collect-order->pipe_connection:next->persist-order->persist-order",
          },
          reachedGoalIds: ["persisted"],
          unreachableGoalIds: [],
          loopDetected: false,
          recoveryUsed: false,
          terminalNodeId: "persist-order",
          terminalReason: null,
        },
      ],
      transmissions: [],
      lineageLinks: [],
      observedNodeKeys: ["collect-order"],
      observedEdgeKeys: [],
    };

    const persisted = await persistOperationalOntologySnapshot(store, snapshot, {
      snapshotId: "snapshot:test",
      builtAt: "2026-04-10T00:00:10.000Z",
    });

    expect(persisted.snapshotProjection.projectionId).toBe("snapshot:test");
    expect(persisted.subProjectionIds).toEqual(
      expect.arrayContaining([
        "snapshot:test:corridor:corridor:checkout",
        "snapshot:test:checkpoint-lattice:checkpoint:checkout",
      ]),
    );
    expect(persisted.traversalObjectIds).toEqual([
      "traversal:observe:collect-order->edge:collect-order->pipe_connection:next->persist-order->persist-order",
    ]);

    const loaded = await loadOperationalOntologySnapshot(store, "snapshot:test");
    expect(loaded).toEqual(snapshot);

    const traversalBundle = await store.getObjectBundle(
      "traversal:observe:collect-order->edge:collect-order->pipe_connection:next->persist-order->persist-order",
    );
    expect(traversalBundle?.facetValidation.valid).toBe(true);
    expect(traversalBundle?.observations).toEqual([
      expect.objectContaining({
        observationKind: "traversal_observed",
      }),
    ]);
  });

  it("ingests projection input into snapshot + store in one step", async () => {
    const store = new InMemoryOperationalOntologyStore();
    const result = await ingestOperationalOntologyProjection(
      store,
      {
        graph: {
          graphId: "checkout",
          version: "v1",
          entryPipeId: "collect-order",
          pipes: [
            {
              pipeId: "collect-order",
              version: "v1",
              trigger: { eventKey: "order.submit" },
              flow: { kind: "step", facet: "produced" },
            },
          ],
          connections: [],
        },
        record: {
          log_id: "log-2",
          timestamp: "2026-04-10T00:01:00.000Z",
          record_kind: "log",
          trace_id: "trace-2",
          span_id: "span-2",
          event_key: "order.submit",
          event_version: "v1",
          payload_format: "json",
          payload_encoding: "identity",
          payload_masking_applied: false,
          payload_masked_fields: [],
          payload: {
            orderId: "ord_2",
          },
          address_context: {},
        },
      },
      {
        snapshotId: "snapshot:ingest",
        builtAt: "2026-04-10T00:01:10.000Z",
      },
    );

    expect(result.snapshot.corridors).toHaveLength(2);
    expect(result.persisted.snapshotProjection.projectionId).toBe("snapshot:ingest");

    const loaded = await loadOperationalOntologySnapshot(store, "snapshot:ingest");
    expect(loaded).toEqual(result.snapshot);

    const snapshotProjections = await listOperationalOntologySnapshotProjections(store);
    expect(snapshotProjections.map((projection) => projection.projectionId)).toContain(
      "snapshot:ingest",
    );

    const view = await loadOperationalOntologySnapshotView(store, "snapshot:ingest");
    expect(view).not.toBeNull();
    expect(view?.snapshot).toEqual(result.snapshot);
    expect(view?.corridors).toEqual(result.snapshot.corridors);
    expect(view?.checkpointLattices).toEqual(result.snapshot.checkpointLattices);
    expect(view?.traversalBundles).toEqual([]);

    const corridors = await loadOperationalOntologyCorridors(store, "snapshot:ingest");
    const lattices = await loadOperationalOntologyCheckpointLattices(
      store,
      "snapshot:ingest",
    );
    const traversalBundles = await loadOperationalOntologyTraversalBundles(
      store,
      "snapshot:ingest",
    );
    expect(corridors).toEqual(result.snapshot.corridors);
    expect(lattices).toEqual(result.snapshot.checkpointLattices);
    expect(traversalBundles).toEqual([]);
  });

  it("provides event/pipe ingest helpers and scope-based snapshot view queries", async () => {
    const store = new InMemoryOperationalOntologyStore();

    await ingestEventRecordProjection(
      store,
      {
        record: {
          log_id: "log-svc",
          timestamp: "2026-04-10T00:02:00.000Z",
          record_kind: "log",
          trace_id: "trace-svc",
          span_id: "span-svc",
          event_key: "order.submit",
          event_version: "v1",
          payload_format: "json",
          payload_encoding: "identity",
          payload_masking_applied: false,
          payload_masked_fields: [],
          payload: { orderId: "ord-svc" },
          address_context: {},
        },
      },
      {
        snapshotId: "snapshot:event-only",
        targetScope: "event-scope",
        builtAt: "2026-04-10T00:02:10.000Z",
      },
    );

    await ingestPipeGraphProjection(
      store,
      {
        graph: {
          graphId: "pipe-only",
          version: "v1",
          entryPipeId: "collect-order",
          pipes: [
            {
              pipeId: "collect-order",
              version: "v1",
              trigger: { eventKey: "order.submit" },
              flow: { kind: "step", facet: "produced" },
            },
          ],
          connections: [],
        },
      },
      {
        snapshotId: "snapshot:pipe-only",
        targetScope: "pipe-scope",
        builtAt: "2026-04-10T00:02:20.000Z",
      },
    );

    const eventScopeViews = await listOperationalOntologySnapshotViewsByScope(
      store,
      "event-scope",
    );
    expect(eventScopeViews).toHaveLength(1);
    expect(eventScopeViews[0]?.snapshotProjection.projectionId).toBe(
      "snapshot:event-only",
    );

    const latestPipeScopeView = await loadLatestOperationalOntologySnapshotViewByScope(
      store,
      "pipe-scope",
    );
    expect(latestPipeScopeView?.snapshotProjection.projectionId).toBe(
      "snapshot:pipe-only",
    );
    expect(latestPipeScopeView?.snapshot.corridors).toHaveLength(1);

    const eventScopeCorridors = await listOperationalOntologyCorridorsByScope(
      store,
      "event-scope",
    );
    const eventScopeLattices = await listOperationalOntologyCheckpointLatticesByScope(
      store,
      "event-scope",
    );
    const eventScopeTraversalBundles = await listOperationalOntologyTraversalBundlesByScope(
      store,
      "event-scope",
    );
    expect(eventScopeCorridors).toHaveLength(1);
    expect(eventScopeLattices).toHaveLength(1);
    expect(eventScopeTraversalBundles).toEqual([]);

    const eventCorridorView = await loadOperationalOntologyCorridorView(
      store,
      "snapshot:event-only",
      "event-record:log-svc",
    );
    expect(eventCorridorView?.corridor.flowId).toBe("event-record:log-svc");
    expect(eventCorridorView?.checkpointLattices).toHaveLength(1);
    expect(eventCorridorView?.controlFlow).toBeNull();

    const eventCorridorViewsByScope = await listOperationalOntologyCorridorViewsByScope(
      store,
      "event-scope",
    );
    expect(eventCorridorViewsByScope).toHaveLength(1);
    expect(eventCorridorViewsByScope[0]?.corridor.flowId).toBe("event-record:log-svc");

    const latestPipeCorridorView =
      await loadLatestOperationalOntologyCorridorViewByScope(
        store,
        "pipe-scope",
        "pipe-only",
      );
    expect(latestPipeCorridorView?.corridor.flowId).toBe("pipe-only");
    expect(latestPipeCorridorView?.controlFlow?.graphId).toBe("pipe-only");
  });

  it("diffs snapshots and corridors across persisted ontology snapshots", async () => {
    const store = new InMemoryOperationalOntologyStore();

    await ingestPipeGraphProjection(
      store,
      {
        graph: {
          graphId: "pipe-diff",
          version: "v1",
          entryPipeId: "collect-order",
          pipes: [
            {
              pipeId: "collect-order",
              version: "v1",
              trigger: { eventKey: "order.submit" },
              flow: { kind: "step", facet: "produced" },
            },
          ],
          connections: [],
        },
      },
      {
        snapshotId: "snapshot:diff-a",
        targetScope: "diff-scope",
        builtAt: "2026-04-10T00:04:00.000Z",
      },
    );

    await ingestPipeGraphProjection(
      store,
      {
        graph: {
          graphId: "pipe-diff",
          version: "v2",
          entryPipeId: "collect-order",
          pipes: [
            {
              pipeId: "collect-order",
              version: "v2",
              trigger: { eventKey: "order.submit" },
              flow: { kind: "step", facet: "produced" },
              ports: [{ portId: "out", direction: "out", facetType: "produced" }],
            },
            {
              pipeId: "persist-order",
              version: "v2",
              trigger: { eventKey: "order.created" },
              flow: { kind: "step", facet: "consumed" },
              ports: [{ portId: "in", direction: "in", facetType: "consumed" }],
            },
          ],
          connections: [
            {
              from: { pipeId: "collect-order", portId: "out" },
              to: { pipeId: "persist-order", portId: "in" },
              kind: "next",
            },
          ],
        },
      },
      {
        snapshotId: "snapshot:diff-b",
        targetScope: "diff-scope",
        builtAt: "2026-04-10T00:04:10.000Z",
      },
    );

    const corridorDiff = await diffOperationalOntologyCorridor(
      store,
      "pipe-diff",
      "snapshot:diff-a",
      "snapshot:diff-b",
    );
    expect(corridorDiff).toEqual(
      expect.objectContaining({
        corridorId: "pipe-diff",
        status: "changed",
      }),
    );
    expect(corridorDiff?.changedSections).toContain("corridor");
    expect(corridorDiff?.endpointCountDelta).toBeGreaterThan(0);

    const snapshotDiff = await diffOperationalOntologySnapshots(
      store,
      "snapshot:diff-a",
      "snapshot:diff-b",
    );
    expect(snapshotDiff?.summary.changed).toBe(1);
    expect(snapshotDiff?.corridorDiffs).toHaveLength(1);
  });
});

describe("projectPipeGraphToOperationalOntology", () => {
  it("projects pipes and connections into control flow and transmission skeletons", () => {
    const graph: PipeGraph = {
      graphId: "checkout",
      version: "v1",
      entryPipeId: "collect-order",
      pipes: [
        {
          pipeId: "collect-order",
          version: "v1",
          trigger: { eventKey: "order.submit" },
          flow: {
            kind: "step",
            facet: "produced",
            dataContract: {
              consumes: {
                orderInput: { type: "OrderInput", required: true },
              },
              produces: {
                order: { type: "Order", required: true },
              },
              lineageHints: {
                order: {
                  sources: ["orderInput"],
                  transform: "derive",
                },
              },
            },
          },
          ports: [{ portId: "out", direction: "out", facetType: "produced" }],
          produces: ["order.created"],
        },
        {
          pipeId: "persist-order",
          version: "v1",
          trigger: { eventKey: "order.created" },
          flow: { kind: "step", facet: "consumed" },
          ports: [{ portId: "in", direction: "in", facetType: "consumed" }],
        },
      ],
      connections: [
        {
          from: { pipeId: "collect-order", portId: "out" },
          to: { pipeId: "persist-order", portId: "in" },
          kind: "next",
        },
        {
          from: "collect-order",
          to: "persist-order",
          kind: "conditional",
          condition: "order.valid == true",
        },
      ],
    };

    const schemas: DataSchema[] = [
      {
        schemaId: "order_input",
        version: "v1",
        schemaHash: "hash-input",
        primaryKey: ["id"],
        columns: {
          orderInput: {
            ref: { kind: "scalar", type: "OrderInput" },
            required: true,
            facetRole: "consumed",
          },
        },
      },
      {
        schemaId: "order_state",
        version: "v1",
        schemaHash: "hash-state",
        primaryKey: ["id"],
        columns: {
          order: {
            ref: { kind: "scalar", type: "Order" },
            required: true,
            facetRole: "managed",
          },
        },
      },
    ];

    const lineages: FieldLineage[] = [
      {
        target: { schemaId: "order_state", column: "order" },
        sources: [{ schemaId: "order_input", column: "orderInput" }],
        transform: "derive",
        pipeId: "collect-order",
        stepPath: "collect-order/order",
      },
    ];

    const result = projectPipeGraphToOperationalOntology({ graph, schemas, lineages });

    expect(result.controlFlow.entryNodeId).toBe("collect-order");
    expect(result.controlFlow.nodes).toHaveLength(2);
    expect(result.controlFlow.edges).toEqual([
      {
        from: "collect-order",
        to: "persist-order",
        kind: "next",
        condition: undefined,
        sourceKind: "next",
      },
      {
        from: "collect-order",
        to: "persist-order",
        kind: "conditional",
        condition: "order.valid == true",
        sourceKind: "conditional",
      },
    ]);
    expect(result.transmissions).toHaveLength(1);
    expect(result.transmissions[0]).toMatchObject({
      semantic: "production_to_consumption",
      medium: "direct",
      direction: "forward",
    });
    expect(result.transmissions[0].source.facetKind).toBe("production");
    expect(result.transmissions[0].target.facetKind).toBe("consumption");
    expect(result.dataFlow).toMatchObject({
      flowId: "checkout",
      templateKind: "pipe_graph",
      entryNodeId: "collect-order",
      nodeIds: ["collect-order", "persist-order"],
      schemaIds: ["order_input", "order_state"],
    });
    expect(result.dataFlow.templateValidation?.valid).toBe(true);
    expect(result.corridor).toEqual(result.dataFlow);
    expect(result.dataFlow.contracts).toEqual([
      {
        contractId: "contract:collect-order",
        templateKind: "pipe_contract",
        nodeId: "collect-order",
        consumes: [
          {
            field: "orderInput",
            type: "OrderInput",
            required: true,
            source: undefined,
            schemaId: "order_input",
          },
        ],
        produces: [
          {
            field: "order",
            type: "Order",
            required: true,
            source: undefined,
            schemaId: "order_state",
          },
        ],
        accesses: undefined,
      },
    ]);
    expect(result.dataFlow.endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endpointId: "endpoint:collect-order:port:out",
          templateKind: "port",
          nodeId: "collect-order",
          direction: "out",
          facetKind: "production",
        }),
        expect.objectContaining({
          endpointId: "endpoint:collect-order:in:orderInput",
          templateKind: "contract_field",
          nodeId: "collect-order",
          direction: "in",
          field: "orderInput",
          facetKind: "consumption",
          schemaId: "order_input",
        }),
        expect.objectContaining({
          endpointId: "endpoint:collect-order:out:order",
          templateKind: "contract_field",
          nodeId: "collect-order",
          direction: "out",
          field: "order",
          facetKind: "management",
          schemaId: "order_state",
        }),
      ]),
    );
    expect(result.dataFlow.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          templateKind: "pipe_connection",
          sourceKind: "connection",
          relationType: "pipe_connection:next",
        }),
        expect.objectContaining({
          templateKind: "pipe_connection",
          sourceKind: "connection",
          relationType: "pipe_connection:conditional",
        }),
        expect.objectContaining({
          templateKind: "lineage_link",
          sourceKind: "lineage",
          relationType: "lineage",
          fromEndpointId: "endpoint:collect-order:in:orderInput",
          toEndpointId: "endpoint:collect-order:out:order",
        }),
      ]),
    );
    expect(result.lineageLinks).toEqual([
      expect.objectContaining({
        transform: "derive",
        transmissionRef: "collect-order",
        target: expect.objectContaining({
          nodeId: "order_state:order",
          facetKind: "management",
        }),
        sources: [
          expect.objectContaining({
            nodeId: "order_input:orderInput",
            facetKind: "consumption",
          }),
        ],
      }),
    ]);
    expect(result.branchDefinitions).toEqual([
      {
        templateKind: "conditional_branch",
        templateDescription: "Junction materialized from conditional PipeConnection paths",
        templateValidation: expect.objectContaining({ valid: true, pathCount: 2 }),
        branchNodeId: "collect-order",
        mode: "first_match",
        paths: [
          {
            pathId: "collect-order->persist-order:0",
            when: undefined,
            nextNodeIds: ["persist-order"],
            priority: 0,
          },
          {
            pathId: "collect-order->persist-order:1",
            when: {
              conditionId: "collect-order:condition:1",
              expression: "order.valid == true",
            },
            nextNodeIds: ["persist-order"],
            priority: 1,
          },
        ],
      },
    ]);
    expect(result.junctions).toEqual(result.branchDefinitions);
  });

  it("materializes corridor metadata through the provided corridor template registry", () => {
    const graph: PipeGraph = {
      graphId: "pipe-custom",
      version: "v1",
      entryPipeId: "only-step",
      pipes: [
        {
          pipeId: "only-step",
          version: "v1",
          trigger: { eventKey: "custom.start" },
          flow: { kind: "step", facet: "produced" },
        },
      ],
      connections: [],
    };

    const customRegistry: CorridorTemplateRegistry = {
      list() {
        return [
          {
            kind: "pipe_graph",
            description: "Custom pipe corridor",
            requiredEndpointKinds: ["port"],
          },
          {
            kind: "event_record_observed",
            description: "Custom event corridor",
          },
        ];
      },
      get(kind) {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const result = projectPipeGraphToOperationalOntology({
      graph,
      corridorTemplateRegistry: customRegistry,
    });

    expect(result.dataFlow.templateDescription).toBe("Custom pipe corridor");
    expect(result.corridor.templateDescription).toBe("Custom pipe corridor");
    expect(result.dataFlow.templateValidation).toEqual({
      valid: false,
      missingEndpointKinds: ["port"],
      disallowedEndpointKinds: [],
      missingContractKinds: [],
      disallowedContractKinds: [],
      missingLinkKinds: [],
      disallowedLinkKinds: [],
    });
  });

  it("materializes junction metadata through the provided junction template registry", () => {
    const graph: PipeGraph = {
      graphId: "pipe-junction",
      version: "v1",
      entryPipeId: "step-a",
      pipes: [
        {
          pipeId: "step-a",
          version: "v1",
          trigger: { eventKey: "custom.start" },
          flow: { kind: "step", facet: "produced" },
        },
        {
          pipeId: "step-b",
          version: "v1",
          trigger: { eventKey: "custom.next" },
          flow: { kind: "step", facet: "consumed" },
        },
      ],
      connections: [
        {
          from: "step-a",
          to: "step-b",
          kind: "conditional",
          condition: "ok == true",
        },
      ],
    };

    const customRegistry = {
      list() {
        return [
          {
            kind: "conditional_branch",
            description: "Custom conditional junction",
            allowedModes: ["first_match"],
          },
          {
            kind: "observed_route_decision",
            description: "Custom route decision junction",
            allowedModes: ["first_match"],
          },
        ] as const;
      },
      get(kind: "conditional_branch" | "observed_route_decision") {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const result = projectPipeGraphToOperationalOntology({
      graph,
      junctionTemplateRegistry: customRegistry,
    });

    expect(result.branchDefinitions).toEqual([
      {
        templateKind: "conditional_branch",
        templateDescription: "Custom conditional junction",
        templateValidation: expect.objectContaining({ valid: true, pathCount: 1 }),
        branchNodeId: "step-a",
        mode: "first_match",
        paths: [
          {
            pathId: "step-a->step-b:0",
            when: {
              conditionId: "step-a:condition:0",
              expression: "ok == true",
            },
            nextNodeIds: ["step-b"],
            priority: 0,
          },
        ],
      },
    ]);
  });
});

describe("projectEventRecordToOperationalOntology", () => {
  it("projects address_context bindings into observation transmissions", () => {
    const record: EventRecord = {
      log_id: "log-1",
      timestamp: "2026-04-09T00:00:00.000Z",
      record_kind: "log",
      trace_id: "trace-1",
      span_id: "span-1",
      event_key: "order.submit",
      event_version: "v1",
      payload_format: "json",
      payload_encoding: "identity",
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: {
        orderId: "ord_1",
        amount: 42,
      },
      address_context: {
        order_event: "order_event:v1:5",
      },
    };

    const result = projectEventRecordToOperationalOntology({ record });

    expect(result.observedNodeKeys).toContain("event-record:log-1");
    expect(result.dataFlow).toMatchObject({
      flowId: "event-record:log-1",
      templateKind: "event_record_observed",
      entryNodeId: "event-record:log-1",
      nodeIds: [
        "event-record:log-1",
        "address-context:order_event:order_event:v1:5",
      ],
      schemaIds: [],
    });
    expect(result.dataFlow.templateValidation?.valid).toBe(true);
    expect(result.dataFlow.endpoints).toEqual([
      {
        endpointId: "endpoint:event-record:log-1:out:payload",
        templateKind: "payload_root",
        nodeId: "event-record:log-1",
        direction: "out",
        facetKind: "production",
        field: "payload",
        sourceKind: "contract",
      },
      {
        endpointId: "endpoint:event-record:log-1:out:orderId",
        templateKind: "payload_field",
        nodeId: "event-record:log-1",
        direction: "out",
        facetKind: "production",
        field: "orderId",
        sourceKind: "contract",
      },
      {
        endpointId: "endpoint:event-record:log-1:out:amount",
        templateKind: "payload_field",
        nodeId: "event-record:log-1",
        direction: "out",
        facetKind: "production",
        field: "amount",
        sourceKind: "contract",
      },
      {
        endpointId: "endpoint:address-context:order_event:order_event:v1:5:in:order_event",
        templateKind: "address_binding",
        nodeId: "address-context:order_event:order_event:v1:5",
        direction: "in",
        facetKind: "consumption",
        field: "order_event",
        sourceKind: "contract",
      },
    ]);
    expect(result.dataFlow.links).toEqual([
      {
        linkId: "flow-link:event-record:log-1:payload:orderId:0",
        templateKind: "payload_projection",
        fromEndpointId: "endpoint:event-record:log-1:out:payload",
        toEndpointId: "endpoint:event-record:log-1:out:orderId",
        semantic: "production_to_consumption",
        medium: "direct",
        relationType: "payload_field",
        sourceKind: "payload",
      },
      {
        linkId: "flow-link:event-record:log-1:payload:amount:1",
        templateKind: "payload_projection",
        fromEndpointId: "endpoint:event-record:log-1:out:payload",
        toEndpointId: "endpoint:event-record:log-1:out:amount",
        semantic: "production_to_consumption",
        medium: "direct",
        relationType: "payload_field",
        sourceKind: "payload",
      },
      {
        linkId: "flow-link:event-record:log-1:order_event:0",
        templateKind: "observation_link",
        fromEndpointId: "endpoint:event-record:log-1:out:payload",
        toEndpointId: "endpoint:address-context:order_event:order_event:v1:5:in:order_event",
        semantic: "observation_emission",
        medium: "observation",
        relationType: "observes_address_context",
        sourceKind: "connection",
      },
    ]);
    expect(result.transmissions).toHaveLength(1);
    expect(result.transmissions[0]).toMatchObject({
      semantic: "observation_emission",
      medium: "observation",
      relationType: "observes_address_context",
    });
    expect(result.checkpoint).toMatchObject({
      checkpointId: "checkpoint:event-record:log-1",
      templateKind: "root",
      recordId: "log-1",
      traceId: "trace-1",
      eventKey: "order.submit",
      timestamp: "2026-04-09T00:00:00.000Z",
      corridorId: "event-record:log-1",
    });
    expect(result.checkpointDefinitions).toHaveLength(4);
    expect(result.checkpointDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkpointId: "checkpoint:event-record:log-1",
          templateKind: "root",
          nodeId: "event-record:log-1",
          observedPrefixIds: ["order_event"],
          observedFields: ["orderId", "amount"],
          templateValidation: {
            valid: true,
            missingObservedFields: false,
            missingObservedPrefixIds: false,
            nodeNotObserved: false,
          },
        }),
        expect.objectContaining({
          checkpointId: "checkpoint:event-record:log-1:payload:orderId",
          templateKind: "payload_field",
          nodeId: "event-record:log-1",
          observedPrefixIds: [],
          observedFields: ["orderId"],
        }),
        expect.objectContaining({
          checkpointId: "checkpoint:event-record:log-1:payload:amount",
          templateKind: "payload_field",
          nodeId: "event-record:log-1",
          observedPrefixIds: [],
          observedFields: ["amount"],
        }),
        expect.objectContaining({
          checkpointId: "checkpoint:event-record:log-1:binding:order_event:0",
          templateKind: "address_binding",
          nodeId: "address-context:order_event:order_event:v1:5",
          observedPrefixIds: ["order_event"],
          observedFields: [],
        }),
      ]),
    );
    expect(result.checkpoints).toHaveLength(4);
    expect(result.checkpointLattice).toMatchObject({
      corridorId: "event-record:log-1",
      rootCheckpointId: "checkpoint:event-record:log-1",
    });
    expect(result.checkpointLattice.links).toEqual([
      {
        fromCheckpointId: "checkpoint:event-record:log-1",
        toCheckpointId: "checkpoint:event-record:log-1:payload:orderId",
        relation: "contains",
      },
      {
        fromCheckpointId: "checkpoint:event-record:log-1",
        toCheckpointId: "checkpoint:event-record:log-1:payload:amount",
        relation: "contains",
      },
      {
        fromCheckpointId: "checkpoint:event-record:log-1",
        toCheckpointId: "checkpoint:event-record:log-1:binding:order_event:0",
        relation: "contains",
      },
    ]);
    expect(result.checkpoint.dataFlow).toEqual(result.dataFlow);
    expect(result.dataFlow.contracts).toEqual([
      {
        contractId: "contract:event-record:log-1",
        templateKind: "event_record_contract",
        nodeId: "event-record:log-1",
        consumes: [],
        produces: [
          {
            field: "payload",
            type: "object:json",
            required: true,
            source: "order.submit",
          },
          {
            field: "orderId",
            type: "string",
            required: true,
            source: "order.submit",
          },
          {
            field: "amount",
            type: "number",
            required: true,
            source: "order.submit",
          },
        ],
      },
      {
        contractId: "contract:address-context:order_event:order_event:v1:5",
        templateKind: "address_binding_contract",
        nodeId: "address-context:order_event:order_event:v1:5",
        consumes: [
          {
            field: "order_event",
            type: "address_context_binding",
            required: true,
            source: "order.submit",
          },
        ],
        produces: [],
      },
    ]);
  });

  it("materializes checkpoint lattice through the provided checkpoint template registry", () => {
    const record: EventRecord = {
      log_id: "log-2",
      timestamp: "2026-04-09T00:00:00.000Z",
      record_kind: "log",
      trace_id: "trace-2",
      span_id: "span-2",
      event_key: "order.submit",
      event_version: "v1",
      payload_format: "json",
      payload_encoding: "identity",
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: { orderId: "ord_2" },
      address_context: {},
    };

    const customRegistry: CheckpointTemplateRegistry = {
      list() {
        return [
          { kind: "root", description: "root" },
          {
            kind: "payload_field",
            relationToParent: "observes",
            description: "payload",
            requireObservedPrefixIds: true,
          },
          { kind: "address_binding", relationToParent: "contains", description: "binding" },
          { kind: "route_decision", relationToParent: "decides", description: "route" },
        ];
      },
      get(kind) {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const result = projectEventRecordToOperationalOntology({
      record,
      checkpointTemplateRegistry: customRegistry,
    });

    expect(result.checkpointLattice.links).toContainEqual({
      fromCheckpointId: "checkpoint:event-record:log-2",
      toCheckpointId: "checkpoint:event-record:log-2:payload:orderId",
      relation: "observes",
    });
    expect(result.checkpointDefinitions).toContainEqual(
      expect.objectContaining({
        checkpointId: "checkpoint:event-record:log-2:payload:orderId",
        templateValidation: {
          valid: false,
          missingObservedFields: false,
          missingObservedPrefixIds: true,
          nodeNotObserved: false,
        },
      }),
    );
  });

  it("materializes event corridor metadata through the provided corridor template registry", () => {
    const record: EventRecord = {
      log_id: "log-3",
      timestamp: "2026-04-09T00:00:00.000Z",
      record_kind: "log",
      trace_id: "trace-3",
      span_id: "span-3",
      event_key: "order.submit",
      event_version: "v1",
      payload_format: "json",
      payload_encoding: "identity",
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: { orderId: "ord_3" },
      address_context: {},
    };

    const customRegistry: CorridorTemplateRegistry = {
      list() {
        return [
          {
            kind: "pipe_graph",
            description: "Custom pipe corridor",
          },
          {
            kind: "event_record_observed",
            description: "Custom event corridor",
            allowedEndpointKinds: ["payload_root", "payload_field"],
            requiredEndpointKinds: ["payload_root"],
            allowedContractKinds: ["event_record_contract"],
            requiredContractKinds: ["event_record_contract"],
            allowedLinkKinds: ["payload_projection"],
          },
        ];
      },
      get(kind) {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const result = projectEventRecordToOperationalOntology({
      record,
      corridorTemplateRegistry: customRegistry,
    });

    expect(result.dataFlow.templateDescription).toBe("Custom event corridor");
    expect(result.checkpoint.dataFlow.templateDescription).toBe("Custom event corridor");
    expect(result.dataFlow.templateValidation).toEqual({
      valid: true,
      missingEndpointKinds: [],
      disallowedEndpointKinds: [],
      missingContractKinds: [],
      disallowedContractKinds: [],
      missingLinkKinds: [],
      disallowedLinkKinds: [],
    });
  });
});

describe("projectLineageToOperationalOntology", () => {
  it("uses DataSchema facetRole to refine source and target facet kinds", () => {
    const schemas: DataSchema[] = [
      {
        schemaId: "order_input",
        version: "v1",
        schemaHash: "hash-input",
        primaryKey: ["id"],
        columns: {
          id: {
            ref: { kind: "scalar", type: "string" },
            required: true,
            facetRole: "identity",
          },
          status: {
            ref: { kind: "scalar", type: "string" },
            required: true,
            facetRole: "consumed",
          },
        },
      },
      {
        schemaId: "order_state",
        version: "v1",
        schemaHash: "hash-state",
        primaryKey: ["id"],
        columns: {
          status: {
            ref: { kind: "scalar", type: "string" },
            required: true,
            facetRole: "managed",
          },
        },
      },
    ];

    const lineages: FieldLineage[] = [
      {
        target: { schemaId: "order_state", column: "status" },
        sources: [
          { schemaId: "order_input", column: "id" },
          { schemaId: "order_input", column: "status" },
        ],
        transform: "derive",
        pipeId: "sync-order",
        stepPath: "sync-order/status",
      },
    ];

    const result = projectLineageToOperationalOntology({ schemas, lineages });

    expect(result).toHaveLength(1);
    expect(result[0].target).toMatchObject({
      nodeId: "order_state:status",
      facetKind: "management",
    });
    expect(result[0].sources).toEqual([
      expect.objectContaining({
        nodeId: "order_input:id",
        facetKind: "definition",
      }),
      expect.objectContaining({
        nodeId: "order_input:status",
        facetKind: "consumption",
      }),
    ]);
  });
});

describe("projectPathObservationToOperationalOntology", () => {
  it("projects nonlinear observations into traversal observations and branch decisions", () => {
    const observation: NonLinearPathObservation = {
      reached_nodes: [
        {
          spec_step_id: "start",
          runtime_node_id: "run-1",
          event_key: "order.submit",
          timestamp: "2026-04-09T00:00:00.000Z",
        },
      ],
      traversed_edges: [
        {
          from_step_id: "start",
          to_step_id: "validate",
          edge_type: "branch",
        },
      ],
      reached_goals: ["validate"],
      unreachable_goals: [],
      loop_detected: false,
      recovery_used: false,
      terminal_node: "run-1",
      terminal_reason: "goal_reached",
      branchPoints: [
        {
          sourceStepId: "start",
          branches: [
            {
              targetStepId: "validate",
              edgeType: "branch",
              taken: true,
              reachedNodes: [],
            },
            {
              targetStepId: "reject",
              edgeType: "optional",
              taken: false,
              reachedNodes: [],
            },
          ],
        },
      ],
      branchCoverage: { taken: 1, total: 2, rate: 0.5 },
    };

    const result = projectPathObservationToOperationalOntology({ observation });

    expect(result.traversalObservations).toHaveLength(1);
    expect(result.traversalObservations[0].traversal.purpose).toBe("observe");
    expect(result.branchDecisions).toEqual([
      {
        templateKind: "observed_route_decision",
        templateDescription: "Route decision materialized from observed branch outcomes",
        templateValidation: expect.objectContaining({ valid: true, pathCount: 2 }),
        branchNodeId: "start",
        mode: "first_match",
        selectedPathIds: ["start->validate"],
        skippedPathIds: ["start->reject"],
        reason: "observed-paths",
      },
    ]);
  });

  it("materializes route decision metadata through the provided junction template registry", () => {
    const observation: NonLinearPathObservation = {
      reached_nodes: [],
      traversed_edges: [],
      reached_goals: [],
      unreachable_goals: [],
      loop_detected: false,
      recovery_used: false,
      terminal_node: null,
      terminal_reason: null,
      branchPoints: [
        {
          sourceStepId: "start",
          branches: [
            {
              targetStepId: "validate",
              edgeType: "branch",
              taken: true,
              reachedNodes: [],
            },
          ],
        },
      ],
      branchCoverage: { taken: 1, total: 1, rate: 1 },
    };

    const customRegistry = {
      list() {
        return [
          {
            kind: "conditional_branch",
            description: "Custom conditional junction",
            allowedModes: ["first_match"],
          },
          {
            kind: "observed_route_decision",
            description: "Custom route decision junction",
            allowedModes: ["first_match"],
          },
        ] as const;
      },
      get(kind: "conditional_branch" | "observed_route_decision") {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const result = projectPathObservationToOperationalOntology({
      observation,
      junctionTemplateRegistry: customRegistry,
    });

    expect(result.branchDecisions).toEqual([
      {
        templateKind: "observed_route_decision",
        templateDescription: "Custom route decision junction",
        templateValidation: expect.objectContaining({
          valid: true,
          pathCount: 1,
        }),
        branchNodeId: "start",
        mode: "first_match",
        selectedPathIds: ["start->validate"],
        skippedPathIds: [],
        reason: "observed-paths",
      },
    ]);
  });
});

describe("projectOperationalOntologySnapshot", () => {
  it("combines corridor, checkpoint, lineage, and traversal views into one snapshot", () => {
    const graph: PipeGraph = {
      graphId: "checkout",
      version: "v1",
      entryPipeId: "collect-order",
      pipes: [
        {
          pipeId: "collect-order",
          version: "v1",
          trigger: { eventKey: "order.submit" },
          flow: {
            kind: "step",
            facet: "produced",
            dataContract: {
              consumes: {
                orderInput: { type: "OrderInput", required: true },
              },
              produces: {
                order: { type: "Order", required: true },
              },
            },
          },
          ports: [{ portId: "out", direction: "out", facetType: "produced" }],
        },
        {
          pipeId: "validate-order",
          version: "v1",
          trigger: { eventKey: "order.created" },
          flow: { kind: "step", facet: "consumed" },
          ports: [{ portId: "in", direction: "in", facetType: "consumed" }],
        },
      ],
      connections: [
        {
          from: "collect-order",
          to: "validate-order",
          kind: "conditional",
          condition: "order.valid == true",
        },
      ],
    };

    const schemas: DataSchema[] = [
      {
        schemaId: "order_input",
        version: "v1",
        schemaHash: "hash-input",
        primaryKey: ["id"],
        columns: {
          orderInput: {
            ref: { kind: "scalar", type: "OrderInput" },
            required: true,
            facetRole: "consumed",
          },
        },
      },
      {
        schemaId: "order_state",
        version: "v1",
        schemaHash: "hash-state",
        primaryKey: ["id"],
        columns: {
          order: {
            ref: { kind: "scalar", type: "Order" },
            required: true,
            facetRole: "managed",
          },
        },
      },
    ];

    const lineages: FieldLineage[] = [
      {
        target: { schemaId: "order_state", column: "order" },
        sources: [{ schemaId: "order_input", column: "orderInput" }],
        transform: "derive",
        pipeId: "collect-order",
        stepPath: "collect-order/order",
      },
    ];

    const record: EventRecord = {
      log_id: "log-1",
      timestamp: "2026-04-09T00:00:00.000Z",
      record_kind: "log",
      trace_id: "trace-1",
      span_id: "span-1",
      event_key: "order.submit",
      event_version: "v1",
      payload_format: "json",
      payload_encoding: "identity",
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: { orderId: "ord_1" },
      address_context: {
        order_event: "order_event:v1:5",
      },
    };

    const observation: NonLinearPathObservation = {
      reached_nodes: [
        {
          spec_step_id: "collect-order",
          runtime_node_id: "run-1",
          event_key: "order.submit",
          timestamp: "2026-04-09T00:00:00.000Z",
        },
        {
          spec_step_id: "validate-order",
          runtime_node_id: "run-2",
          event_key: "order.created",
          timestamp: "2026-04-09T00:00:01.000Z",
        },
      ],
      traversed_edges: [
        {
          from_step_id: "collect-order",
          to_step_id: "validate-order",
          edge_type: "branch",
        },
      ],
      reached_goals: ["validate-order"],
      unreachable_goals: [],
      loop_detected: false,
      recovery_used: false,
      terminal_node: "run-2",
      terminal_reason: "goal_reached",
      branchPoints: [
        {
          sourceStepId: "collect-order",
          branches: [
            {
              targetStepId: "validate-order",
              edgeType: "branch",
              taken: true,
              reachedNodes: [],
            },
          ],
        },
      ],
      branchCoverage: { taken: 1, total: 1, rate: 1 },
    };

    const snapshot = projectOperationalOntologySnapshot({
      graph,
      record,
      schemas,
      lineages,
      pathObservation: observation,
    });

    expect(snapshot.topologyTemplateKind).toBe("runtime_snapshot");
    expect(snapshot.topologyValidation).toEqual({
      valid: true,
      corridorCount: 2,
      maxCheckpointLatticeDepth: 2,
      missingCorridorKinds: [],
      missingJunctionTemplateKinds: [],
      missingCheckpointTemplateKinds: [],
      missingCheckpointLattices: false,
      missingRouteDecisions: false,
      missingTraversals: false,
      tooFewCorridors: false,
      tooManyCorridors: false,
      checkpointDepthTooShallow: false,
      routeDecisionsMissingRefs: [],
      checkpointsMissingCorridor: [],
    });
    expect(snapshot.corridors).toHaveLength(2);
    expect(snapshot.controlFlows).toHaveLength(1);
    expect(snapshot.checkpoints).toHaveLength(4);
    expect(snapshot.checkpoints[0]).toMatchObject({
      templateKind: "root",
      corridorId: "event-record:log-1",
      junctionId: "collect-order",
      traversalKey: "traversal:observe:collect-order->edge:collect-order->path:branch->validate-order->validate-order",
    });
    expect(snapshot.checkpointLattices).toHaveLength(1);
    expect(snapshot.checkpointLattices[0]).toMatchObject({
      corridorId: "event-record:log-1",
      rootCheckpointId: "checkpoint:event-record:log-1",
    });
    expect(snapshot.checkpointLattices[0].links).toContainEqual({
      fromCheckpointId: "checkpoint:event-record:log-1",
      toCheckpointId: "checkpoint:event-record:log-1:route:collect-order",
      relation: "decides",
    });
    expect(snapshot.checkpointLattices[0].definitions).toContainEqual(
      expect.objectContaining({
        checkpointId: "checkpoint:event-record:log-1:route:collect-order",
        templateKind: "route_decision",
        nodeId: "collect-order",
        observedPrefixIds: [],
        observedFields: [],
        templateValidation: {
          valid: true,
          missingObservedFields: false,
          missingObservedPrefixIds: false,
          nodeNotObserved: false,
        },
      }),
    );
    expect(snapshot.junctions).toEqual([
      {
        templateKind: "conditional_branch",
        templateDescription: "Junction materialized from conditional PipeConnection paths",
        templateValidation: expect.objectContaining({ valid: true, pathCount: 1 }),
        branchNodeId: "collect-order",
        mode: "first_match",
        paths: [
          {
            pathId: "collect-order->validate-order:0",
            when: {
              conditionId: "collect-order:condition:0",
              expression: "order.valid == true",
            },
            nextNodeIds: ["validate-order"],
            priority: 0,
          },
        ],
      },
    ]);
    expect(snapshot.routeDecisions).toEqual([
      {
        templateKind: "observed_route_decision",
        templateDescription: "Route decision materialized from observed branch outcomes",
        templateValidation: expect.objectContaining({ valid: true, pathCount: 1 }),
        branchNodeId: "collect-order",
        mode: "first_match",
        selectedPathIds: ["collect-order->validate-order"],
        skippedPathIds: [],
        reason: "observed-paths",
        junctionId: "collect-order",
        corridorId: "checkout",
        traversalKey: "traversal:observe:collect-order->edge:collect-order->path:branch->validate-order->validate-order",
      },
    ]);
    expect(snapshot.transmissions.length).toBeGreaterThan(0);
    expect(snapshot.lineageLinks).toEqual([
      expect.objectContaining({
        target: expect.objectContaining({
          nodeId: "order_state:order",
        }),
      }),
    ]);
    expect(snapshot.traversals).toHaveLength(1);
  });

  it("validates snapshot shape through the provided observation topology template registry", () => {
    const record: EventRecord = {
      log_id: "log-topology",
      timestamp: "2026-04-09T00:00:00.000Z",
      record_kind: "log",
      trace_id: "trace-topology",
      span_id: "span-topology",
      event_key: "order.submit",
      event_version: "v1",
      payload_format: "json",
      payload_encoding: "identity",
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: { orderId: "ord_topology" },
      address_context: {},
    };

    const customRegistry: ObservationTopologyTemplateRegistry = {
      list() {
        return [
          {
            kind: "runtime_snapshot",
            description: "Route decision required topology",
            requireCorridorKinds: ["event_record_observed"],
            requireCheckpointLattices: true,
            requireRouteDecisions: true,
            requireTraversals: true,
          },
        ];
      },
      get(kind) {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const snapshot = projectOperationalOntologySnapshot({
      record,
      topologyTemplateRegistry: customRegistry,
    });

    expect(snapshot.topologyTemplateDescription).toBe("Route decision required topology");
    expect(snapshot.topologyValidation).toEqual({
      valid: false,
      corridorCount: 1,
      maxCheckpointLatticeDepth: 2,
      missingCorridorKinds: [],
      missingJunctionTemplateKinds: [],
      missingCheckpointTemplateKinds: [],
      missingCheckpointLattices: false,
      missingRouteDecisions: true,
      missingTraversals: true,
      tooFewCorridors: false,
      tooManyCorridors: false,
      checkpointDepthTooShallow: false,
      routeDecisionsMissingRefs: [],
      checkpointsMissingCorridor: [],
    });
  });

  it("materializes snapshot topology metadata through the provided observation topology template registry", () => {
    const record: EventRecord = {
      log_id: "log-topology-2",
      timestamp: "2026-04-09T00:00:00.000Z",
      record_kind: "log",
      trace_id: "trace-topology-2",
      span_id: "span-topology-2",
      event_key: "order.submit",
      event_version: "v1",
      payload_format: "json",
      payload_encoding: "identity",
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: { orderId: "ord_topology_2" },
      address_context: {},
    };

    const customRegistry: ObservationTopologyTemplateRegistry = {
      list() {
        return [
          {
            kind: "runtime_snapshot",
            description: "Custom observation topology",
            requireCorridorKinds: ["event_record_observed"],
            requireCheckpointLattices: true,
          },
        ];
      },
      get(kind) {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const snapshot = projectOperationalOntologySnapshot({
      record,
      topologyTemplateRegistry: customRegistry,
    });

    expect(snapshot.topologyTemplateDescription).toBe("Custom observation topology");
    expect(snapshot.topologyValidation).toEqual({
      valid: true,
      corridorCount: 1,
      maxCheckpointLatticeDepth: 2,
      missingCorridorKinds: [],
      missingJunctionTemplateKinds: [],
      missingCheckpointTemplateKinds: [],
      missingCheckpointLattices: false,
      missingRouteDecisions: false,
      missingTraversals: false,
      tooFewCorridors: false,
      tooManyCorridors: false,
      checkpointDepthTooShallow: false,
      routeDecisionsMissingRefs: [],
      checkpointsMissingCorridor: [],
    });
  });

  it("validates snapshot layout rules through the provided observation topology template registry", () => {
    const record: EventRecord = {
      log_id: "log-topology-layout",
      timestamp: "2026-04-09T00:00:00.000Z",
      record_kind: "log",
      trace_id: "trace-topology-layout",
      span_id: "span-topology-layout",
      event_key: "order.submit",
      event_version: "v1",
      payload_format: "json",
      payload_encoding: "identity",
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: { orderId: "ord_layout" },
      address_context: {},
    };

    const customRegistry: ObservationTopologyTemplateRegistry = {
      list() {
        return [
          {
            kind: "runtime_snapshot",
            description: "Layout constrained topology",
            requireCorridorKinds: ["event_record_observed"],
            requireCheckpointLattices: true,
            minCorridors: 2,
            minCheckpointLatticeDepth: 3,
            requireRouteDecisionReferences: true,
          },
        ];
      },
      get(kind) {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const snapshot = projectOperationalOntologySnapshot({
      record,
      topologyTemplateRegistry: customRegistry,
    });

    expect(snapshot.topologyValidation).toEqual({
      valid: false,
      corridorCount: 1,
      maxCheckpointLatticeDepth: 2,
      missingCorridorKinds: [],
      missingJunctionTemplateKinds: [],
      missingCheckpointTemplateKinds: [],
      missingCheckpointLattices: false,
      missingRouteDecisions: false,
      missingTraversals: false,
      tooFewCorridors: true,
      tooManyCorridors: false,
      checkpointDepthTooShallow: true,
      routeDecisionsMissingRefs: [],
      checkpointsMissingCorridor: [],
    });
  });
});
