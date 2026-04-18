import { stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { parseCodeReferenceTarget } from "definition-catalog";
import type { OperationalOntologyPack } from "operational-ontology/pack";

import type {
  OntologyPackValidateFileReadiness,
  OntologyPackValidateFileRef,
  OntologyPackValidateIssue,
} from "./types.js";

type RecordLike = Record<string, unknown>;
type FileReadinessKind = OntologyPackValidateFileRef["kind"];

interface FileRefSummaryInput {
  readonly kind: FileReadinessKind;
  readonly ref: string;
  readonly path: string;
  readonly rootDir: string;
  readonly source: "blueprint" | "scaffold-metadata";
  readonly surfaceKind?: string;
  readonly blueprintId?: string;
}

export interface OntologyPackFileReadiness {
  readonly fileRefs: readonly OntologyPackValidateFileRef[];
  readonly issues: readonly OntologyPackValidateIssue[];
  readonly implementationFiles: OntologyPackValidateFileReadiness;
  readonly testFiles: OntologyPackValidateFileReadiness;
}

export async function collectFileReadiness(input: {
  readonly pack: OperationalOntologyPack;
  readonly rootDir: string;
}): Promise<OntologyPackFileReadiness> {
  const fileRefs = await collectStaticFileRefs(input.pack, input.rootDir);
  return {
    fileRefs,
    issues: fileReadinessIssues(fileRefs),
    implementationFiles: summarizeFileReadiness(fileRefs, "implementation"),
    testFiles: summarizeFileReadiness(fileRefs, "test"),
  };
}

export function emptyFileReadiness(): OntologyPackFileReadiness {
  const fileRefs: readonly OntologyPackValidateFileRef[] = [];
  return {
    fileRefs,
    issues: [],
    implementationFiles: summarizeFileReadiness(fileRefs, "implementation"),
    testFiles: summarizeFileReadiness(fileRefs, "test"),
  };
}

export async function collectStaticFileRefs(
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

export function fileReadinessIssues(
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

export function summarizeFileReadiness(
  refs: readonly OntologyPackValidateFileRef[],
  kind: FileReadinessKind,
): OntologyPackValidateFileReadiness {
  const checked = refs.filter((ref) => ref.kind === kind);
  const missing = checked.filter((ref) => !ref.exists);
  return {
    status: checked.length === 0 ? "skipped" : missing.length === 0 ? "ready" : "missing",
    checked,
    missing,
  };
}

async function fileRefSummary(input: FileRefSummaryInput): Promise<OntologyPackValidateFileRef> {
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
): Array<Omit<FileRefSummaryInput, "rootDir">> {
  const metadata = isRecord(pack.metadata) ? pack.metadata : {};
  const scaffold = isRecord(metadata["scaffold"]) ? metadata["scaffold"] as RecordLike : metadata;
  const refs: Array<Omit<FileRefSummaryInput, "rootDir">> = [];

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

function toDisplayPath(rootDir: string, path: string): string {
  if (!isAbsolute(path)) return path.replaceAll("\\", "/").replace(/^\.\//, "");
  const relativePath = relative(rootDir, path).replaceAll("\\", "/");
  if (relativePath && !relativePath.startsWith("../") && relativePath !== "..") {
    return relativePath;
  }
  return path.replaceAll("\\", "/");
}
