import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

import { parseCodeReferenceTarget } from "definition-catalog";
import type { OperationalOntologyPack } from "operational-ontology/pack";

import { createDefinitionMarkdownAdapter } from "./docs-control-plane/adapters/definition-markdown.js";
import type { DocumentEnvelope, DocumentSource } from "./docs-control-plane/types.js";
import { loadOntologyPack } from "./ontology-pack-validate/load-pack.js";
import { validateOntologyPackRuntime } from "./ontology-pack-validate/runtime-validation.js";
import type {
  OntologyPackValidateIssue,
  OntologyPackValidateResolution,
  OntologyPackValidateRuntimeSummary,
} from "./ontology-pack-validate/types.js";
export type {
  OntologyPackValidateIssue,
  OntologyPackValidateIssueLevel,
  OntologyPackValidateIssueSource,
  OntologyPackValidateResolution,
  OntologyPackValidateRuntimeSummary,
} from "./ontology-pack-validate/types.js";

export interface OntologyPackValidateFileRef {
  readonly kind: "implementation" | "test";
  readonly ref: string;
  readonly path: string;
  readonly absolutePath: string;
  readonly exists: boolean;
  readonly source: "blueprint" | "scaffold-metadata";
  readonly surfaceKind?: string;
  readonly blueprintId?: string;
}

export interface OntologyPackValidateIdentitySummary {
  readonly packId: string | null;
  readonly schemaPresent: boolean;
  readonly metadataKeys: readonly string[];
}

export interface OntologyPackValidateComponentSchemaSummary {
  readonly axes: readonly string[];
  readonly taxonomies: readonly string[];
  readonly relationCategories: readonly string[];
  readonly traversals: readonly string[];
  readonly counts: {
    readonly axes: number;
    readonly taxonomies: number;
    readonly relationCategories: number;
    readonly traversals: number;
  };
}

export interface OntologyPackValidateSystemBindingSummary {
  readonly blueprints: readonly {
    readonly blueprintId: string;
    readonly coordinateRef: string;
    readonly unitKind: string;
    readonly requiredSchemas: readonly string[];
    readonly implementationRefs: readonly string[];
    readonly verificationRefs: readonly string[];
  }[];
  readonly counts: {
    readonly blueprints: number;
    readonly implementationRefs: number;
    readonly verificationRefs: number;
  };
}

export interface OntologyPackValidateDocsReadiness {
  readonly status: "missing" | "partial" | "ready" | "skipped";
  readonly familyId: string;
  readonly matchingDocs: readonly {
    readonly docId: string;
    readonly kind: string;
    readonly path: string;
    readonly sourceCount: number;
  }[];
}

export interface OntologyPackValidateSourceMapReadiness {
  readonly status: "missing" | "partial" | "ready" | "skipped";
  readonly checkedRefs: readonly string[];
  readonly coveredRefs: readonly string[];
  readonly missingRefs: readonly string[];
  readonly coverage: readonly {
    readonly path: string;
    readonly covered: boolean;
    readonly docIds: readonly string[];
  }[];
}

export interface OntologyPackValidateReadiness {
  readonly implementationFiles: {
    readonly status: "missing" | "ready" | "skipped";
    readonly checked: readonly OntologyPackValidateFileRef[];
    readonly missing: readonly OntologyPackValidateFileRef[];
  };
  readonly testFiles: {
    readonly status: "missing" | "ready" | "skipped";
    readonly checked: readonly OntologyPackValidateFileRef[];
    readonly missing: readonly OntologyPackValidateFileRef[];
  };
  readonly docs: OntologyPackValidateDocsReadiness;
  readonly sourceMap: OntologyPackValidateSourceMapReadiness;
}

export interface OntologyPackValidateResult {
  readonly valid: boolean;
  readonly packRef: string;
  readonly packId: string | null;
  readonly resolution: OntologyPackValidateResolution;
  readonly issues: readonly OntologyPackValidateIssue[];
  readonly identity: OntologyPackValidateIdentitySummary;
  readonly componentSchema: OntologyPackValidateComponentSchemaSummary;
  readonly systemBindings: OntologyPackValidateSystemBindingSummary;
  readonly readiness: OntologyPackValidateReadiness;
  readonly runtime: OntologyPackValidateRuntimeSummary;
}

export interface ValidateOntologyPackInput {
  readonly packRef: string;
  readonly rootDir?: string;
}

type RecordLike = Record<string, unknown>;

export async function validateOntologyPackFromRef(
  input: ValidateOntologyPackInput,
): Promise<OntologyPackValidateResult> {
  const invocationDir = resolve(input.rootDir ?? process.cwd());
  const rootDir = findWorkspaceRoot(invocationDir);
  const loaded = await loadOntologyPack(input.packRef, rootDir, invocationDir);
  const pack = loaded.pack;
  const runtimeValidation = pack
    ? validateOntologyPackRuntime(pack)
    : { issues: [], summary: { valid: true, issueCount: 0 } };
  const fileRefs = pack ? await collectStaticFileRefs(pack, rootDir) : [];
  const fileIssues = fileReadinessIssues(fileRefs);
  const docsReadiness = pack
    ? await collectDocsReadiness(pack.packId, rootDir, fileRefs)
    : emptyDocsReadiness(null);
  const issues = [
    ...loaded.issues,
    ...runtimeValidation.issues,
    ...fileIssues,
    ...docsReadiness.issues,
  ];

  return {
    valid: issues.every((issue) => issue.level !== "error"),
    packRef: input.packRef,
    packId: pack?.packId ?? null,
    resolution: loaded.resolution,
    issues,
    identity: summarizeIdentity(pack),
    componentSchema: summarizeComponentSchema(pack),
    systemBindings: summarizeSystemBindings(pack),
    readiness: {
      implementationFiles: summarizeFileReadiness(fileRefs, "implementation"),
      testFiles: summarizeFileReadiness(fileRefs, "test"),
      docs: docsReadiness.docs,
      sourceMap: docsReadiness.sourceMap,
    },
    runtime: runtimeValidation.summary,
  };
}

async function collectStaticFileRefs(
  pack: OperationalOntologyPack,
  rootDir: string,
): Promise<readonly OntologyPackValidateFileRef[]> {
  const refs: OntologyPackValidateFileRef[] = [];
  for (const blueprint of pack.blueprints ?? []) {
    for (const ref of blueprint.implementationBinding?.implementationRefs ?? []) {
      const path = staticFilePathFromRef(ref.ref);
      if (!path) continue;
      refs.push(await fileRefSummary({
        kind: "implementation",
        ref: ref.ref,
        path,
        rootDir,
        source: "blueprint",
        surfaceKind: ref.kind,
        blueprintId: blueprint.blueprintId,
      }));
    }

    for (const ref of blueprint.verificationBinding?.verificationRefs ?? []) {
      const path = staticFilePathFromRef(ref.ref);
      if (!path) continue;
      refs.push(await fileRefSummary({
        kind: "test",
        ref: ref.ref,
        path,
        rootDir,
        source: "blueprint",
        surfaceKind: ref.kind,
        blueprintId: blueprint.blueprintId,
      }));
    }
  }

  for (const metadataRef of scaffoldMetadataFileRefs(pack)) {
    refs.push(await fileRefSummary({ ...metadataRef, rootDir }));
  }

  return uniqueFileRefs(refs);
}

async function fileRefSummary(input: {
  readonly kind: "implementation" | "test";
  readonly ref: string;
  readonly path: string;
  readonly rootDir: string;
  readonly source: "blueprint" | "scaffold-metadata";
  readonly surfaceKind?: string;
  readonly blueprintId?: string;
}): Promise<OntologyPackValidateFileRef> {
  const absolutePath = isAbsolute(input.path)
    ? input.path
    : resolve(input.rootDir, input.path);
  const exists = await fileExists(absolutePath);
  return {
    kind: input.kind,
    ref: input.ref,
    path: toDisplayPath(input.rootDir, absolutePath),
    absolutePath,
    exists,
    source: input.source,
    ...(input.surfaceKind ? { surfaceKind: input.surfaceKind } : {}),
    ...(input.blueprintId ? { blueprintId: input.blueprintId } : {}),
  };
}

function scaffoldMetadataFileRefs(
  pack: OperationalOntologyPack,
): Array<Omit<Parameters<typeof fileRefSummary>[0], "rootDir">> {
  const metadata = isRecord(pack.metadata) ? pack.metadata : {};
  const scaffold = isRecord(metadata["scaffold"]) ? metadata["scaffold"] as RecordLike : metadata;
  const refs: Array<Omit<Parameters<typeof fileRefSummary>[0], "rootDir">> = [];

  const candidates = Array.isArray(scaffold["sourceMapCandidates"])
    ? scaffold["sourceMapCandidates"]
    : [];
  for (const candidate of candidates) {
    if (!isRecord(candidate) || typeof candidate["sourcePath"] !== "string") continue;
    const sourceRole = typeof candidate["sourceRole"] === "string" ? candidate["sourceRole"] : "";
    const kind = sourceRole === "test" ? "test" : "implementation";
    const path = staticFilePathFromRef(candidate["sourcePath"]);
    if (!path) continue;
    refs.push({
      kind,
      ref: candidate["sourcePath"],
      path,
      source: "scaffold-metadata",
      surfaceKind: sourceRole || undefined,
    });
  }

  const files = Array.isArray(scaffold["files"]) ? scaffold["files"] : [];
  for (const file of files) {
    if (!isRecord(file) || typeof file["path"] !== "string") continue;
    const role = typeof file["role"] === "string" ? file["role"] : "";
    const kind = /test|verification/.test(role) ? "test" : "implementation";
    const path = staticFilePathFromRef(file["path"]);
    if (!path) continue;
    refs.push({
      kind,
      ref: file["path"],
      path,
      source: "scaffold-metadata",
      surfaceKind: role || undefined,
    });
  }

  return refs;
}

function fileReadinessIssues(
  refs: readonly OntologyPackValidateFileRef[],
): readonly OntologyPackValidateIssue[] {
  return refs
    .filter((ref) => !ref.exists)
    .map((ref) => ({
      level: "error" as const,
      source: "file" as const,
      path: `readiness.${ref.kind}Files.${ref.path}`,
      code: `${ref.kind}-file-missing`,
      message: `Referenced ${ref.kind} file "${ref.path}" does not exist.`,
      ...(ref.blueprintId ? { blueprintId: ref.blueprintId } : {}),
      details: {
        ref: ref.ref,
        source: ref.source,
        ...(ref.surfaceKind ? { surfaceKind: ref.surfaceKind } : {}),
      },
    }));
}

async function collectDocsReadiness(
  packId: string,
  rootDir: string,
  fileRefs: readonly OntologyPackValidateFileRef[],
): Promise<{
  readonly docs: OntologyPackValidateDocsReadiness;
  readonly sourceMap: OntologyPackValidateSourceMapReadiness;
  readonly issues: readonly OntologyPackValidateIssue[];
}> {
  const docs = await matchingDocsForPack(packId, rootDir);
  if (docs.length === 0) {
    return emptyDocsReadiness(packId);
  }

  const docsSummary = docs.map((doc) => ({
    docId: docIdOf(doc),
    kind: doc.kind,
    path: doc.path,
    sourceCount: doc.sources.length,
  }));
  const sourcesByPath = new Map<string, Set<string>>();
  for (const doc of docs) {
    for (const source of doc.sources) {
      const sourcePath = sourcePathOf(source);
      if (!sourcePath) continue;
      const docsForSource = sourcesByPath.get(sourcePath) ?? new Set<string>();
      docsForSource.add(docIdOf(doc));
      sourcesByPath.set(sourcePath, docsForSource);
    }
  }

  const checkedRefs = uniqueStrings(fileRefs.map((ref) => ref.path));
  const coverage = checkedRefs.map((path) => {
    const docIds = [...(sourcesByPath.get(path) ?? new Set<string>())].toSorted();
    return { path, covered: docIds.length > 0, docIds };
  });
  const coveredRefs = coverage.filter((item) => item.covered).map((item) => item.path);
  const missingRefs = coverage.filter((item) => !item.covered).map((item) => item.path);
  const sourceMapStatus = checkedRefs.length === 0
    ? "skipped"
    : missingRefs.length === 0
      ? "ready"
      : coveredRefs.length > 0
        ? "partial"
        : "missing";
  const docsStatus = docs.length > 0 && sourceMapStatus === "ready"
    ? "ready"
    : docs.length > 0
      ? "partial"
      : "missing";
  const sourceMapIssues: OntologyPackValidateIssue[] = missingRefs.map((path) => ({
    level: "warning",
    source: "source-map",
    path: `readiness.sourceMap.${path}`,
    code: "source-map-missing",
    message: `Matching docs family does not declare source-map coverage for "${path}".`,
    details: {
      familyId: `${packId}-system`,
    },
  }));

  return {
    docs: {
      status: docsStatus,
      familyId: `${packId}-system`,
      matchingDocs: docsSummary,
    },
    sourceMap: {
      status: sourceMapStatus,
      checkedRefs,
      coveredRefs,
      missingRefs,
      coverage,
    },
    issues: sourceMapIssues,
  };
}

async function matchingDocsForPack(
  packId: string,
  rootDir: string,
): Promise<readonly DocumentEnvelope[]> {
  if (!existsSync(join(rootDir, "docs"))) return [];
  const adapter = createDefinitionMarkdownAdapter({ rootDir, docsDirs: ["docs"] });
  const docs = await adapter.listDocuments();
  const prefix = `${packId}-`;
  const systemDocId = `${packId}-system`;

  return docs
    .filter((doc) => {
      const docId = docIdOf(doc);
      const file = basename(doc.path);
      return docId === systemDocId
        || docId.startsWith(prefix)
        || file === `${systemDocId}.spec.md`
        || file.startsWith(prefix);
    })
    .toSorted((left, right) => left.path.localeCompare(right.path));
}

function emptyDocsReadiness(packId: string | null): {
  readonly docs: OntologyPackValidateDocsReadiness;
  readonly sourceMap: OntologyPackValidateSourceMapReadiness;
  readonly issues: readonly OntologyPackValidateIssue[];
} {
  return {
    docs: {
      status: "skipped",
      familyId: packId ? `${packId}-system` : "",
      matchingDocs: [],
    },
    sourceMap: {
      status: "skipped",
      checkedRefs: [],
      coveredRefs: [],
      missingRefs: [],
      coverage: [],
    },
    issues: [],
  };
}

function summarizeFileReadiness(
  refs: readonly OntologyPackValidateFileRef[],
  kind: "implementation" | "test",
): OntologyPackValidateReadiness["implementationFiles"] {
  const checked = refs.filter((ref) => ref.kind === kind);
  const missing = checked.filter((ref) => !ref.exists);
  return {
    status: checked.length === 0 ? "skipped" : missing.length === 0 ? "ready" : "missing",
    checked,
    missing,
  };
}

function summarizeIdentity(
  pack: OperationalOntologyPack | null,
): OntologyPackValidateIdentitySummary {
  return {
    packId: typeof pack?.packId === "string" ? pack.packId : null,
    schemaPresent: Boolean(pack?.schema),
    metadataKeys: Object.keys(pack?.metadata ?? {}).toSorted(),
  };
}

function summarizeComponentSchema(
  pack: OperationalOntologyPack | null,
): OntologyPackValidateComponentSchemaSummary {
  const axes = pack?.schema?.axes?.map((axis) => axis.id).toSorted() ?? [];
  const taxonomies = pack?.schema?.taxonomies?.map((taxonomy) => taxonomy.id).toSorted() ?? [];
  const relationCategories =
    pack?.schema?.relationCategories?.map((category) => category.category).toSorted() ?? [];
  const traversals = pack?.schema?.traversals?.map((traversal) => traversal.purpose).toSorted() ?? [];

  return {
    axes,
    taxonomies,
    relationCategories,
    traversals,
    counts: {
      axes: axes.length,
      taxonomies: taxonomies.length,
      relationCategories: relationCategories.length,
      traversals: traversals.length,
    },
  };
}

function summarizeSystemBindings(
  pack: OperationalOntologyPack | null,
): OntologyPackValidateSystemBindingSummary {
  const blueprints = (pack?.blueprints ?? []).map((blueprint) => ({
    blueprintId: blueprint.blueprintId,
    coordinateRef: blueprint.coordinateRef,
    unitKind: blueprint.unitKind,
    requiredSchemas: [...(blueprint.requiredSchemas ?? [])].toSorted(),
    implementationRefs: (blueprint.implementationBinding?.implementationRefs ?? [])
      .map((ref) => ref.ref)
      .toSorted(),
    verificationRefs: (blueprint.verificationBinding?.verificationRefs ?? [])
      .map((ref) => ref.ref)
      .toSorted(),
  })).toSorted((left, right) => left.blueprintId.localeCompare(right.blueprintId));
  return {
    blueprints,
    counts: {
      blueprints: blueprints.length,
      implementationRefs: blueprints.reduce(
        (count, blueprint) => count + blueprint.implementationRefs.length,
        0,
      ),
      verificationRefs: blueprints.reduce(
        (count, blueprint) => count + blueprint.verificationRefs.length,
        0,
      ),
    },
  };
}

function staticFilePathFromRef(ref: string): string | null {
  const parsed = parseCodeReferenceTarget(ref.replaceAll("\\", "/"));
  if (!parsed) return null;
  return parsed.codePath;
}

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function sourcePathOf(source: DocumentSource): string | null {
  if (!source.path) return null;
  return source.path.replaceAll("\\", "/");
}

function docIdOf(doc: DocumentEnvelope): string {
  return typeof doc.metadata["defId"] === "string" ? doc.metadata["defId"] : doc.stableId;
}

function uniqueFileRefs(
  refs: readonly OntologyPackValidateFileRef[],
): readonly OntologyPackValidateFileRef[] {
  const seen = new Set<string>();
  const unique: OntologyPackValidateFileRef[] = [];
  for (const ref of refs) {
    const key = `${ref.kind}:${ref.path}:${ref.blueprintId ?? ""}:${ref.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(ref);
  }
  return unique.toSorted((left, right) =>
    left.kind.localeCompare(right.kind)
    || left.path.localeCompare(right.path)
    || (left.blueprintId ?? "").localeCompare(right.blueprintId ?? "")
  );
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)].toSorted();
}

function toDisplayPath(rootDir: string, path: string): string {
  if (!isAbsolute(path)) return path.replaceAll("\\", "/").replace(/^\.\//, "");
  const relativePath = relative(rootDir, path).replaceAll("\\", "/");
  if (relativePath && !relativePath.startsWith("../") && relativePath !== "..") {
    return relativePath;
  }
  return path.replaceAll("\\", "/");
}

function findWorkspaceRoot(startDir: string): string {
  let current = resolve(startDir);

  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml")) && existsSync(join(current, "docs"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return resolve(startDir);
    current = parent;
  }
}
