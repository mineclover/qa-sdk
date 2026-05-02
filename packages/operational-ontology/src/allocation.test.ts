import { describe, expect, it } from "vitest";

import { operationalOntologyAllocationPlane } from "./allocation.js";

const schema = {
  axes: [
    { id: "resource_kind", values: ["service", "route"], capacity: 8 },
    { id: "enforcement_kind", values: ["proxy", "middleware"], capacity: 8 },
    { id: "decision_kind", values: ["allow", "deny"], capacity: 4 },
  ],
  taxonomies: [
    {
      id: "authorization-resource",
      appliesTo: ["node"],
      axisIds: ["resource_kind", "enforcement_kind"],
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
};

describe("ontology address allocation", () => {
  it("allocates product address spaces from schema taxonomies", () => {
    const plan = operationalOntologyAllocationPlane.allocateOntologyAddressSpace(schema, {
      ontologyId: "authorization-ontology",
      namespace: "authz",
      owner: "registry-service",
      versionId: "v1",
      now: "2026-04-13T00:00:00.000Z",
    });

    expect(plan.validation).toEqual({ valid: true, issues: [] });
    expect(plan.namespace).toMatchObject({
      ontologyId: "authorization-ontology",
      namespace: "authz",
      owner: "registry-service",
      lifecycle: "draft",
    });
    expect(plan.axes).toEqual([
      expect.objectContaining({ axisId: "resource_kind", capacity: 8, valuesHash: expect.stringMatching(/^fnv1a32:/) }),
      expect.objectContaining({ axisId: "enforcement_kind", capacity: 8 }),
      expect.objectContaining({ axisId: "decision_kind", capacity: 4 }),
    ]);
    expect(plan.taxonomies).toEqual([
      expect.objectContaining({
        taxonomyId: "authorization-resource",
        axisIds: ["resource_kind", "enforcement_kind"],
        identityAxisIds: ["resource_kind"],
      }),
      expect.objectContaining({
        taxonomyId: "authorization-decision",
        axisIds: ["decision_kind"],
      }),
    ]);
    expect(plan.allocations).toEqual([
      {
        allocationId: "authorization-ontology:authorization-resource:v1",
        ontologyId: "authorization-ontology",
        taxonomyId: "authorization-resource",
        prefix: "authz_authorization_resource",
        versionId: "v1",
        addressModel: "product",
        capacity: 64,
        addressOffset: 0,
        addressSize: 64,
        status: "reserved",
      },
      {
        allocationId: "authorization-ontology:authorization-decision:v1",
        ontologyId: "authorization-ontology",
        taxonomyId: "authorization-decision",
        prefix: "authz_authorization_decision",
        versionId: "v1",
        addressModel: "product",
        capacity: 4,
        addressOffset: 64,
        addressSize: 4,
        status: "reserved",
      },
    ]);
    expect(plan.segments).toEqual([
      expect.objectContaining({
        allocationId: "authorization-ontology:authorization-resource:v1",
        segmentId: "authorization-ontology:authorization-resource:v1:product",
        consumes: ["resource_kind", "enforcement_kind"],
        addressOffset: 0,
        addressSize: 64,
      }),
      expect.objectContaining({
        allocationId: "authorization-ontology:authorization-decision:v1",
        addressOffset: 64,
        addressSize: 4,
      }),
    ]);
  });

  it("allocates sum segments when policy requests sum address model", () => {
    const plan = operationalOntologyAllocationPlane.allocateOntologyAddressSpace(schema, {
      ontologyId: "authorization-ontology",
      namespace: "authz",
      versionId: "v2",
      addressModel: "sum",
      addressOffsetStart: 100,
      prefixByTaxonomyId: {
        "authorization-resource": "authz_resource",
      },
    });

    expect(plan.validation.valid).toBe(true);
    expect(plan.allocations[0]).toEqual(
      expect.objectContaining({
        prefix: "authz_resource",
        versionId: "v2",
        addressModel: "sum",
        capacity: 16,
        addressOffset: 100,
        addressSize: 16,
      }),
    );
    expect(plan.segments.slice(0, 2)).toEqual([
      expect.objectContaining({
        consumes: ["resource_kind"],
        addressOffset: 100,
        addressSize: 8,
      }),
      expect.objectContaining({
        consumes: ["enforcement_kind"],
        addressOffset: 108,
        addressSize: 8,
      }),
    ]);
  });

  it("reports duplicate prefix/version allocations", () => {
    const plan = operationalOntologyAllocationPlane.allocateOntologyAddressSpace(schema, {
      ontologyId: "authorization-ontology",
      namespace: "authz",
      prefixByTaxonomyId: {
        "authorization-resource": "authz_shared",
        "authorization-decision": "authz_shared",
      },
    });

    expect(plan.validation.valid).toBe(false);
    expect(plan.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ontology-prefix-version-duplicate" }),
      ]),
    );
  });

  it("returns structured local allocation drift errors", () => {
    const allocationDriftFixture = {
      ...schema,
      axes: schema.axes.filter((axis) => axis.id !== "decision_kind"),
      taxonomies: [
        schema.taxonomies[0],
        {
          id: "authorization-drift",
          appliesTo: ["node"],
          axisIds: ["decision_kind"],
          identityAxisIds: ["decision_kind"],
          space: "authorization",
        },
      ],
    };
    const plan = operationalOntologyAllocationPlane.allocateOntologyAddressSpace(allocationDriftFixture, {
      ontologyId: "authorization-ontology",
      namespace: "authz",
      versionId: "v7",
      prefixByTaxonomyId: {
        "authorization-resource": "authz_collision",
        "authorization-drift": "authz_collision",
      },
    });

    expect(plan.validation.valid).toBe(false);
    expect(plan.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ontology-prefix-version-duplicate",
          target: expect.objectContaining({
            prefix: "authz_collision",
            versionId: "v7",
            taxonomyIds: expect.arrayContaining(["authorization-resource", "authorization-drift"]),
          }),
        }),
        expect.objectContaining({
          code: "taxonomy-axis-missing",
          path: "schema.authorization-drift.axisIds",
        }),
        expect.objectContaining({
          code: "ontology-taxonomy-axis-missing",
          target: expect.objectContaining({
            taxonomyId: "authorization-drift",
            axisId: "decision_kind",
            versionId: "v7",
          }),
        }),
      ]),
    );
  });

  it("reports missing taxonomy axes before registry-service persistence", () => {
    const broken = {
      ...schema,
      taxonomies: [
        {
          id: "broken-taxonomy",
          appliesTo: ["node"],
          axisIds: ["missing_axis"],
          identityAxisIds: ["missing_axis"],
        },
      ],
    };
    const plan = operationalOntologyAllocationPlane.allocateOntologyAddressSpace(broken, {
      ontologyId: "broken-ontology",
    });

    expect(plan.validation.valid).toBe(false);
    expect(plan.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "taxonomy-axis-missing" }),
        expect.objectContaining({ code: "ontology-taxonomy-axis-missing" }),
      ]),
    );
  });
});
