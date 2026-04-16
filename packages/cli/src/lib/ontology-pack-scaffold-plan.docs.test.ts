import { describe, expect, it } from "vitest";

import {
  createOntologyPackScaffoldPlan,
  createOntologyPackScaffoldPlanFromCliArgs,
  deriveOntologyPackScaffoldSymbols,
  isSafeKebabEntityId,
} from "./ontology-pack-scaffold-plan.js";

describe("ontology pack scaffold plan", () => {
  it("derives a dry-run plan from a safe pack id without writing files", () => {
    const plan = createOntologyPackScaffoldPlan({
      packId: "risk-model-ontology",
      rootDir: "/repo",
    });

    expect(plan.mode).toBe("dry-run");
    expect(plan.diagnostics).toEqual([]);
    expect(plan.identity).toMatchObject({
      packId: "risk-model-ontology",
      safePackId: "risk-model-ontology",
      definitionId: "risk-model-ontology-system",
      defaultAxisId: "risk_model_ontology_kind",
      defaultTaxonomyId: "risk-model-ontology",
      defaultRelationCategory: "risk_model_ontology_relation",
      defaultTraversalPurpose: "risk_model_ontology_context",
      package: {
        implementationPackage: "operational-ontology",
        packageRoot: "packages/operational-ontology",
        sourceDir: "packages/operational-ontology/src/internal",
      },
    });
    expect(plan.identity.symbols).toEqual({
      pascalName: "RiskModelOntology",
      camelName: "riskModelOntology",
      packIdConstantName: "RISK_MODEL_ONTOLOGY_PACK_ID",
      axisIdConstantName: "RISK_MODEL_ONTOLOGY_AXIS_ID",
      taxonomyIdConstantName: "RISK_MODEL_ONTOLOGY_TAXONOMY_ID",
      relationCategoryConstantName: "RISK_MODEL_ONTOLOGY_RELATION_CATEGORY",
      traversalPurposeConstantName: "RISK_MODEL_ONTOLOGY_TRAVERSAL_PURPOSE",
      schemaConstantName: "riskModelOntologySchema",
      blueprintsConstantName: "riskModelOntologyBlueprints",
      packConstantName: "riskModelOntologyPack",
      validateFunctionName: "validateRiskModelOntologyPack",
    });
    expect(plan.identity.declarations.map((declaration) => declaration.kind)).toEqual([
      "pack-id",
      "definition-id",
      "axis-id",
      "taxonomy-id",
      "relation-category",
      "traversal-purpose",
    ]);
    expect(plan.componentSchemaFiles).toHaveLength(1);
    expect(plan.componentSchemaFiles[0]).toMatchObject({
      role: "component-schema",
      path: "packages/operational-ontology/src/internal/risk-model-ontology-schema.ts",
    });
    expect(plan.systemBindingFiles).toHaveLength(1);
    expect(plan.systemBindingFiles[0]).toMatchObject({
      role: "system-binding",
      path: "packages/operational-ontology/src/internal/risk-model-ontology-pack.ts",
    });
    expect(plan.testFiles).toHaveLength(1);
    expect(plan.testFiles[0]!.path).toBe(
      "packages/operational-ontology/src/risk-model-ontology.test.ts",
    );
    expect(plan.docs).toEqual({
      directory: "docs/specs/operational-ontology",
      familyId: "risk-model-ontology-system",
      spec: "docs/specs/operational-ontology/risk-model-ontology-system.spec.md",
      plan: "docs/specs/operational-ontology/risk-model-ontology-system.plan.md",
      todo: "docs/specs/operational-ontology/risk-model-ontology-system.todo.md",
      cases: "docs/specs/operational-ontology/risk-model-ontology-system.cases.md",
      test: "docs/specs/operational-ontology/risk-model-ontology-system.test.md",
    });
    expect(plan.sourceMapCandidates).toEqual([
      {
        docId: "risk-model-ontology-system",
        docPath: "docs/specs/operational-ontology/risk-model-ontology-system.spec.md",
        sourcePath: "packages/operational-ontology/src/internal/risk-model-ontology-schema.ts",
        sourceRole: "component-schema",
        frontmatterKey: "sources",
      },
      {
        docId: "risk-model-ontology-system",
        docPath: "docs/specs/operational-ontology/risk-model-ontology-system.spec.md",
        sourcePath: "packages/operational-ontology/src/internal/risk-model-ontology-pack.ts",
        sourceRole: "system-binding",
        frontmatterKey: "sources",
      },
      {
        docId: "risk-model-ontology-system",
        docPath: "docs/specs/operational-ontology/risk-model-ontology-system.test.md",
        sourcePath: "packages/operational-ontology/src/risk-model-ontology.test.ts",
        sourceRole: "test",
        frontmatterKey: "sources",
      },
    ]);
    expect(plan.knownPackCandidate).toEqual({
      targetPath: "packages/cli/src/lib/known-ontology-packs.ts",
      packId: "risk-model-ontology",
      importName: "riskModelOntologyPack",
      moduleSpecifier: "operational-ontology",
      registryEntry: "\"risk-model-ontology\": riskModelOntologyPack",
      applyMode: "candidate-only",
    });
  });

  it("keeps component-like schema content separate from system-like bindings", () => {
    const plan = createOntologyPackScaffoldPlan({
      packId: "risk-model-ontology",
      rootDir: "/repo",
    });

    const componentContent = plan.componentSchemaFiles[0]!.content;
    const systemContent = plan.systemBindingFiles[0]!.content;

    expect(componentContent).toContain("OperationalOntologySchema");
    expect(componentContent).toContain("riskModelOntologySchema");
    expect(componentContent).not.toContain("ImplementationBlueprint");
    expect(componentContent).not.toContain("validateOperationalOntologyPack");
    expect(systemContent).toContain("ImplementationBlueprint");
    expect(systemContent).toContain("validateOperationalOntologyPack");
    expect(systemContent).toContain("riskModelOntologyBlueprints");
    expect(systemContent).toContain("riskModelOntologyPack");
  });

  it("derives package, docs, test, and write-mode options from CLI args", () => {
    const plan = createOntologyPackScaffoldPlanFromCliArgs(
      [
        "risk-model-ontology",
        "--implementation-package",
        "risk-ontology",
        "--package-root",
        "packages/custom-risk",
        "--docs-dir",
        "docs/specs/risk",
        "--test",
        "packages/custom-risk/src/risk-model-ontology.test.ts",
        "--write",
        "--json",
      ],
      { rootDir: "/repo" },
    );

    expect(plan.cli.json).toBe(true);
    expect(plan.mode).toBe("write");
    expect(plan.diagnostics).toEqual([]);
    expect(plan.identity.package).toEqual({
      implementationPackage: "risk-ontology",
      packageRoot: "packages/custom-risk",
      sourceDir: "packages/custom-risk/src/internal",
    });
    expect(plan.docs.directory).toBe("docs/specs/risk");
    expect(plan.testFiles[0]!.path).toBe(
      "packages/custom-risk/src/risk-model-ontology.test.ts",
    );
    expect(plan.componentSchemaFiles[0]!.path).toBe(
      "packages/custom-risk/src/internal/risk-model-ontology-schema.ts",
    );
    expect(plan.knownPackCandidate.moduleSpecifier).toBe("risk-ontology");
  });

  it("reports structured diagnostics for invalid ids and unsafe paths", () => {
    const plan = createOntologyPackScaffoldPlanFromCliArgs(
      [
        "Risk_Model",
        "--implementation-package",
        "@scope/risk",
        "--package-root",
        "../outside",
        "--docs-dir",
        "/tmp/outside-docs",
        "--test",
        "",
      ],
      { rootDir: "/repo" },
    );

    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "invalid-pack-id",
          field: "packId",
          value: "Risk_Model",
        }),
        expect.objectContaining({
          severity: "error",
          code: "invalid-implementation-package",
          field: "implementationPackage",
          value: "@scope/risk",
        }),
        expect.objectContaining({
          severity: "error",
          code: "unsafe-path",
          field: "packageRoot",
          value: "../outside",
        }),
        expect.objectContaining({
          severity: "error",
          code: "unsafe-path",
          field: "docsDir",
          value: "/tmp/outside-docs",
        }),
        expect.objectContaining({
          severity: "error",
          code: "unsafe-path",
          field: "testFilePath",
          value: "",
        }),
      ]),
    );
  });

  it("reports conflicting output paths", () => {
    const plan = createOntologyPackScaffoldPlan({
      packId: "risk-model-ontology",
      rootDir: "/repo",
      testFilePath: "packages/operational-ontology/src/internal/risk-model-ontology-pack.ts",
    });

    expect(plan.diagnostics).toEqual([
      {
        severity: "error",
        code: "conflicting-output-path",
        message:
          "Output path \"packages/operational-ontology/src/internal/risk-model-ontology-pack.ts\" is planned for multiple scaffold artifacts.",
        path: "packages/operational-ontology/src/internal/risk-model-ontology-pack.ts",
        details: {
          roles: ["system-binding", "pack-validation-test"],
        },
      },
    ]);
  });

  it("validates safe kebab-case entity ids and symbol derivation directly", () => {
    expect(isSafeKebabEntityId("risk-model-ontology")).toBe(true);
    expect(isSafeKebabEntityId("risk--model")).toBe(false);
    expect(isSafeKebabEntityId("RiskModel")).toBe(false);
    expect(isSafeKebabEntityId("risk_model")).toBe(false);
    expect(deriveOntologyPackScaffoldSymbols("quality-signal-ontology")).toMatchObject({
      pascalName: "QualitySignalOntology",
      camelName: "qualitySignalOntology",
      packConstantName: "qualitySignalOntologyPack",
      validateFunctionName: "validateQualitySignalOntologyPack",
    });
  });
});
