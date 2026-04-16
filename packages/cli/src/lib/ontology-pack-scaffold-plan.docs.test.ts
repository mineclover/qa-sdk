import { posix as pathPosix } from "node:path";

import ts from "typescript";
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
    expect(plan.componentLikeDeclarations.map((declaration) => declaration.kind)).toEqual([
      "axis",
      "taxonomy",
      "relation-category",
      "traversal",
    ]);
    expect(plan.systemLikeBindings.map((binding) => binding.kind)).toEqual([
      "blueprint",
      "pack-binding",
      "validation-helper",
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
      rule: "docs/specs/operational-ontology/risk-model-ontology-system.rule.md",
      cases: "docs/specs/operational-ontology/risk-model-ontology-system.cases.md",
      test: "docs/specs/operational-ontology/risk-model-ontology-system.test.md",
    });
    expect(plan.definitionDocFiles.map((file) => ({
      docType: file.docType,
      required: file.required,
      path: file.path,
    }))).toEqual([
      {
        docType: "spec",
        required: true,
        path: "docs/specs/operational-ontology/risk-model-ontology-system.spec.md",
      },
      {
        docType: "todo",
        required: true,
        path: "docs/specs/operational-ontology/risk-model-ontology-system.todo.md",
      },
      {
        docType: "plan",
        required: true,
        path: "docs/specs/operational-ontology/risk-model-ontology-system.plan.md",
      },
      {
        docType: "rule",
        required: false,
        path: "docs/specs/operational-ontology/risk-model-ontology-system.rule.md",
      },
      {
        docType: "cases",
        required: false,
        path: "docs/specs/operational-ontology/risk-model-ontology-system.cases.md",
      },
      {
        docType: "test",
        required: false,
        path: "docs/specs/operational-ontology/risk-model-ontology-system.test.md",
      },
    ]);
    expect(plan.definitionDocFiles.find((file) => file.docType === "spec")?.content).toContain(
      "operational-ontology-pack-interface",
    );
    expect(plan.definitionDocFiles.find((file) => file.docType === "todo")?.content).toContain(
      "## Actionable",
    );
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
    expect(plan.sourceMapFrontmatterCandidates).toEqual([
      {
        docId: "risk-model-ontology-system",
        docPath: "docs/specs/operational-ontology/risk-model-ontology-system.spec.md",
        frontmatterKey: "sources",
        sources: [
          "packages/operational-ontology/src/internal/risk-model-ontology-schema.ts",
          "packages/operational-ontology/src/internal/risk-model-ontology-pack.ts",
        ],
        yaml: [
          "sources:",
          "  - packages/operational-ontology/src/internal/risk-model-ontology-schema.ts",
          "  - packages/operational-ontology/src/internal/risk-model-ontology-pack.ts",
        ].join("\n"),
      },
      {
        docId: "risk-model-ontology-system-test",
        docPath: "docs/specs/operational-ontology/risk-model-ontology-system.test.md",
        frontmatterKey: "sources",
        sources: ["packages/operational-ontology/src/risk-model-ontology.test.ts"],
        yaml: [
          "sources:",
          "  - packages/operational-ontology/src/risk-model-ontology.test.ts",
        ].join("\n"),
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
    expect(plan.preview).toMatchObject({
      mode: "dry-run",
      writesApplied: false,
      knownPackRegistrationCandidate: {
        targetPath: "packages/cli/src/lib/known-ontology-packs.ts",
      },
      declarations: {
        identity: expect.any(Array),
        componentLike: expect.any(Array),
        systemLike: expect.any(Array),
      },
    });
    expect(plan.preview.implementationSkeleton.files.map((file) => file.path)).toEqual([
      "packages/operational-ontology/src/internal/risk-model-ontology-schema.ts",
      "packages/operational-ontology/src/internal/risk-model-ontology-pack.ts",
    ]);
    expect(plan.preview.testSkeleton.files[0]?.content).toContain(
      "validates the pack contract",
    );
    expect(plan.preview.definitionDocs.required.map((file) => file.docType)).toEqual([
      "spec",
      "todo",
      "plan",
    ]);
    expect(plan.preview.definitionDocs.optional.map((file) => file.docType)).toEqual([
      "rule",
      "cases",
      "test",
    ]);
  });

  it("keeps component-like schema content separate from system-like bindings", () => {
    const plan = createOntologyPackScaffoldPlan({
      packId: "risk-model-ontology",
      rootDir: "/repo",
    });

    const componentContent = plan.componentSchemaFiles[0]!.content;
    const systemContent = plan.systemBindingFiles[0]!.content;

    expect(componentContent).toContain("OperationalOntologySchema");
    expect(componentContent).toContain("// Identity constants");
    expect(componentContent).toContain("// Component-like schema: axes");
    expect(componentContent).toContain("// Component-like schema: taxonomies");
    expect(componentContent).toContain("// Component-like schema: relation categories");
    expect(componentContent).toContain("// Component-like schema: traversals");
    expect(componentContent).toContain("riskModelOntologyAxes");
    expect(componentContent).toContain("stable: true");
    expect(componentContent).toContain("capacity: 4");
    expect(componentContent).toContain("axisIds: [RISK_MODEL_ONTOLOGY_AXIS_ID]");
    expect(componentContent).toContain("riskModelOntologySchema");
    expect(componentContent).not.toContain("ImplementationBlueprint");
    expect(componentContent).not.toContain("validateOperationalOntologyPack");
    expect(systemContent).toContain("ImplementationBlueprint");
    expect(systemContent).toContain("validateOperationalOntologyPack");
    expect(systemContent).toContain("// System-like bindings: blueprints");
    expect(systemContent).toContain("// System-like bindings: pack contract");
    expect(systemContent).toContain("// System-like bindings: validation helper");
    expect(systemContent).toContain("verificationBinding");
    expect(systemContent).toContain("riskModelOntologyBlueprints");
    expect(systemContent).toContain("riskModelOntologyPack");
    expect(componentContent.toLowerCase()).not.toContain("ecs");
    expect(systemContent.toLowerCase()).not.toContain("ecs");
  });

  it("generates deterministic TypeScript skeleton files that typecheck in a fixture context", () => {
    const first = createOntologyPackScaffoldPlan({
      packId: "risk-model-ontology",
      rootDir: "/repo",
    });
    const second = createOntologyPackScaffoldPlan({
      packId: "risk-model-ontology",
      rootDir: "/repo",
    });

    expect(first.preview.files.map((file) => [file.path, file.content])).toEqual(
      second.preview.files.map((file) => [file.path, file.content]),
    );
    expect(typecheckGeneratedTypeScriptSkeleton(first)).toEqual([]);
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

const GENERATED_SKELETON_TYPE_STUBS = `
declare module "operational-ontology/schema" {
  export interface AxisSchema {
    id: string;
    values: string[];
    extensible?: boolean;
    stable?: boolean;
    capacity?: number;
  }

  export interface TaxonomySchema {
    id: string;
    appliesTo: string[];
    axisIds: string[];
    identityAxisIds?: string[];
    space?: string;
  }

  export interface RelationCategorySchema {
    category: string;
    requiredAxes: string[];
    optionalAxes?: string[];
    forbiddenAxes?: string[];
    allowedStartKinds?: string[];
    allowedEndKinds?: string[];
  }

  export interface TraversalSchema {
    purpose: string;
    allowedRelationCategories?: string[];
    allowedEdgeKinds?: string[];
    canonicalizable?: boolean;
  }

  export interface OperationalOntologySchema {
    axes: AxisSchema[];
    taxonomies: TaxonomySchema[];
    relationCategories: RelationCategorySchema[];
    traversals?: TraversalSchema[];
  }
}

declare module "operational-ontology/governance" {
  export interface GovernanceSurfaceRef<TKind extends string = string> {
    kind: TKind;
    ref: string;
  }

  export interface ConsistencyConstraint {
    kind: string;
    severity?: string;
    requiredRefs?: readonly string[];
    allowedRefs?: readonly string[];
  }

  export interface ImplementationBinding {
    coordinateRef: string;
    implementationRefs: readonly GovernanceSurfaceRef[];
    facets?: readonly string[];
    relationCategories?: readonly string[];
  }

  export interface VerificationBinding {
    coordinateRef: string;
    verificationRefs: readonly GovernanceSurfaceRef[];
  }

  export interface ImplementationBlueprint {
    blueprintId: string;
    coordinateRef: string;
    unitKind: string;
    requiredSchemas?: readonly string[];
    implementationBinding?: ImplementationBinding;
    verificationBinding?: VerificationBinding;
    constraints?: readonly ConsistencyConstraint[];
    evolutionPolicy?: { kind: string };
  }
}

declare module "operational-ontology/pack" {
  import type { ImplementationBlueprint } from "operational-ontology/governance";
  import type { OperationalOntologySchema } from "operational-ontology/schema";

  export interface OperationalOntologyPack {
    packId: string;
    schema: OperationalOntologySchema;
    blueprints?: readonly ImplementationBlueprint[];
    metadata?: Record<string, unknown>;
  }

  export interface OperationalOntologyPackValidationResult {
    valid: boolean;
    issues: readonly { code: string; message: string }[];
  }

  export function validateOperationalOntologyPack(
    pack: OperationalOntologyPack,
  ): OperationalOntologyPackValidationResult;
}

declare module "vitest" {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void): void;
  export function expect(value: unknown): {
    toBe(expected: unknown): void;
    toBeGreaterThan(expected: number): void;
  };
}
`;

function typecheckGeneratedTypeScriptSkeleton(
  plan: ReturnType<typeof createOntologyPackScaffoldPlan>,
): string[] {
  const fixtureRoot = "/fixture";
  const virtualFiles = new Map<string, string>([
    [`${fixtureRoot}/generated-stubs.d.ts`, GENERATED_SKELETON_TYPE_STUBS],
    ...[
      ...plan.preview.implementationSkeleton.files,
      ...plan.preview.testSkeleton.files,
    ].map((file) => [`${fixtureRoot}/${file.path}`, file.content] as const),
  ]);
  const compilerOptions: ts.CompilerOptions = {
    allowJs: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2023,
    types: [],
  };
  const host = ts.createCompilerHost(compilerOptions, true);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);

  host.resolveModuleNames = (moduleNames, containingFile) =>
    moduleNames.map((moduleName) => {
      const resolved = resolveVirtualModule(virtualFiles, moduleName, containingFile);
      if (resolved) return resolved;
      return ts.resolveModuleName(moduleName, containingFile, compilerOptions, host).resolvedModule;
    });
  host.fileExists = (fileName) =>
    getVirtualFile(virtualFiles, fileName) !== undefined || originalFileExists(fileName);
  host.readFile = (fileName) => getVirtualFile(virtualFiles, fileName) ?? originalReadFile(fileName);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const content = getVirtualFile(virtualFiles, fileName);
    if (content !== undefined) {
      return ts.createSourceFile(fileName, content, languageVersion, true, ts.ScriptKind.TS);
    }
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };

  const program = ts.createProgram([...virtualFiles.keys()], compilerOptions, host);
  return ts.getPreEmitDiagnostics(program).map(formatDiagnostic);
}

function resolveVirtualModule(
  virtualFiles: ReadonlyMap<string, string>,
  moduleName: string,
  containingFile: string,
): ts.ResolvedModule | undefined {
  if (
    moduleName === "operational-ontology/schema"
    || moduleName === "operational-ontology/governance"
    || moduleName === "operational-ontology/pack"
    || moduleName === "vitest"
  ) {
    return {
      resolvedFileName: "/fixture/generated-stubs.d.ts",
      extension: ts.Extension.Dts,
      isExternalLibraryImport: true,
    };
  }

  if (!moduleName.startsWith(".")) return undefined;

  const candidate = pathPosix.normalize(
    pathPosix.join(pathPosix.dirname(normalizeVirtualPath(containingFile)), moduleName),
  );
  const candidates = [
    candidate,
    candidate.endsWith(".js") ? `${candidate.slice(0, -3)}.ts` : `${candidate}.ts`,
    candidate.endsWith(".js") ? `${candidate.slice(0, -3)}.d.ts` : `${candidate}.d.ts`,
  ];
  const resolvedFileName = candidates.find((path) =>
    getVirtualFile(virtualFiles, path) !== undefined
  );
  if (!resolvedFileName) return undefined;

  return {
    resolvedFileName,
    extension: resolvedFileName.endsWith(".d.ts") ? ts.Extension.Dts : ts.Extension.Ts,
    isExternalLibraryImport: false,
  };
}

function getVirtualFile(
  virtualFiles: ReadonlyMap<string, string>,
  fileName: string,
): string | undefined {
  const normalized = normalizeVirtualPath(fileName);
  return virtualFiles.get(normalized)
    ?? (normalized.endsWith(".js")
      ? virtualFiles.get(`${normalized.slice(0, -3)}.ts`)
      : undefined);
}

function normalizeVirtualPath(fileName: string): string {
  return fileName.replaceAll("\\", "/");
}

function formatDiagnostic(diagnostic: ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  if (!diagnostic.file || diagnostic.start === undefined) {
    return `TS${diagnostic.code}: ${message}`;
  }
  const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `${normalizeVirtualPath(diagnostic.file.fileName)}:${position.line + 1}:${position.character + 1} TS${diagnostic.code}: ${message}`;
}
