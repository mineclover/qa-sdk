// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  createProgrammingArtifactRegistryRecord,
  type ProgrammingArtifactRegistryRecord,
} from "operational-ontology/programming-artifacts";

import type { DeployResult, ProviderId } from "../core/types.js";
import type { FleetDeployResult, FleetRunOptions } from "../fleet/manager.js";

interface ProgrammingArtifactRegistryEnvelope {
  artifacts?: ProgrammingArtifactRegistryRecord[];
  [key: string]: unknown;
}

export interface DeploymentOutputArtifactRecordInput {
  service: string;
  env: string;
  provider: ProviderId | string;
  configPath: string;
  result: DeployResult;
  createdAt?: string;
  fleetRunId?: string;
  fleetMode?: string;
  fleetScope?: string;
}

export interface DeploymentOutputArtifactRegistryWriteInput
  extends DeploymentOutputArtifactRecordInput {
  artifactRegistry: string;
}

export interface FleetDeploymentArtifactRecordInput {
  env: string;
  configPath: string;
  result: FleetDeployResult;
  runId: string;
  mode: string;
  scope: string;
  options?: FleetRunOptions;
  createdAt?: string;
}

export interface FleetDeploymentArtifactRegistryWriteInput
  extends FleetDeploymentArtifactRecordInput {
  artifactRegistry: string;
}

export function buildDeploymentOutputArtifactRegistryRecord(
  input: DeploymentOutputArtifactRecordInput,
): ProgrammingArtifactRegistryRecord {
  const endpoint = input.result.endpoint;
  const artifactRef = endpoint || `deployment:${input.service}:${input.env}:${input.provider}`;
  return createProgrammingArtifactRegistryRecord({
    artifactId: `deployment-output-${slugRef(input.service)}-${slugRef(input.env)}-${slugRef(String(input.provider))}`,
    artifactRef,
    kind: "deployment-output",
    producedByRef: `infra deploy ${input.service} ${input.env} --provider ${input.provider}`,
    derivedFromRefs: [
      input.configPath,
      `service:${input.service}`,
      `env:${input.env}`,
      ...(input.fleetRunId ? [`fleet-run:${input.fleetRunId}`] : []),
    ],
    verifiesRefs: input.result.success
      ? [
          `service:${input.service}`,
          ...(endpoint ? [`endpoint:${endpoint}`] : []),
        ]
      : [],
    ownerDefinitionId: "infra-engine-pipeline",
    materializesOutputRefs: [
      `service:${input.service}`,
      `env:${input.env}`,
      ...(endpoint ? [`endpoint:${endpoint}`] : []),
    ],
    sourceRefs: [input.configPath],
    createdAt: input.createdAt ?? new Date().toISOString(),
    metadata: {
      service: input.service,
      env: input.env,
      provider: input.provider,
      endpoint,
      fleetRunId: input.fleetRunId,
      fleetMode: input.fleetMode,
      fleetScope: input.fleetScope,
      success: input.result.success,
      healthStatus: input.result.healthStatus,
      gateVerdict: input.result.gateVerdict,
      duration: input.result.duration,
      stageResults: input.result.stageResults,
    },
  });
}

export async function writeDeploymentOutputArtifactRegistryRecord(
  input: DeploymentOutputArtifactRegistryWriteInput,
): Promise<ProgrammingArtifactRegistryRecord | undefined> {
  if (!input.result.success) return undefined;

  const record = buildDeploymentOutputArtifactRegistryRecord(input);
  await appendProgrammingArtifactRegistryRecord(input.artifactRegistry, record);
  return record;
}

export function buildFleetDeploymentArtifactRegistryRecord(
  input: FleetDeploymentArtifactRecordInput,
): ProgrammingArtifactRegistryRecord {
  const successfulServices = input.result.results
    .filter((result) => result.success)
    .map((result) => result.serviceId);
  const failedServices = input.result.results
    .filter((result) => !result.success)
    .map((result) => result.serviceId);
  const artifactRef = `fleet-run:${input.runId}`;

  return createProgrammingArtifactRegistryRecord({
    artifactId: `fleet-deployment-${slugRef(input.env)}-${slugRef(input.mode)}-${slugRef(input.runId)}`,
    artifactRef,
    kind: "deployment-batch",
    producedByRef: [
      "infra deploy --all",
      input.env,
      ...(input.scope !== "all" ? ["--tier", input.scope] : []),
      ...(input.options?.provider ? ["--provider", input.options.provider] : []),
      ...(input.options?.sync ? ["--sync"] : []),
      ...(input.options?.continueOnError ? ["--continue-on-error"] : []),
      ...(input.options?.dryRun !== false ? ["--dry-run"] : []),
    ].join(" "),
    derivedFromRefs: [
      input.configPath,
      `env:${input.env}`,
      ...input.result.results.map((result) => `service:${result.serviceId}`),
    ],
    verifiesRefs: successfulServices.map((serviceId) => `service:${serviceId}`),
    ownerDefinitionId: "infra-engine-pipeline",
    materializesOutputRefs: [
      `env:${input.env}`,
      artifactRef,
      ...successfulServices.map((serviceId) => `service:${serviceId}`),
    ],
    sourceRefs: [input.configPath],
    createdAt: input.createdAt ?? new Date().toISOString(),
    metadata: {
      env: input.env,
      runId: input.runId,
      mode: input.mode,
      scope: input.scope,
      options: input.options,
      successCount: input.result.summary.success,
      failedCount: input.result.summary.failed,
      totalDuration: input.result.summary.totalDuration,
      successfulServices,
      failedServices,
      results: input.result.results,
    },
  });
}

export async function writeFleetDeploymentArtifactRegistryRecord(
  input: FleetDeploymentArtifactRegistryWriteInput,
): Promise<ProgrammingArtifactRegistryRecord> {
  const record = buildFleetDeploymentArtifactRegistryRecord(input);
  await appendProgrammingArtifactRegistryRecord(input.artifactRegistry, record);
  return record;
}

async function appendProgrammingArtifactRegistryRecord(
  registryPath: string,
  record: ProgrammingArtifactRegistryRecord,
): Promise<void> {
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

function slugRef(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}
