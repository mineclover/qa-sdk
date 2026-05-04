// @def.boundary scaffold-domain-schematic
import { copyFile, mkdir, stat } from "node:fs/promises";
import { basename, dirname, join, normalize } from "node:path";

export interface PromoteOpenApiOptions {
  readonly source: string;
  readonly contractsRoot: string;
  readonly domain?: string;
  readonly force?: boolean;
}

export interface PromoteOpenApiResult {
  readonly domain: string;
  readonly source: string;
  readonly target: string;
}

export async function promoteOpenApiFragment(options: PromoteOpenApiOptions): Promise<PromoteOpenApiResult> {
  const source = normalize(options.source);
  const domain = options.domain ?? inferDomain(source);
  const target = join(normalize(options.contractsRoot), "openapi", "domains", domain, "spec.json");

  await assertFile(source, "source OpenAPI fragment");
  if (!options.force && await exists(target)) {
    throw new Error(`target OpenAPI domain spec already exists: ${target}`);
  }

  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);

  return {
    domain,
    source,
    target,
  };
}

function inferDomain(source: string): string {
  const normalized = source.replace(/\\/g, "/");
  const domainSpecMatch = normalized.match(/\/openapi\/domains\/([^/]+)\/spec\.json$/);
  if (domainSpecMatch?.[1]) return domainSpecMatch[1];

  const openApiFile = basename(normalized).match(/^(.+)\.openapi\.json$/);
  if (openApiFile?.[1]) return openApiFile[1];

  const parts = normalized.split("/");
  const contractsIndex = parts.lastIndexOf("contracts");
  if (contractsIndex > 0) return parts[contractsIndex - 1];

  throw new Error("domain could not be inferred. Pass --domain <name>.");
}

async function assertFile(path: string, label: string): Promise<void> {
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) {
    throw new Error(`${label} does not exist: ${path}`);
  }
}

async function exists(path: string): Promise<boolean> {
  return Boolean(await stat(path).catch(() => null));
}
