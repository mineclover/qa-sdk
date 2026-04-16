import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import {
  hasOntologyPackScaffoldErrors,
  type OntologyPackKnownPackCandidate,
  type OntologyPackScaffoldDiagnostic,
  type OntologyPackScaffoldPlan,
  type OntologyPackScaffoldPlannedFile,
} from "./ontology-pack-scaffold-plan.js";

export type OntologyPackScaffoldWriteStatus = "blocked" | "written";

export type OntologyPackScaffoldWriteFileStatus =
  | "blocked-existing"
  | "skipped"
  | "written";

export interface OntologyPackScaffoldWriteFileSummary {
  readonly role: string;
  readonly path: string;
  readonly bytes: number;
  readonly status: OntologyPackScaffoldWriteFileStatus;
}

export interface OntologyPackScaffoldWriteSummary {
  readonly mode: "write";
  readonly status: OntologyPackScaffoldWriteStatus;
  readonly writesApplied: boolean;
  readonly fileCount: number;
  readonly writtenCount: number;
  readonly blockedCount: number;
  readonly files: readonly OntologyPackScaffoldWriteFileSummary[];
  readonly writtenFiles: readonly OntologyPackScaffoldWriteFileSummary[];
  readonly blockedFiles: readonly OntologyPackScaffoldWriteFileSummary[];
  readonly diagnostics: readonly OntologyPackScaffoldDiagnostic[];
  readonly knownPackRegistrationCandidate: OntologyPackKnownPackCandidate;
}

export async function writeOntologyPackScaffoldPlan(
  plan: OntologyPackScaffoldPlan,
  options: { readonly rootDir?: string } = {},
): Promise<OntologyPackScaffoldWriteSummary> {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const files = plan.preview.files;

  if (hasOntologyPackScaffoldErrors(plan.diagnostics)) {
    return createBlockedWriteSummary(plan, files, [], plan.diagnostics);
  }

  const unsafePathDiagnostics = detectUnsafeMaterializationPaths(rootDir, files);
  if (unsafePathDiagnostics.length > 0) {
    return createBlockedWriteSummary(plan, files, [], unsafePathDiagnostics);
  }

  const existingFiles = await findExistingFiles(rootDir, files);
  if (existingFiles.length > 0) {
    const diagnostics = existingFiles.map((file) => ({
      severity: "error" as const,
      code: "existing-output-file" as const,
      message:
        `Refusing to overwrite existing scaffold output "${file.path}". Remove it first or wait for an explicit overwrite option.`,
      path: file.path,
      details: { role: file.role },
    }));
    return createBlockedWriteSummary(plan, files, existingFiles, diagnostics);
  }

  const writtenFiles: OntologyPackScaffoldWriteFileSummary[] = [];
  try {
    for (const file of files) {
      const absolutePath = resolve(rootDir, file.path);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, file.content, {
        encoding: "utf8",
        flag: "wx",
      });
      writtenFiles.push(toWriteFileSummary(file, "written"));
    }
  } catch (error) {
    const diagnostic: OntologyPackScaffoldDiagnostic = {
      severity: "error",
      code: "scaffold-write-failed",
      message:
        `Failed to write scaffold output: ${error instanceof Error ? error.message : String(error)}`,
    };
    const writtenPaths = new Set(writtenFiles.map((file) => file.path));
    const summaries = files.map((file) =>
      writtenPaths.has(file.path)
        ? toWriteFileSummary(file, "written")
        : toWriteFileSummary(file, "skipped")
    );
    return {
      mode: "write",
      status: "blocked",
      writesApplied: writtenFiles.length > 0,
      fileCount: files.length,
      writtenCount: writtenFiles.length,
      blockedCount: 0,
      files: summaries,
      writtenFiles,
      blockedFiles: [],
      diagnostics: [diagnostic],
      knownPackRegistrationCandidate: plan.knownPackCandidate,
    };
  }

  return {
    mode: "write",
    status: "written",
    writesApplied: true,
    fileCount: files.length,
    writtenCount: writtenFiles.length,
    blockedCount: 0,
    files: writtenFiles,
    writtenFiles,
    blockedFiles: [],
    diagnostics: [],
    knownPackRegistrationCandidate: plan.knownPackCandidate,
  };
}

function createBlockedWriteSummary(
  plan: OntologyPackScaffoldPlan,
  files: readonly OntologyPackScaffoldPlannedFile[],
  blockedFiles: readonly OntologyPackScaffoldPlannedFile[],
  diagnostics: readonly OntologyPackScaffoldDiagnostic[],
): OntologyPackScaffoldWriteSummary {
  const blockedPathSet = new Set(blockedFiles.map((file) => file.path));
  const summaries = files.map((file) =>
    blockedPathSet.has(file.path)
      ? toWriteFileSummary(file, "blocked-existing")
      : toWriteFileSummary(file, "skipped")
  );
  const blockedSummaries = summaries.filter((file) => file.status === "blocked-existing");

  return {
    mode: "write",
    status: "blocked",
    writesApplied: false,
    fileCount: files.length,
    writtenCount: 0,
    blockedCount: blockedSummaries.length,
    files: summaries,
    writtenFiles: [],
    blockedFiles: blockedSummaries,
    diagnostics,
    knownPackRegistrationCandidate: plan.knownPackCandidate,
  };
}

async function findExistingFiles(
  rootDir: string,
  files: readonly OntologyPackScaffoldPlannedFile[],
): Promise<OntologyPackScaffoldPlannedFile[]> {
  const existingFiles: OntologyPackScaffoldPlannedFile[] = [];
  for (const file of files) {
    const absolutePath = resolve(rootDir, file.path);
    if (await exists(absolutePath)) {
      existingFiles.push(file);
    }
  }
  return existingFiles;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

function detectUnsafeMaterializationPaths(
  rootDir: string,
  files: readonly OntologyPackScaffoldPlannedFile[],
): OntologyPackScaffoldDiagnostic[] {
  return files.flatMap((file) => {
    const absolutePath = resolve(rootDir, file.path);
    const repoRelativePath = relative(rootDir, absolutePath);
    const escapesRoot =
      repoRelativePath === ".."
      || repoRelativePath.startsWith("../")
      || repoRelativePath.startsWith("..\\")
      || repoRelativePath.length === 0;
    if (escapesRoot) {
      return [{
        severity: "error" as const,
        code: "unsafe-path" as const,
        message:
          `Refusing to materialize scaffold output outside the repository: "${file.path}".`,
        path: file.path,
      }];
    }
    return [];
  });
}

function toWriteFileSummary(
  file: OntologyPackScaffoldPlannedFile,
  status: OntologyPackScaffoldWriteFileStatus,
): OntologyPackScaffoldWriteFileSummary {
  return {
    role: file.role,
    path: file.path,
    bytes: Buffer.byteLength(file.content, "utf8"),
    status,
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
