import { resolve } from "node:path";

import { createKnownPackCandidate } from "./ontology-pack-scaffold/known-pack-candidate.js";
import {
  detectConflictingOutputPaths,
  resolveSafeRepoPath,
} from "./ontology-pack-scaffold/paths.js";
import {
  renderComponentSchemaFile,
  renderSystemBindingFile,
} from "./ontology-pack-scaffold/render-code.js";
import {
  renderCasesDoc,
  renderPlanDoc,
  renderRuleDoc,
  renderSpecDoc,
  renderTestDoc,
  renderTodoDoc,
} from "./ontology-pack-scaffold/render-docs.js";
import { renderPackTestFile } from "./ontology-pack-scaffold/render-tests.js";
import { createOntologyPackSourceMapPlan } from "./ontology-pack-scaffold/source-map-candidates.js";

export type OntologyPackScaffoldMode = "dry-run" | "write";

export type OntologyPackScaffoldDiagnosticSeverity = "error" | "warning";

export interface OntologyPackScaffoldDiagnostic {
  readonly severity: OntologyPackScaffoldDiagnosticSeverity;
  readonly code:
    | "conflicting-output-path"
    | "existing-output-file"
    | "invalid-cli-flag"
    | "invalid-cli-mode"
    | "invalid-implementation-package"
    | "invalid-optional-docs"
    | "invalid-pack-id"
    | "missing-cli-value"
    | "missing-pack-id"
    | "scaffold-write-failed"
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

export interface OntologyPackScaffoldComponentLikeDeclaration {
  readonly kind: "axis" | "relation-category" | "taxonomy" | "traversal";
  readonly symbolName: string;
  readonly value: string;
  readonly filePath: string;
  readonly description: string;
}

export interface OntologyPackScaffoldSystemLikeBinding {
  readonly kind: "blueprint" | "pack-binding" | "validation-helper";
  readonly symbolName: string;
  readonly value: string;
  readonly filePath: string;
  readonly description: string;
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
  readonly rule: string;
  readonly cases: string;
  readonly test: string;
}

export type OntologyPackScaffoldDefinitionDocType =
  | "cases"
  | "plan"
  | "rule"
  | "spec"
  | "test"
  | "todo";

export type OntologyPackScaffoldOptionalDefinitionDocType =
  | "cases"
  | "rule"
  | "test";

export interface OntologyPackScaffoldDefinitionDocFile
  extends OntologyPackScaffoldPlannedFile {
  readonly docId: string;
  readonly docType: OntologyPackScaffoldDefinitionDocType;
  readonly required: boolean;
}

export interface OntologyPackSourceMapCandidate {
  readonly docId: string;
  readonly docPath: string;
  readonly sourcePath: string;
  readonly sourceRole: "component-schema" | "system-binding" | "test";
  readonly frontmatterKey: "sources";
  readonly sourceFileKind: "generated-file";
  readonly candidateKind: "suggested-doc-edit";
  readonly applyMode: "candidate-only";
}

export interface OntologyPackSourceMapFrontmatterCandidate {
  readonly docId: string;
  readonly docPath: string;
  readonly frontmatterKey: "sources";
  readonly candidateKind: "suggested-doc-edit";
  readonly targetKind: "definition-doc-frontmatter";
  readonly applyMode: "candidate-only";
  readonly sources: readonly string[];
  readonly yaml: string;
}

export interface OntologyPackSourceMapGuidance {
  readonly summary: string;
  readonly findByFileCommands: readonly string[];
  readonly docsGraphCommands: readonly string[];
  readonly notes: readonly string[];
}

export interface OntologyPackKnownPackCandidate {
  readonly targetPath: string;
  readonly packId: string;
  readonly importPath: string;
  readonly exportSymbolName: string;
  readonly importName: string;
  readonly moduleSpecifier: string;
  readonly registryEntry: string;
  readonly registrationMode: "manual";
  readonly applyMode: "candidate-only";
}

export interface OntologyPackScaffoldPreview {
  readonly mode: OntologyPackScaffoldMode;
  readonly writesApplied: false;
  readonly implementationSkeleton: {
    readonly files: readonly OntologyPackScaffoldPlannedFile[];
  };
  readonly testSkeleton: {
    readonly files: readonly OntologyPackScaffoldPlannedFile[];
  };
  readonly definitionDocs: {
    readonly required: readonly OntologyPackScaffoldDefinitionDocFile[];
    readonly optional: readonly OntologyPackScaffoldDefinitionDocFile[];
    readonly selectedOptional: readonly OntologyPackScaffoldDefinitionDocFile[];
    readonly files: readonly OntologyPackScaffoldDefinitionDocFile[];
  };
  readonly sourceMapCandidates: readonly OntologyPackSourceMapCandidate[];
  readonly sourceMapFrontmatterCandidates: readonly OntologyPackSourceMapFrontmatterCandidate[];
  readonly sourceMapGuidance: OntologyPackSourceMapGuidance;
  readonly knownPackRegistrationCandidate: OntologyPackKnownPackCandidate;
  readonly declarations: {
    readonly identity: readonly OntologyPackScaffoldIdentityDeclaration[];
    readonly componentLike: readonly OntologyPackScaffoldComponentLikeDeclaration[];
    readonly systemLike: readonly OntologyPackScaffoldSystemLikeBinding[];
  };
  readonly files: readonly OntologyPackScaffoldPlannedFile[];
}

export interface OntologyPackScaffoldPlan {
  readonly mode: OntologyPackScaffoldMode;
  readonly identity: OntologyPackScaffoldIdentity;
  readonly componentLikeDeclarations: readonly OntologyPackScaffoldComponentLikeDeclaration[];
  readonly systemLikeBindings: readonly OntologyPackScaffoldSystemLikeBinding[];
  readonly componentSchemaFiles: readonly OntologyPackScaffoldPlannedFile[];
  readonly systemBindingFiles: readonly OntologyPackScaffoldPlannedFile[];
  readonly testFiles: readonly OntologyPackScaffoldPlannedFile[];
  readonly docs: OntologyPackScaffoldDocsPaths;
  readonly definitionDocFiles: readonly OntologyPackScaffoldDefinitionDocFile[];
  readonly optionalDefinitionDocFiles: readonly OntologyPackScaffoldDefinitionDocFile[];
  readonly requestedOptionalDefinitionDocs: readonly OntologyPackScaffoldOptionalDefinitionDocType[];
  readonly sourceMapCandidates: readonly OntologyPackSourceMapCandidate[];
  readonly sourceMapFrontmatterCandidates: readonly OntologyPackSourceMapFrontmatterCandidate[];
  readonly sourceMapGuidance: OntologyPackSourceMapGuidance;
  readonly knownPackCandidate: OntologyPackKnownPackCandidate;
  readonly preview: OntologyPackScaffoldPreview;
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
  readonly includeOptionalDocs?: readonly OntologyPackScaffoldOptionalDefinitionDocType[];
}

export interface OntologyPackScaffoldCliPlan extends OntologyPackScaffoldPlan {
  readonly cli: {
    readonly json: boolean;
  };
}

const DEFAULT_IMPLEMENTATION_PACKAGE = "operational-ontology";
const DEFAULT_DOCS_DIR = "docs/specs/operational-ontology";
const SAFE_ENTITY_ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const VALUE_FLAGS = new Set([
  "docs-dir",
  "implementation-package",
  "implementation-root",
  "include-docs",
  "package-root",
  "test",
  "test-file",
]);
const BOOLEAN_FLAGS = new Set(["dry-run", "json", "write"]);
const ALLOWED_FLAGS = new Set([...VALUE_FLAGS, ...BOOLEAN_FLAGS]);
const OPTIONAL_DEFINITION_DOC_TYPES = ["rule", "cases", "test"] as const satisfies
  readonly OntologyPackScaffoldOptionalDefinitionDocType[];

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
  const todoDocId = `${safePackId}-todo`;
  const planDocId = `${safePackId}-plan`;
  const ruleDocId = `${safePackId}-rule`;
  const casesDocId = `${safePackId}-cases`;
  const testDocId = `${safePackId}-test`;
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
  const componentLikeDeclarations: OntologyPackScaffoldComponentLikeDeclaration[] = [
    {
      kind: "axis",
      symbolName: symbols.axisIdConstantName,
      value: defaultAxisId,
      filePath: componentSchemaPath,
      description: "Data-only axis vocabulary for the pack's first stable dimension.",
    },
    {
      kind: "taxonomy",
      symbolName: symbols.taxonomyIdConstantName,
      value: defaultTaxonomyId,
      filePath: componentSchemaPath,
      description: "Data-only taxonomy declaration that applies the axis to ontology nodes.",
    },
    {
      kind: "relation-category",
      symbolName: symbols.relationCategoryConstantName,
      value: defaultRelationCategory,
      filePath: componentSchemaPath,
      description: "Data-only relation category declaration for graph edges in this pack.",
    },
    {
      kind: "traversal",
      symbolName: symbols.traversalPurposeConstantName,
      value: defaultTraversalPurpose,
      filePath: componentSchemaPath,
      description: "Data-only traversal purpose declaration for context graph navigation.",
    },
  ];
  const systemLikeBindings: OntologyPackScaffoldSystemLikeBinding[] = [
    {
      kind: "blueprint",
      symbolName: symbols.blueprintsConstantName,
      value: `${safePackId}-binding`,
      filePath: systemBindingPath,
      description: "System-like implementation binding that connects schema vocabulary to runtime refs.",
    },
    {
      kind: "pack-binding",
      symbolName: symbols.packConstantName,
      value: rawPackId,
      filePath: systemBindingPath,
      description: "System-like OperationalOntologyPack object that combines schema and blueprints.",
    },
    {
      kind: "validation-helper",
      symbolName: symbols.validateFunctionName,
      value: `validateOperationalOntologyPack(${symbols.packConstantName})`,
      filePath: systemBindingPath,
      description: "System-like validation helper for pack contract checks before activation.",
    },
  ];

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
      content: renderSystemBindingFile(identity, componentSchemaPath, testPath),
    },
  ];
  const testFiles = [
    {
      role: "pack-validation-test",
      path: testPath,
      content: renderPackTestFile(identity, testPath, systemBindingPath),
    },
  ];
  const docs: OntologyPackScaffoldDocsPaths = {
    directory: docsDir,
    familyId: safePackId,
    spec: `${docsDir}/${definitionId}.spec.md`,
    plan: `${docsDir}/${planDocId}.plan.md`,
    todo: `${docsDir}/${todoDocId}.todo.md`,
    rule: `${docsDir}/${safePackId}.rule.md`,
    cases: `${docsDir}/${safePackId}.cases.md`,
    test: `${docsDir}/${safePackId}.test.md`,
  };
  const requiredDefinitionDocFiles: OntologyPackScaffoldDefinitionDocFile[] = [
    {
      role: "docs-spec",
      path: docs.spec,
      docId: definitionId,
      docType: "spec",
      required: true,
      content: renderSpecDoc(
        identity,
        componentLikeDeclarations,
        systemLikeBindings,
        [componentSchemaPath, systemBindingPath, testPath],
        testPath,
      ),
    },
    {
      role: "docs-todo",
      path: docs.todo,
      docId: todoDocId,
      docType: "todo",
      required: true,
      content: renderTodoDoc(identity),
    },
    {
      role: "docs-plan",
      path: docs.plan,
      docId: planDocId,
      docType: "plan",
      required: true,
      content: renderPlanDoc(identity),
    },
  ];
  const optionalDefinitionDocFiles: OntologyPackScaffoldDefinitionDocFile[] = [
    {
      role: "docs-rule",
      path: docs.rule,
      docId: ruleDocId,
      docType: "rule",
      required: false,
      content: renderRuleDoc(identity),
    },
    {
      role: "docs-cases",
      path: docs.cases,
      docId: casesDocId,
      docType: "cases",
      required: false,
      content: renderCasesDoc(identity),
    },
    {
      role: "docs-test",
      path: docs.test,
      docId: testDocId,
      docType: "test",
      required: false,
      content: renderTestDoc(identity, testPath),
    },
  ];
  const requestedOptionalDefinitionDocs = normalizeOptionalDocSelection(
    input.includeOptionalDocs ?? [],
  );
  const requestedOptionalDocSet = new Set<OntologyPackScaffoldDefinitionDocType>(
    requestedOptionalDefinitionDocs,
  );
  const selectedOptionalDefinitionDocFiles = optionalDefinitionDocFiles.filter((file) =>
    requestedOptionalDocSet.has(file.docType)
  );
  const definitionDocFiles = [
    ...requiredDefinitionDocFiles,
    ...selectedOptionalDefinitionDocFiles,
  ];
  const sourceMapPlan = createOntologyPackSourceMapPlan({
    primaryDoc: {
      docId: definitionId,
      docPath: docs.spec,
      sources: [
        {
          sourcePath: componentSchemaPath,
          sourceRole: "component-schema",
        },
        {
          sourcePath: systemBindingPath,
          sourceRole: "system-binding",
        },
        {
          sourcePath: testPath,
          sourceRole: "test",
        },
      ],
    },
    additionalDocs: requestedOptionalDocSet.has("test")
      ? [{
        docId: testDocId,
        docPath: docs.test,
        sources: [{
          sourcePath: testPath,
          sourceRole: "test",
        }],
      }]
      : [],
  });
  const sourceMapCandidates = sourceMapPlan.candidates;
  const sourceMapFrontmatterCandidates = sourceMapPlan.frontmatterCandidates;
  const sourceMapGuidance = sourceMapPlan.guidance;
  const knownPackCandidate = createKnownPackCandidate({
    packId: rawPackId,
    implementationPackage,
    symbols,
  });
  const outputPaths = [
    ...componentSchemaFiles.map((file) => file.path),
    ...systemBindingFiles.map((file) => file.path),
    ...testFiles.map((file) => file.path),
    ...definitionDocFiles.map((file) => file.path),
  ];
  diagnostics.push(...detectConflictingOutputPaths([
    ...componentSchemaFiles,
    ...systemBindingFiles,
    ...testFiles,
    ...definitionDocFiles,
  ]));
  const previewFiles = [
    ...componentSchemaFiles,
    ...systemBindingFiles,
    ...testFiles,
    ...definitionDocFiles,
  ];
  const preview: OntologyPackScaffoldPreview = {
    mode: input.mode ?? "dry-run",
    writesApplied: false,
    implementationSkeleton: {
      files: [...componentSchemaFiles, ...systemBindingFiles],
    },
    testSkeleton: {
      files: testFiles,
    },
    definitionDocs: {
      required: requiredDefinitionDocFiles,
      optional: optionalDefinitionDocFiles,
      selectedOptional: selectedOptionalDefinitionDocFiles,
      files: definitionDocFiles,
    },
    sourceMapCandidates,
    sourceMapFrontmatterCandidates,
    sourceMapGuidance,
    knownPackRegistrationCandidate: knownPackCandidate,
    declarations: {
      identity: identity.declarations,
      componentLike: componentLikeDeclarations,
      systemLike: systemLikeBindings,
    },
    files: previewFiles,
  };

  return {
    mode: input.mode ?? "dry-run",
    identity,
    componentLikeDeclarations,
    systemLikeBindings,
    componentSchemaFiles,
    systemBindingFiles,
    testFiles,
    docs,
    definitionDocFiles,
    optionalDefinitionDocFiles,
    requestedOptionalDefinitionDocs,
    sourceMapCandidates,
    sourceMapFrontmatterCandidates,
    sourceMapGuidance,
    knownPackCandidate,
    preview,
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

  const includeOptionalDocs = parseOptionalDocsFlag(flags["include-docs"], diagnostics);
  const plan = createOntologyPackScaffoldPlan({
    packId: positional[0] ?? "",
    rootDir: options.rootDir,
    mode: flags["write"] === "true" ? "write" : "dry-run",
    implementationPackage: flags["implementation-package"],
    packageRoot: flags["package-root"],
    implementationRoot: flags["implementation-root"],
    docsDir: flags["docs-dir"],
    testFilePath: flags["test-file"] ?? flags["test"],
    includeOptionalDocs,
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

function parseOptionalDocsFlag(
  value: string | undefined,
  diagnostics: OntologyPackScaffoldDiagnostic[],
): OntologyPackScaffoldOptionalDefinitionDocType[] {
  if (value === undefined || value.trim().length === 0 || value.trim() === "none") {
    return [];
  }

  const requested = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (requested.includes("all")) {
    return [...OPTIONAL_DEFINITION_DOC_TYPES];
  }

  const invalid = requested.filter((item) =>
    !OPTIONAL_DEFINITION_DOC_TYPES.includes(
      item as OntologyPackScaffoldOptionalDefinitionDocType,
    )
  );
  if (invalid.length > 0) {
    diagnostics.push({
      severity: "error",
      code: "invalid-optional-docs",
      message:
        `Optional definition docs must be one of rule, cases, test, all, or none. Received: ${invalid.join(", ")}.`,
      field: "includeDocs",
      value,
    });
  }

  return normalizeOptionalDocSelection(
    requested.filter((item): item is OntologyPackScaffoldOptionalDefinitionDocType =>
      OPTIONAL_DEFINITION_DOC_TYPES.includes(
        item as OntologyPackScaffoldOptionalDefinitionDocType,
      )
    ),
  );
}

function normalizeOptionalDocSelection(
  values: readonly OntologyPackScaffoldOptionalDefinitionDocType[],
): OntologyPackScaffoldOptionalDefinitionDocType[] {
  const requested = new Set(values);
  return OPTIONAL_DEFINITION_DOC_TYPES.filter((docType) => requested.has(docType));
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
