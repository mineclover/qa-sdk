// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { ProgrammingArtifactRegistryRecord } from "operational-ontology/programming-artifacts";

interface ProgrammingArtifactRegistryEnvelope {
  artifacts?: ProgrammingArtifactRegistryRecord[];
  [key: string]: unknown;
}

export interface AppendProgrammingArtifactRegistryRecordResult {
  registryPath: string;
  record: ProgrammingArtifactRegistryRecord;
  recordCount: number;
}

export async function appendProgrammingArtifactRegistryRecord(
  registryPath: string,
  record: ProgrammingArtifactRegistryRecord,
): Promise<AppendProgrammingArtifactRegistryRecordResult> {
  const resolvedPath = resolve(registryPath);
  const payload = await readProgrammingArtifactRegistryEnvelope(resolvedPath);
  const existing = Array.isArray(payload.artifacts) ? payload.artifacts : [];
  const artifacts = upsertProgrammingArtifactRecord(existing, record);

  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(
    resolvedPath,
    JSON.stringify({ ...payload, artifacts }, null, 2) + "\n",
    "utf8",
  );

  return {
    registryPath: resolvedPath,
    record,
    recordCount: artifacts.length,
  };
}

export async function appendProgrammingArtifactRegistryRecords(
  registryPath: string,
  records: readonly ProgrammingArtifactRegistryRecord[],
): Promise<AppendProgrammingArtifactRegistryRecordResult[]> {
  const results: AppendProgrammingArtifactRegistryRecordResult[] = [];
  for (const record of records) {
    results.push(await appendProgrammingArtifactRegistryRecord(registryPath, record));
  }
  return results;
}

async function readProgrammingArtifactRegistryEnvelope(
  registryPath: string,
): Promise<ProgrammingArtifactRegistryEnvelope> {
  if (!existsSync(registryPath)) return { artifacts: [] };

  const payload = JSON.parse(await readFile(registryPath, "utf8")) as
    | ProgrammingArtifactRegistryRecord[]
    | ProgrammingArtifactRegistryEnvelope;
  if (Array.isArray(payload)) return { artifacts: payload };
  return payload;
}

function upsertProgrammingArtifactRecord(
  records: readonly ProgrammingArtifactRegistryRecord[],
  next: ProgrammingArtifactRegistryRecord,
): ProgrammingArtifactRegistryRecord[] {
  const replaced = records.map((record) =>
    isSameProgrammingArtifactRecord(record, next) ? next : record,
  );
  return replaced.some((record) => record === next) ? replaced : [...replaced, next];
}

function isSameProgrammingArtifactRecord(
  left: ProgrammingArtifactRegistryRecord,
  right: ProgrammingArtifactRegistryRecord,
): boolean {
  return (
    left.artifactId === right.artifactId ||
    left.artifactRef === right.artifactRef ||
    (Boolean(left.outputPath) && left.outputPath === right.outputPath)
  );
}
