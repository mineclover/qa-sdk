// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { EnvDiscoveryClient } from "./types.js";
import { generateEnvFile, type EnvFileOptions, type PgDomain } from "./env-file.js";
import { generateTypescriptModule } from "./typescript-module.js";
import { generateDockerComposeOverride } from "./docker-compose.js";

export interface ExportFileResult {
  outPath: string;
  content: string;
}

export interface WriteEnvExportOptions extends EnvFileOptions {
  outPath?: string;
  configPath?: string;
}

export interface WriteTypescriptExportOptions {
  env: string;
  outPath?: string;
}

export interface WriteDockerComposeExportOptions {
  env: string;
  outPath?: string;
}

/** config JSON에서 서비스별 설정 로딩 */
export async function loadServiceConfig(
  configPath: string | undefined,
  serviceId: string,
): Promise<Record<string, unknown> | undefined> {
  if (!configPath) return undefined;
  try {
    const raw = JSON.parse(await readFile(configPath, "utf-8"));
    return raw.services?.[serviceId] as Record<string, unknown> | undefined;
  } catch {
    return undefined;
  }
}

export async function writeEnvExport(
  discovery: EnvDiscoveryClient,
  options: WriteEnvExportOptions,
): Promise<ExportFileResult> {
  const serviceConfig = await loadServiceConfig(options.configPath, options.serviceId);
  const content = await generateEnvFile(discovery, options, serviceConfig);
  const outPath = options.outPath ?? `.env.${options.serviceId}.${options.env}`;
  await mkdir(resolve(outPath, ".."), { recursive: true });
  await writeFile(outPath, content);
  return { outPath, content };
}

export async function writeTypescriptExport(
  discovery: EnvDiscoveryClient,
  options: WriteTypescriptExportOptions,
): Promise<ExportFileResult> {
  const content = await generateTypescriptModule(discovery, options.env);
  const outPath = options.outPath ?? `generated/service-connections.${options.env}.ts`;
  await mkdir(resolve(outPath, ".."), { recursive: true });
  await writeFile(outPath, content);
  return { outPath, content };
}

export async function writeDockerComposeExport(
  discovery: EnvDiscoveryClient,
  options: WriteDockerComposeExportOptions,
): Promise<ExportFileResult> {
  const content = await generateDockerComposeOverride(discovery, options.env);
  const outPath = options.outPath ?? `generated/docker-compose.override.${options.env}.yml`;
  await mkdir(resolve(outPath, ".."), { recursive: true });
  await writeFile(outPath, content);
  return { outPath, content };
}

export type { EnvFileOptions, PgDomain };
