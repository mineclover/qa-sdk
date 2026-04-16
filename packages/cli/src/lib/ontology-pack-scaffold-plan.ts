import { isAbsolute, posix as pathPosix, relative, resolve } from "node:path";

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
}

export interface OntologyPackSourceMapFrontmatterCandidate {
  readonly docId: string;
  readonly docPath: string;
  readonly frontmatterKey: "sources";
  readonly sources: readonly string[];
  readonly yaml: string;
}

export interface OntologyPackKnownPackCandidate {
  readonly targetPath: string;
  readonly packId: string;
  readonly importName: string;
  readonly moduleSpecifier: string;
  readonly registryEntry: string;
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
    readonly files: readonly OntologyPackScaffoldDefinitionDocFile[];
  };
  readonly sourceMapFrontmatterCandidates: readonly OntologyPackSourceMapFrontmatterCandidate[];
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
  readonly sourceMapCandidates: readonly OntologyPackSourceMapCandidate[];
  readonly sourceMapFrontmatterCandidates: readonly OntologyPackSourceMapFrontmatterCandidate[];
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
    familyId: definitionId,
    spec: `${docsDir}/${definitionId}.spec.md`,
    plan: `${docsDir}/${definitionId}.plan.md`,
    todo: `${docsDir}/${definitionId}.todo.md`,
    rule: `${docsDir}/${definitionId}.rule.md`,
    cases: `${docsDir}/${definitionId}.cases.md`,
    test: `${docsDir}/${definitionId}.test.md`,
  };
  const definitionDocFiles: OntologyPackScaffoldDefinitionDocFile[] = [
    {
      role: "docs-spec",
      path: docs.spec,
      docId: definitionId,
      docType: "spec",
      required: true,
      content: renderSpecDoc(identity, componentLikeDeclarations, systemLikeBindings, [
        componentSchemaPath,
        systemBindingPath,
      ]),
    },
    {
      role: "docs-todo",
      path: docs.todo,
      docId: `${definitionId}-todo`,
      docType: "todo",
      required: true,
      content: renderTodoDoc(identity),
    },
    {
      role: "docs-plan",
      path: docs.plan,
      docId: `${definitionId}-plan`,
      docType: "plan",
      required: true,
      content: renderPlanDoc(identity),
    },
    {
      role: "docs-rule",
      path: docs.rule,
      docId: `${definitionId}-rule`,
      docType: "rule",
      required: false,
      content: renderRuleDoc(identity),
    },
    {
      role: "docs-cases",
      path: docs.cases,
      docId: `${definitionId}-cases`,
      docType: "cases",
      required: false,
      content: renderCasesDoc(identity),
    },
    {
      role: "docs-test",
      path: docs.test,
      docId: `${definitionId}-test`,
      docType: "test",
      required: false,
      content: renderTestDoc(identity, testPath),
    },
  ];
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
  const sourceMapFrontmatterCandidates: OntologyPackSourceMapFrontmatterCandidate[] = [
    {
      docId: definitionId,
      docPath: docs.spec,
      frontmatterKey: "sources",
      sources: [componentSchemaPath, systemBindingPath],
      yaml: renderSourcesYaml([componentSchemaPath, systemBindingPath]),
    },
    {
      docId: `${definitionId}-test`,
      docPath: docs.test,
      frontmatterKey: "sources",
      sources: [testPath],
      yaml: renderSourcesYaml([testPath]),
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
      required: definitionDocFiles.filter((file) => file.required),
      optional: definitionDocFiles.filter((file) => !file.required),
      files: definitionDocFiles,
    },
    sourceMapFrontmatterCandidates,
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
    sourceMapCandidates,
    sourceMapFrontmatterCandidates,
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

function toRelativeJsModuleSpecifier(fromFilePath: string, toFilePath: string): string {
  const fromDir = pathPosix.dirname(normalizeRepoPath(fromFilePath));
  const toJsPath = normalizeRepoPath(toFilePath).replace(/\.ts$/, ".js");
  const relativePath = pathPosix.relative(fromDir, toJsPath);
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
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

function toDisplayName(identity: OntologyPackScaffoldIdentity): string {
  return identity.safePackId
    .split("-")
    .filter(Boolean)
    .map(capitalize)
    .join(" ");
}

function renderSourcesYaml(sources: readonly string[]): string {
  return [
    "sources:",
    ...sources.map((source) => `  - ${source}`),
  ].join("\n");
}

function renderSpecDoc(
  identity: OntologyPackScaffoldIdentity,
  componentLikeDeclarations: readonly OntologyPackScaffoldComponentLikeDeclaration[],
  systemLikeBindings: readonly OntologyPackScaffoldSystemLikeBinding[],
  sources: readonly string[],
): string {
  const displayName = toDisplayName(identity);
  return `---
def:
  id: ${identity.definitionId}
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [structural, contract]
  links:
    - target: operational-ontology-pack-interface
      type: refines
${renderSourcesYaml(sources)}
---

# ${displayName} — Operational Ontology Pack

## 목적 ^purpose

${identity.packId} pack의 identity, component-like schema vocabulary, system-like binding을 같은 authoring family에서 추적한다. 이 문서는 pack scaffold 이후 도메인별 온톨로지 의미와 검증 경계를 채우기 위한 시작점이다.

## 구성 ^overview

- Pack id: \`${identity.packId}\`
- Implementation package: \`${identity.package.implementationPackage}\`
- Component schema: \`${identity.package.sourceDir}/${identity.safePackId}-schema.ts\`
- System binding: \`${identity.package.sourceDir}/${identity.safePackId}-pack.ts\`

## Identity / Data / System Separation

Operational ontology pack authoring is architecture-neutral. Runtime architecture labels belong to the pack domain and are not emitted by default; this scaffold only uses the identity/data/system separation discipline.

### Identity declarations

${identity.declarations.map((declaration) => `- \`${declaration.symbolName}\` = \`${declaration.value}\` (${declaration.kind})`).join("\n")}

### Component-like declarations

${componentLikeDeclarations.map((declaration) => `- \`${declaration.symbolName}\` = \`${declaration.value}\` (${declaration.kind})`).join("\n")}

### System-like bindings

${systemLikeBindings.map((binding) => `- \`${binding.symbolName}\` (${binding.kind}): ${binding.description}`).join("\n")}

## 검증 참조

- Test skeleton: \`${identity.package.packageRoot}/src/${identity.safePackId}.test.ts\`
- Known-pack registration remains a manual candidate for \`packages/cli/src/lib/known-ontology-packs.ts\`.
`;
}

function renderTodoDoc(identity: OntologyPackScaffoldIdentity): string {
  const displayName = toDisplayName(identity);
  return `---
def:
  id: ${identity.definitionId}-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract]
  links:
    - target: ${identity.definitionId}
      type: refines
---

# ${displayName} — Pack Authoring TODO

## 목적 ^purpose

${identity.packId} pack scaffold 이후 실제 도메인 vocabulary, tests, docs, source-map, known-pack registration을 닫기 위한 작업을 추적한다.

## Completed — 완료 기록

아직 완료 항목 없음. 구현 완료 사실만 여기에 추가한다.

## Actionable — 실행 가능

- [ ] Replace the example axis value with domain vocabulary.
- [ ] Fill taxonomy, relation category, and traversal declarations.
- [ ] Validate the pack skeleton with \`${identity.symbols.validateFunctionName}()\`.
- [ ] Add domain-specific test expectations.
- [ ] Apply source-map frontmatter after files are written.
- [ ] Review the known-pack registration candidate before editing the resolver manually.

## Deferred — 조건부 대기

- [ ] Registry activation remains separate from scaffold output.

## Parking Lot — 후보 보관

- [ ] Add optional rule/cases/test docs when the pack has concrete consumer rules or scenarios.
`;
}

function renderPlanDoc(identity: OntologyPackScaffoldIdentity): string {
  const displayName = toDisplayName(identity);
  return `---
def:
  id: ${identity.definitionId}-plan
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, contract]
  links:
    - target: ${identity.definitionId}
      type: refines
    - target: operational-ontology-pack-interface
      type: depends_on
---

# ${displayName} — Pack Authoring Plan

## 목적 ^purpose

${identity.packId} pack을 scaffold 후보에서 검증 가능한 operational ontology pack으로 승격하는 순서를 기록한다.

## 단계

1. Keep identity constants stable before expanding schema content.
2. Replace placeholder component-like declarations with finite, decision-relevant domain vocabulary.
3. Add system-like blueprint bindings only after schema declarations are explicit.
4. Run the generated test skeleton and pack validation.
5. Add source-map frontmatter and known-pack resolver edits manually after review.
6. Activate through \`qa-sdk ontology registry activate-pack\` only after scaffold output is written and validated.
`;
}

function renderRuleDoc(identity: OntologyPackScaffoldIdentity): string {
  const displayName = toDisplayName(identity);
  return `---
def:
  id: ${identity.definitionId}-rule
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: draft
  layer: operation
  tags: [structural, contract]
  links:
    - target: ${identity.definitionId}
      type: refines
---

# ${displayName} — Pack Authoring Rules

## 목적 ^purpose

${identity.packId} pack을 소비하거나 확장할 때 반복 확인해야 하는 authoring rule 후보를 기록한다.

## 규칙 후보

- Identity declarations stay stable and data-free.
- Component-like schema declarations remain data-only.
- System-like bindings own validation, blueprint refs, and runtime integration.
- Known-pack registration is manual until explicitly reviewed.
`;
}

function renderCasesDoc(identity: OntologyPackScaffoldIdentity): string {
  const displayName = toDisplayName(identity);
  return `---
def:
  id: ${identity.definitionId}-cases
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: draft
  layer: operation
  tags: [structural, scenario, contract]
  links:
    - target: ${identity.definitionId}
      type: refines
---

# ${displayName} — Pack Authoring Cases

## 목적 ^purpose

${identity.packId} pack을 작성, 검증, 등록 후보로 검토하는 사용 시나리오를 기록한다.

## UC-001: Pack author previews scaffold output

### 상황

Pack author runs \`qa-sdk ontology pack scaffold ${identity.packId} --json\`.

### 기대 결과

Preview separates identity declarations, component-like schema declarations, system-like bindings, generated docs, source-map candidates, and known-pack registration candidates without writing files.
`;
}

function renderTestDoc(
  identity: OntologyPackScaffoldIdentity,
  testPath: string,
): string {
  const displayName = toDisplayName(identity);
  return `---
def:
  id: ${identity.definitionId}-test
  level: leaf
  scope: flow
  aspect: test_strategy
  depth: validation
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract]
  links:
    - target: ${identity.definitionId}
      type: refines
${renderSourcesYaml([testPath])}
---

# ${displayName} — Pack Validation Tests

## 목적 ^purpose

${identity.packId} pack의 generated test skeleton과 추가할 domain-specific 검증 항목을 매핑한다.

## 검증 매핑

- \`${testPath}\` verifies \`${identity.symbols.validateFunctionName}()\`.
- Add domain-specific axis, taxonomy, relation, traversal, and blueprint expectations before activation.
`;
}

function renderComponentSchemaFile(identity: OntologyPackScaffoldIdentity): string {
  const { symbols } = identity;
  const axisDeclarationsName = `${symbols.camelName}Axes`;
  const taxonomyDeclarationsName = `${symbols.camelName}Taxonomies`;
  const relationCategoryDeclarationsName = `${symbols.camelName}RelationCategories`;
  const traversalDeclarationsName = `${symbols.camelName}Traversals`;
  return `import type {
  AxisSchema,
  OperationalOntologySchema,
  RelationCategorySchema,
  TaxonomySchema,
  TraversalSchema,
} from "operational-ontology/schema";

// Identity constants
export const ${symbols.packIdConstantName} = "${identity.packId}" as const;
export const ${symbols.axisIdConstantName} = "${identity.defaultAxisId}" as const;
export const ${symbols.taxonomyIdConstantName} = "${identity.defaultTaxonomyId}" as const;
export const ${symbols.relationCategoryConstantName} = "${identity.defaultRelationCategory}" as const;
export const ${symbols.traversalPurposeConstantName} = "${identity.defaultTraversalPurpose}" as const;

// Component-like schema: axes
export const ${axisDeclarationsName} = [
  {
    id: ${symbols.axisIdConstantName},
    values: ["example"],
    stable: true,
    capacity: 4,
  },
] satisfies AxisSchema[];

// Component-like schema: taxonomies
export const ${taxonomyDeclarationsName} = [
  {
    id: ${symbols.taxonomyIdConstantName},
    appliesTo: ["node"],
    axisIds: [${symbols.axisIdConstantName}],
    identityAxisIds: [${symbols.axisIdConstantName}],
    space: ${symbols.packIdConstantName},
  },
] satisfies TaxonomySchema[];

// Component-like schema: relation categories
export const ${relationCategoryDeclarationsName} = [
  {
    category: ${symbols.relationCategoryConstantName},
    requiredAxes: [${symbols.axisIdConstantName}],
  },
] satisfies RelationCategorySchema[];

// Component-like schema: traversals
export const ${traversalDeclarationsName} = [
  {
    purpose: ${symbols.traversalPurposeConstantName},
    allowedRelationCategories: [${symbols.relationCategoryConstantName}],
    canonicalizable: true,
  },
] satisfies TraversalSchema[];

export const ${symbols.schemaConstantName} = {
  axes: ${axisDeclarationsName},
  taxonomies: ${taxonomyDeclarationsName},
  relationCategories: ${relationCategoryDeclarationsName},
  traversals: ${traversalDeclarationsName},
} satisfies OperationalOntologySchema;
`;
}

function renderSystemBindingFile(
  identity: OntologyPackScaffoldIdentity,
  componentSchemaPath: string,
  testPath: string,
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

// System-like bindings: blueprints
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
    verificationBinding: {
      coordinateRef: "corridor:${identity.safePackId}-binding",
      verificationRefs: [
        {
          kind: "test",
          ref: "${testPath}",
        },
      ],
    },
    constraints: [
      { kind: "unit_boundary", severity: "core" },
      { kind: "validation_surface", requiredRefs: ["test"] },
    ],
    evolutionPolicy: { kind: "append_only" },
  },
] satisfies readonly ImplementationBlueprint[];

// System-like bindings: pack contract
export const ${symbols.packConstantName} = {
  packId: ${symbols.packIdConstantName},
  schema: ${symbols.schemaConstantName},
  blueprints: ${symbols.blueprintsConstantName},
} satisfies OperationalOntologyPack;

// System-like bindings: validation helper
export function ${symbols.validateFunctionName}(): OperationalOntologyPackValidationResult {
  return validateOperationalOntologyPack(${symbols.packConstantName});
}
`;
}

function renderPackTestFile(
  identity: OntologyPackScaffoldIdentity,
  testPath: string,
  systemBindingPath: string,
): string {
  const { symbols } = identity;
  const importPath = toRelativeJsModuleSpecifier(testPath, systemBindingPath);
  return `import { describe, expect, it } from "vitest";

import {
  ${symbols.packConstantName},
  ${symbols.validateFunctionName},
} from "${importPath}";

describe("${identity.packId} ontology pack", () => {
  it("validates the pack contract", () => {
    expect(${symbols.validateFunctionName}().valid).toBe(true);
    expect(${symbols.packConstantName}.packId).toBe("${identity.packId}");
  });

  it("documents domain axis and taxonomy expectations", () => {
    // TODO(pack-author): Replace scaffold expectations with domain-specific axis and taxonomy invariants.
    expect(${symbols.packConstantName}.schema.axes.map((axis) => axis.id)).toContain("${identity.defaultAxisId}");
    expect(${symbols.packConstantName}.schema.taxonomies.map((taxonomy) => taxonomy.id)).toContain("${identity.defaultTaxonomyId}");
  });

  it("documents blueprint and system binding expectations", () => {
    // TODO(pack-author): Replace scaffold expectations with domain-specific blueprint and system binding invariants.
    expect(${symbols.packConstantName}.blueprints?.map((blueprint) => blueprint.blueprintId)).toContain("${identity.safePackId}-binding");
    expect(${symbols.packConstantName}.blueprints?.some((blueprint) =>
      blueprint.verificationBinding?.verificationRefs.some((ref) => ref.kind === "test"),
    )).toBe(true);
  });
});
`;
}
