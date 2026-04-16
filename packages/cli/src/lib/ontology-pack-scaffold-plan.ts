import { isAbsolute, relative, resolve } from "node:path";

export type OntologyPackScaffoldMode = "dry-run" | "write";

export type OntologyPackScaffoldDiagnosticSeverity = "error" | "warning";

export interface OntologyPackScaffoldDiagnostic {
  readonly severity: OntologyPackScaffoldDiagnosticSeverity;
  readonly code:
    | "conflicting-output-path"
    | "invalid-cli-flag"
    | "invalid-cli-mode"
    | "invalid-implementation-package"
    | "invalid-pack-id"
    | "missing-cli-value"
    | "missing-pack-id"
    | "unsafe-path";
  readonly message: string;
  readonly path?: string;
  readonly field?: string;
  readonly value?: string;
  readonly details?: Record<string, unknown>;
}

export interface OntologyPackScaffoldSymbols {
  readonly pascalName: string;
  readonly camelName: string;
  readonly packIdConstantName: string;
  readonly axisIdConstantName: string;
  readonly taxonomyIdConstantName: string;
  readonly relationCategoryConstantName: string;
  readonly traversalPurposeConstantName: string;
  readonly schemaConstantName: string;
  readonly blueprintsConstantName: string;
  readonly packConstantName: string;
  readonly validateFunctionName: string;
}

export interface OntologyPackScaffoldPackageIdentity {
  readonly implementationPackage: string;
  readonly packageRoot: string;
  readonly sourceDir: string;
}

export interface OntologyPackScaffoldIdentityDeclaration {
  readonly kind:
    | "axis-id"
    | "definition-id"
    | "pack-id"
    | "relation-category"
    | "taxonomy-id"
    | "traversal-purpose";
  readonly symbolName: string;
  readonly value: string;
}

export interface OntologyPackScaffoldIdentity {
  readonly packId: string;
  readonly safePackId: string;
  readonly definitionId: string;
  readonly defaultAxisId: string;
  readonly defaultTaxonomyId: string;
  readonly defaultRelationCategory: string;
  readonly defaultTraversalPurpose: string;
  readonly symbols: OntologyPackScaffoldSymbols;
  readonly package: OntologyPackScaffoldPackageIdentity;
  readonly declarations: readonly OntologyPackScaffoldIdentityDeclaration[];
}

export interface OntologyPackScaffoldPlannedFile {
  readonly role: string;
  readonly path: string;
  readonly content: string;
}

export interface OntologyPackScaffoldDocsPaths {
  readonly directory: string;
  readonly familyId: string;
  readonly spec: string;
  readonly plan: string;
  readonly todo: string;
  readonly cases: string;
  readonly test: string;
}

export interface OntologyPackSourceMapCandidate {
  readonly docId: string;
  readonly docPath: string;
  readonly sourcePath: string;
  readonly sourceRole: "component-schema" | "system-binding" | "test";
  readonly frontmatterKey: "sources";
}

export interface OntologyPackKnownPackCandidate {
  readonly targetPath: string;
  readonly packId: string;
  readonly importName: string;
  readonly moduleSpecifier: string;
  readonly registryEntry: string;
  readonly applyMode: "candidate-only";
}

export interface OntologyPackScaffoldPlan {
  readonly mode: OntologyPackScaffoldMode;
  readonly identity: OntologyPackScaffoldIdentity;
  readonly componentSchemaFiles: readonly OntologyPackScaffoldPlannedFile[];
  readonly systemBindingFiles: readonly OntologyPackScaffoldPlannedFile[];
  readonly testFiles: readonly OntologyPackScaffoldPlannedFile[];
  readonly docs: OntologyPackScaffoldDocsPaths;
  readonly sourceMapCandidates: readonly OntologyPackSourceMapCandidate[];
  readonly knownPackCandidate: OntologyPackKnownPackCandidate;
  readonly outputPaths: readonly string[];
  readonly diagnostics: readonly OntologyPackScaffoldDiagnostic[];
}

export interface CreateOntologyPackScaffoldPlanInput {
  readonly packId: string;
  readonly rootDir?: string;
  readonly mode?: OntologyPackScaffoldMode;
  readonly implementationPackage?: string;
  readonly packageRoot?: string;
  readonly implementationRoot?: string;
  readonly docsDir?: string;
  readonly testFilePath?: string;
}

export interface OntologyPackScaffoldCliPlan extends OntologyPackScaffoldPlan {
  readonly cli: {
    readonly json: boolean;
  };
}

const DEFAULT_IMPLEMENTATION_PACKAGE = "operational-ontology";
const DEFAULT_DOCS_DIR = "docs/specs/operational-ontology";
const KNOWN_PACKS_TARGET_PATH = "packages/cli/src/lib/known-ontology-packs.ts";
const SAFE_ENTITY_ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const VALUE_FLAGS = new Set([
  "docs-dir",
  "implementation-package",
  "implementation-root",
  "package-root",
  "test",
  "test-file",
]);
const BOOLEAN_FLAGS = new Set(["dry-run", "json", "write"]);
const ALLOWED_FLAGS = new Set([...VALUE_FLAGS, ...BOOLEAN_FLAGS]);

export function createOntologyPackScaffoldPlan(
  input: CreateOntologyPackScaffoldPlanInput,
): OntologyPackScaffoldPlan {
  const rootDir = resolve(input.rootDir ?? process.cwd());
  const diagnostics: OntologyPackScaffoldDiagnostic[] = [];
  const rawPackId = input.packId.trim();
  if (rawPackId.length === 0) {
    diagnostics.push({
      severity: "error",
      code: "missing-pack-id",
      message: "Ontology pack scaffold requires a pack id.",
      field: "packId",
    });
  } else if (!isSafeKebabEntityId(rawPackId)) {
    diagnostics.push({
      severity: "error",
      code: "invalid-pack-id",
      message:
        `Pack id "${rawPackId}" must be a safe kebab-case entity id, for example "risk-model-ontology".`,
      field: "packId",
      value: rawPackId,
    });
  }

  const safePackId = toSafeKebabFallback(rawPackId);
  const implementationPackage = normalizeImplementationPackage(
    input.implementationPackage,
    diagnostics,
  );
  const packageRootInput = input.packageRoot ?? input.implementationRoot
    ?? `packages/${implementationPackage}`;
  const packageRoot = resolveSafeRepoPath({
    rootDir,
    field: input.packageRoot ? "packageRoot" : input.implementationRoot ? "implementationRoot" : "packageRoot",
    inputPath: packageRootInput,
    fallbackPath: `packages/${implementationPackage}`,
    diagnostics,
  });
  const sourceDir = `${packageRoot}/src/internal`;
  const docsDir = resolveSafeRepoPath({
    rootDir,
    field: "docsDir",
    inputPath: input.docsDir ?? DEFAULT_DOCS_DIR,
    fallbackPath: DEFAULT_DOCS_DIR,
    diagnostics,
  });
  const symbols = deriveOntologyPackScaffoldSymbols(safePackId);
  const defaultTestPath = `${packageRoot}/src/${safePackId}.test.ts`;
  const testPath = resolveSafeRepoPath({
    rootDir,
    field: "testFilePath",
    inputPath: input.testFilePath ?? defaultTestPath,
    fallbackPath: defaultTestPath,
    diagnostics,
  });
  const fileBase = safePackId;
  const componentSchemaPath = `${sourceDir}/${fileBase}-schema.ts`;
  const systemBindingPath = `${sourceDir}/${fileBase}-pack.ts`;
  const definitionId = `${safePackId}-system`;
  const defaultAxisId = `${safePackId.replaceAll("-", "_")}_kind`;
  const defaultTaxonomyId = safePackId;
  const defaultRelationCategory = `${safePackId.replaceAll("-", "_")}_relation`;
  const defaultTraversalPurpose = `${safePackId.replaceAll("-", "_")}_context`;

  const identity: OntologyPackScaffoldIdentity = {
    packId: rawPackId,
    safePackId,
    definitionId,
    defaultAxisId,
    defaultTaxonomyId,
    defaultRelationCategory,
    defaultTraversalPurpose,
    symbols,
    package: {
      implementationPackage,
      packageRoot,
      sourceDir,
    },
    declarations: [
      {
        kind: "pack-id",
        symbolName: symbols.packIdConstantName,
        value: rawPackId,
      },
      {
        kind: "definition-id",
        symbolName: "DEFINITION_ID",
        value: definitionId,
      },
      {
        kind: "axis-id",
        symbolName: symbols.axisIdConstantName,
        value: defaultAxisId,
      },
      {
        kind: "taxonomy-id",
        symbolName: symbols.taxonomyIdConstantName,
        value: defaultTaxonomyId,
      },
      {
        kind: "relation-category",
        symbolName: symbols.relationCategoryConstantName,
        value: defaultRelationCategory,
      },
      {
        kind: "traversal-purpose",
        symbolName: symbols.traversalPurposeConstantName,
        value: defaultTraversalPurpose,
      },
    ],
  };

  const componentSchemaFiles = [
    {
      role: "component-schema",
      path: componentSchemaPath,
      content: renderComponentSchemaFile(identity),
    },
  ];
  const systemBindingFiles = [
    {
      role: "system-binding",
      path: systemBindingPath,
      content: renderSystemBindingFile(identity, componentSchemaPath),
    },
  ];
  const testFiles = [
    {
      role: "pack-validation-test",
      path: testPath,
      content: renderPackTestFile(identity, systemBindingPath),
    },
  ];
  const docs: OntologyPackScaffoldDocsPaths = {
    directory: docsDir,
    familyId: definitionId,
    spec: `${docsDir}/${definitionId}.spec.md`,
    plan: `${docsDir}/${definitionId}.plan.md`,
    todo: `${docsDir}/${definitionId}.todo.md`,
    cases: `${docsDir}/${definitionId}.cases.md`,
    test: `${docsDir}/${definitionId}.test.md`,
  };
  const sourceMapCandidates: OntologyPackSourceMapCandidate[] = [
    {
      docId: definitionId,
      docPath: docs.spec,
      sourcePath: componentSchemaPath,
      sourceRole: "component-schema",
      frontmatterKey: "sources",
    },
    {
      docId: definitionId,
      docPath: docs.spec,
      sourcePath: systemBindingPath,
      sourceRole: "system-binding",
      frontmatterKey: "sources",
    },
    {
      docId: definitionId,
      docPath: docs.test,
      sourcePath: testPath,
      sourceRole: "test",
      frontmatterKey: "sources",
    },
  ];
  const knownPackCandidate: OntologyPackKnownPackCandidate = {
    targetPath: KNOWN_PACKS_TARGET_PATH,
    packId: rawPackId,
    importName: symbols.packConstantName,
    moduleSpecifier: implementationPackage,
    registryEntry: `"${rawPackId}": ${symbols.packConstantName}`,
    applyMode: "candidate-only",
  };
  const outputPaths = [
    ...componentSchemaFiles.map((file) => file.path),
    ...systemBindingFiles.map((file) => file.path),
    ...testFiles.map((file) => file.path),
    docs.spec,
    docs.plan,
    docs.todo,
    docs.cases,
    docs.test,
  ];
  diagnostics.push(...detectConflictingOutputPaths([
    ...componentSchemaFiles,
    ...systemBindingFiles,
    ...testFiles,
    { role: "docs-spec", path: docs.spec, content: "" },
    { role: "docs-plan", path: docs.plan, content: "" },
    { role: "docs-todo", path: docs.todo, content: "" },
    { role: "docs-cases", path: docs.cases, content: "" },
    { role: "docs-test", path: docs.test, content: "" },
  ]));

  return {
    mode: input.mode ?? "dry-run",
    identity,
    componentSchemaFiles,
    systemBindingFiles,
    testFiles,
    docs,
    sourceMapCandidates,
    knownPackCandidate,
    outputPaths,
    diagnostics,
  };
}

export function createOntologyPackScaffoldPlanFromCliArgs(
  args: readonly string[],
  options: { readonly rootDir?: string } = {},
): OntologyPackScaffoldCliPlan {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  const diagnostics: OntologyPackScaffoldDiagnostic[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [rawKey, inline] = arg.slice(2).split("=", 2);
    const key = rawKey ?? "";
    if (!ALLOWED_FLAGS.has(key)) {
      diagnostics.push({
        severity: "error",
        code: "invalid-cli-flag",
        message: `Unsupported ontology pack scaffold flag "--${key}".`,
        field: key,
        value: arg,
      });
    }

    if (BOOLEAN_FLAGS.has(key)) {
      flags[key] = inline ?? "true";
      continue;
    }

    if (inline !== undefined) {
      flags[key] = inline;
      continue;
    }

    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      diagnostics.push({
        severity: "error",
        code: "missing-cli-value",
        message: `Flag "--${key}" requires a value.`,
        field: key,
        value: arg,
      });
      flags[key] = "";
      continue;
    }
    flags[key] = next;
    index += 1;
  }

  if (flags["dry-run"] === "true" && flags["write"] === "true") {
    diagnostics.push({
      severity: "error",
      code: "invalid-cli-mode",
      message: "Use either --dry-run or --write, not both.",
      field: "mode",
      details: { dryRun: true, write: true },
    });
  }

  const plan = createOntologyPackScaffoldPlan({
    packId: positional[0] ?? "",
    rootDir: options.rootDir,
    mode: flags["write"] === "true" ? "write" : "dry-run",
    implementationPackage: flags["implementation-package"],
    packageRoot: flags["package-root"],
    implementationRoot: flags["implementation-root"],
    docsDir: flags["docs-dir"],
    testFilePath: flags["test-file"] ?? flags["test"],
  });

  return {
    ...plan,
    cli: {
      json: flags["json"] === "true",
    },
    diagnostics: [...diagnostics, ...plan.diagnostics],
  };
}

export function hasOntologyPackScaffoldErrors(
  diagnostics: readonly OntologyPackScaffoldDiagnostic[],
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

export function isSafeKebabEntityId(value: string): boolean {
  return SAFE_ENTITY_ID_RE.test(value);
}

export function deriveOntologyPackScaffoldSymbols(
  packId: string,
): OntologyPackScaffoldSymbols {
  const words = packId.split("-").filter(Boolean);
  const pascalName = words.map(capitalize).join("") || "Pack";
  const camelName = pascalName.charAt(0).toLowerCase() + pascalName.slice(1);
  const scream = words.map((word) => word.toUpperCase()).join("_") || "PACK";
  return {
    pascalName,
    camelName,
    packIdConstantName: `${scream}_PACK_ID`,
    axisIdConstantName: `${scream}_AXIS_ID`,
    taxonomyIdConstantName: `${scream}_TAXONOMY_ID`,
    relationCategoryConstantName: `${scream}_RELATION_CATEGORY`,
    traversalPurposeConstantName: `${scream}_TRAVERSAL_PURPOSE`,
    schemaConstantName: `${camelName}Schema`,
    blueprintsConstantName: `${camelName}Blueprints`,
    packConstantName: `${camelName}Pack`,
    validateFunctionName: `validate${pascalName}Pack`,
  };
}

function normalizeImplementationPackage(
  value: string | undefined,
  diagnostics: OntologyPackScaffoldDiagnostic[],
): string {
  const implementationPackage = value?.trim() || DEFAULT_IMPLEMENTATION_PACKAGE;
  if (!isSafeKebabEntityId(implementationPackage)) {
    diagnostics.push({
      severity: "error",
      code: "invalid-implementation-package",
      message:
        `Implementation package "${implementationPackage}" must be a safe kebab-case package directory id.`,
      field: "implementationPackage",
      value: implementationPackage,
    });
    return DEFAULT_IMPLEMENTATION_PACKAGE;
  }
  return implementationPackage;
}

function resolveSafeRepoPath(input: {
  readonly rootDir: string;
  readonly field: string;
  readonly inputPath: string;
  readonly fallbackPath: string;
  readonly diagnostics: OntologyPackScaffoldDiagnostic[];
}): string {
  const value = input.inputPath.trim();
  if (value.length === 0 || value.includes("\0")) {
    input.diagnostics.push(unsafePathDiagnostic(input.field, input.inputPath));
    return normalizeRepoPath(input.fallbackPath);
  }

  const resolved = resolve(input.rootDir, value);
  const repoRelativePath = relative(input.rootDir, resolved);
  if (
    repoRelativePath.length === 0
    || repoRelativePath === ".."
    || repoRelativePath.startsWith(`..${"/"}`)
    || repoRelativePath.startsWith(`..${"\\"}`)
    || isAbsolute(repoRelativePath)
  ) {
    input.diagnostics.push(unsafePathDiagnostic(input.field, input.inputPath));
    return normalizeRepoPath(input.fallbackPath);
  }

  return normalizeRepoPath(repoRelativePath);
}

function unsafePathDiagnostic(
  field: string,
  value: string,
): OntologyPackScaffoldDiagnostic {
  return {
    severity: "error",
    code: "unsafe-path",
    message:
      `Path option "${field}" must resolve inside the repository and must not be empty.`,
    field,
    value,
  };
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function detectConflictingOutputPaths(
  files: readonly Pick<OntologyPackScaffoldPlannedFile, "path" | "role">[],
): OntologyPackScaffoldDiagnostic[] {
  const byPath = new Map<string, string[]>();
  for (const file of files) {
    const roles = byPath.get(file.path) ?? [];
    roles.push(file.role);
    byPath.set(file.path, roles);
  }
  return [...byPath.entries()]
    .filter(([, roles]) => roles.length > 1)
    .map(([path, roles]) => ({
      severity: "error" as const,
      code: "conflicting-output-path" as const,
      message: `Output path "${path}" is planned for multiple scaffold artifacts.`,
      path,
      details: { roles },
    }));
}

function toSafeKebabFallback(value: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  if (safe.length === 0) return "pack";
  return /^[a-z]/.test(safe) ? safe : `pack-${safe}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderComponentSchemaFile(identity: OntologyPackScaffoldIdentity): string {
  const { symbols } = identity;
  return `import type { OperationalOntologySchema } from "operational-ontology/schema";

export const ${symbols.packIdConstantName} = "${identity.packId}" as const;
export const ${symbols.axisIdConstantName} = "${identity.defaultAxisId}" as const;
export const ${symbols.taxonomyIdConstantName} = "${identity.defaultTaxonomyId}" as const;
export const ${symbols.relationCategoryConstantName} = "${identity.defaultRelationCategory}" as const;
export const ${symbols.traversalPurposeConstantName} = "${identity.defaultTraversalPurpose}" as const;

export const ${symbols.schemaConstantName} = {
  axes: [
    {
      id: ${symbols.axisIdConstantName},
      values: ["example"],
      stable: true,
      capacity: 4,
    },
  ],
  taxonomies: [
    {
      id: ${symbols.taxonomyIdConstantName},
      appliesTo: ["node"],
      axisIds: [${symbols.axisIdConstantName}],
      identityAxisIds: [${symbols.axisIdConstantName}],
      space: ${symbols.packIdConstantName},
    },
  ],
  relationCategories: [
    {
      category: ${symbols.relationCategoryConstantName},
      requiredAxes: [${symbols.axisIdConstantName}],
    },
  ],
  traversals: [
    {
      purpose: ${symbols.traversalPurposeConstantName},
      allowedRelationCategories: [${symbols.relationCategoryConstantName}],
      canonicalizable: true,
    },
  ],
} satisfies OperationalOntologySchema;
`;
}

function renderSystemBindingFile(
  identity: OntologyPackScaffoldIdentity,
  componentSchemaPath: string,
): string {
  const { symbols } = identity;
  const schemaImportPath = `./${componentSchemaPath.split("/").pop()?.replace(/\.ts$/, ".js") ?? `${identity.safePackId}-schema.js`}`;
  return `import type { ImplementationBlueprint } from "operational-ontology/governance";
import type {
  OperationalOntologyPack,
  OperationalOntologyPackValidationResult,
} from "operational-ontology/pack";
import { validateOperationalOntologyPack } from "operational-ontology/pack";
import {
  ${symbols.packIdConstantName},
  ${symbols.relationCategoryConstantName},
  ${symbols.schemaConstantName},
  ${symbols.taxonomyIdConstantName},
  ${symbols.traversalPurposeConstantName},
} from "${schemaImportPath}";

export const ${symbols.blueprintsConstantName} = [
  {
    blueprintId: "${identity.safePackId}-binding",
    coordinateRef: "corridor:${identity.safePackId}-binding",
    unitKind: "corridor_bundle",
    requiredSchemas: [
      ${symbols.taxonomyIdConstantName},
      ${symbols.relationCategoryConstantName},
      ${symbols.traversalPurposeConstantName},
    ],
    implementationBinding: {
      coordinateRef: "corridor:${identity.safePackId}-binding",
      implementationRefs: [
        {
          kind: "code",
          ref: "${identity.package.sourceDir}/${identity.safePackId}-pack.ts",
        },
      ],
      relationCategories: [${symbols.relationCategoryConstantName}],
    },
    constraints: [
      { kind: "unit_boundary", severity: "core" },
      { kind: "validation_surface", requiredRefs: ["test"] },
    ],
    evolutionPolicy: { kind: "append_only" },
  },
] satisfies readonly ImplementationBlueprint[];

export const ${symbols.packConstantName} = {
  packId: ${symbols.packIdConstantName},
  schema: ${symbols.schemaConstantName},
  blueprints: ${symbols.blueprintsConstantName},
} satisfies OperationalOntologyPack;

export function ${symbols.validateFunctionName}(): OperationalOntologyPackValidationResult {
  return validateOperationalOntologyPack(${symbols.packConstantName});
}
`;
}

function renderPackTestFile(
  identity: OntologyPackScaffoldIdentity,
  systemBindingPath: string,
): string {
  const { symbols } = identity;
  const importPath = `./internal/${systemBindingPath.split("/").pop()?.replace(/\.ts$/, ".js") ?? `${identity.safePackId}-pack.js`}`;
  return `import { describe, expect, it } from "vitest";

import {
  ${symbols.packConstantName},
  ${symbols.validateFunctionName},
} from "${importPath}";

describe("${identity.packId} ontology pack", () => {
  it("validates the pack contract", () => {
    const result = ${symbols.validateFunctionName}();

    expect(result.valid).toBe(true);
    expect(${symbols.packConstantName}.packId).toBe("${identity.packId}");
  });

  it("keeps domain schema and system binding expectations explicit", () => {
    expect(${symbols.packConstantName}.schema.axes.length).toBeGreaterThan(0);
    expect(${symbols.packConstantName}.blueprints?.length ?? 0).toBeGreaterThan(0);
  });
});
`;
}
