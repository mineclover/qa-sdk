// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  PROGRAMMING_ARTIFACT_KINDS,
  PROGRAMMING_ARTIFACT_RELATION_KINDS,
  createProgrammingArtifactRegistryRecord,
  type ProgrammingArtifactRegistryRecord,
} from "operational-ontology/programming-artifacts";

import { appendProgrammingArtifactRegistryRecord } from "../../lib/programming-artifact-registry.js";

interface ProgrammingArtifactRegistryFile {
  artifacts?: ProgrammingArtifactRegistryRecord[];
}

interface ArtifactRegistryValidationIssue {
  level: "error" | "warning";
  code: string;
  artifactRef?: string;
  message: string;
}

export async function loadProgrammingArtifactRegistryRecords(
  registryPath: string,
): Promise<ProgrammingArtifactRegistryRecord[]> {
  const resolvedPath = resolve(registryPath);
  const payload = existsSync(resolvedPath)
    ? await loadJsonFile<
        ProgrammingArtifactRegistryRecord[] | ProgrammingArtifactRegistryFile
      >(resolvedPath)
    : { artifacts: [] };
  return Array.isArray(payload) ? payload : payload.artifacts ?? [];
}

export async function cmdArtifactRegistryValidate(rest: string[]): Promise<void> {
  const { flags } = parseArtifactRegistryFlags(rest);
  const input = flags["input"];
  if (!input) {
    console.error("Usage: qa-sdk ontology artifact registry validate --input <file> [--json]");
    return;
  }

  const records = await loadProgrammingArtifactRegistryRecords(input);
  const issues = validateProgrammingArtifactRegistryRecords(records);
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  const result = {
    input: resolve(input),
    valid: errors.length === 0,
    artifactCount: records.length,
    errors,
    warnings,
  };

  if (flags["json"] === "true") {
    printJson(result);
    return;
  }

  console.log(`${result.valid ? "valid" : "invalid"}: ${result.input}`);
  console.log(`artifacts: ${records.length}`);
  console.log(`errors: ${errors.length}`);
  console.log(`warnings: ${warnings.length}`);
  for (const issue of issues) {
    console.log(
      `  [${issue.level}] ${issue.code}${issue.artifactRef ? ` ${issue.artifactRef}` : ""}: ${issue.message}`,
    );
  }
}

export async function cmdArtifactRegistryList(rest: string[]): Promise<void> {
  const { flags } = parseArtifactRegistryFlags(rest);
  const input = flags["input"];
  if (!input) {
    console.error("Usage: qa-sdk ontology artifact registry list --input <file> [--kind <kind>] [--json]");
    return;
  }

  const kind = flags["kind"];
  const records = (await loadProgrammingArtifactRegistryRecords(input)).filter(
    (record) => !kind || record.kind === kind,
  );
  if (flags["json"] === "true") {
    printJson({ input: resolve(input), kind, artifacts: records });
    return;
  }

  console.log(`artifacts: ${records.length}`);
  for (const record of records) {
    console.log(`${record.kind}  ${record.artifactRef}  ${record.artifactId}`);
  }
}

export async function cmdArtifactRegistryAppend(rest: string[]): Promise<void> {
  const { flags } = parseArtifactRegistryFlags(rest);
  const output = flags["output"] ?? flags["artifact-registry"];
  if (!output) {
    console.error(
      "Usage: qa-sdk ontology artifact registry append --output <registry.json> (--input <record.json> | --kind <kind> --artifact-ref <ref>) [--json]",
    );
    return;
  }

  const input = flags["input"];
  const record = input
    ? await loadJsonFile<ProgrammingArtifactRegistryRecord>(resolve(input))
    : createRegistryRecordFromFlags(flags);
  const result = await appendProgrammingArtifactRegistryRecord(output, record);

  if (flags["json"] === "true") {
    printJson(result);
    return;
  }

  console.log(`artifact registry: ${record.artifactId} -> ${result.registryPath}`);
  console.log(`artifacts: ${result.recordCount}`);
}

function validateProgrammingArtifactRegistryRecords(
  records: readonly ProgrammingArtifactRegistryRecord[],
): ArtifactRegistryValidationIssue[] {
  const issues: ArtifactRegistryValidationIssue[] = [];
  const seenRefs = new Set<string>();
  const knownKinds = new Set<string>(PROGRAMMING_ARTIFACT_KINDS);
  const knownRelationKinds = new Set<string>(PROGRAMMING_ARTIFACT_RELATION_KINDS);

  for (const [index, record] of records.entries()) {
    const label = record.artifactRef || record.artifactId || `index:${index}`;
    if (!record.artifactId?.trim()) {
      issues.push({
        level: "error",
        code: "artifact-id-missing",
        artifactRef: label,
        message: "artifactId is required",
      });
    }
    if (!record.artifactRef?.trim()) {
      issues.push({
        level: "error",
        code: "artifact-ref-missing",
        artifactRef: label,
        message: "artifactRef is required",
      });
    } else if (seenRefs.has(record.artifactRef)) {
      issues.push({
        level: "warning",
        code: "artifact-ref-duplicate",
        artifactRef: record.artifactRef,
        message: "artifactRef appears more than once",
      });
    } else {
      seenRefs.add(record.artifactRef);
    }
    if (!knownKinds.has(record.kind)) {
      issues.push({
        level: "error",
        code: "artifact-kind-unknown",
        artifactRef: label,
        message: `Unknown artifact kind "${record.kind}"`,
      });
    }
    for (const relation of record.relations ?? []) {
      if (!knownRelationKinds.has(relation.kind)) {
        issues.push({
          level: "error",
          code: "artifact-relation-kind-unknown",
          artifactRef: label,
          message: `Unknown relation kind "${relation.kind}"`,
        });
      }
      if (!relation.fromRef?.trim() || !relation.toRef?.trim()) {
        issues.push({
          level: "error",
          code: "artifact-relation-endpoint-missing",
          artifactRef: label,
          message: `Relation "${relation.kind}" must have fromRef and toRef`,
        });
      }
    }
  }

  return issues;
}

function createRegistryRecordFromFlags(
  flags: Record<string, string>,
): ProgrammingArtifactRegistryRecord {
  const kind = flags["kind"];
  if (!kind) throw new Error("--kind is required");
  return createProgrammingArtifactRegistryRecord({
    artifactId: flags["artifact-id"],
    artifactRef: flags["artifact-ref"] ?? flags["ref"] ?? flags["output-path"],
    kind,
    producedByRef: flags["produced-by"],
    derivedFromRefs: commaValues(flags["derived-from"]),
    verifiesRefs: commaValues(flags["verifies"]),
    ownerDefinitionId: flags["owner-definition"],
    materializesOutputRefs: commaValues(flags["materializes-output"]),
    sourceRefs: commaValues(flags["source-ref"] ?? flags["source-refs"]),
    outputPath: flags["output-path"],
    verificationRefs: commaValues(flags["verification-ref"] ?? flags["verification-refs"]),
    createdAt: flags["created-at"] ?? new Date().toISOString(),
    metadata: parseOptionalMetadata(flags["metadata"]),
  });
}

function commaValues(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalMetadata(value: string | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--metadata must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function parseArtifactRegistryFlags(args: string[]): {
  positional: string[];
  flags: Record<string, string>;
} {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [key, inline] = arg.slice(2).split("=", 2);
    const next = args[index + 1];
    if (inline !== undefined) {
      flags[key] = inline;
    } else if (next && !next.startsWith("--")) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = "true";
    }
  }

  return { positional, flags };
}

async function loadJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}
