import { describe, expect, it } from "vitest";

import { operationalOntologyImplementationGovernancePlane } from "./governance.js";

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
          proposedChange: expect.objectContaining({
            kind: "defer_completion",
            summary: "Defer validation_surface completion to a follow-up governance run",
            constraintKind: "validation_surface",
          }),
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
          proposedChange: expect.objectContaining({
            kind: "escalate_decision",
            constraintKind: "unit_boundary",
          }),
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
