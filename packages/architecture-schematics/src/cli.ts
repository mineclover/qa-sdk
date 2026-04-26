#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { listTemplateCatalogs } from "./catalog.js";
import { promoteOpenApiFragment } from "./openapi-promote.js";
import { validateScenarios } from "./scenario-validator.js";
import { validateArchitecture, type SourceFileInput } from "./validator.js";

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "catalog") {
    printCatalog();
    return;
  }

  if (command === "validate") {
    const root = arg ?? "src";
    const files = await readArchitectureFiles(root);
    const result = validateArchitecture(files);

    if (result.issues.length === 0) {
      console.log(`architecture validation passed (${files.length} files)`);
      return;
    }

    for (const issue of result.issues) {
      const imported = issue.importPath ? ` import="${issue.importPath}"` : "";
      console.error(`${issue.severity.toUpperCase()} ${issue.ruleId} ${issue.path}${imported}`);
      console.error(`  ${issue.message}`);
    }
    process.exit(result.ok ? 0 : 1);
  }

  if (command === "promote-openapi") {
    const options = parsePromoteOpenApiArgs(process.argv.slice(3));
    const result = await promoteOpenApiFragment(options);
    console.log(`promoted OpenAPI domain spec: ${result.domain}`);
    console.log(`  ${result.source} -> ${result.target}`);
    return;
  }

  if (command === "validate-scenarios") {
    const root = arg ?? "docs/scenarios";
    const result = await validateScenarios(root);
    if (result.ok) {
      console.log(`scenario validation passed (${result.files.length} files)`);
      return;
    }
    for (const issue of result.issues) {
      console.error(`ERROR ${issue.ruleId} ${issue.path}`);
      console.error(`  ${issue.message}`);
    }
    process.exit(1);
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

function printHelp(): void {
  console.log(`qa-scaffold

Usage:
  qa-scaffold catalog
  qa-scaffold validate <path>
  qa-scaffold validate-scenarios <path>
  qa-scaffold promote-openapi <source> --contracts-root <path> [--domain <name>] [--force]
`);
}

function parsePromoteOpenApiArgs(args: string[]): {
  source: string;
  contractsRoot: string;
  domain?: string;
  force?: boolean;
} {
  const [source, ...rest] = args;
  if (!source) {
    throw new Error("promote-openapi requires a source file path.");
  }

  const options: {
    source: string;
    contractsRoot?: string;
    domain?: string;
    force?: boolean;
  } = { source };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--contracts-root") {
      options.contractsRoot = rest[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--domain") {
      options.domain = rest[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown promote-openapi option: ${arg}`);
  }

  if (!options.contractsRoot) {
    throw new Error("promote-openapi requires --contracts-root <path>.");
  }

  return options as {
    source: string;
    contractsRoot: string;
    domain?: string;
    force?: boolean;
  };
}

function printCatalog(): void {
  for (const catalog of listTemplateCatalogs()) {
    console.log(`${catalog.id}@${catalog.version} - ${catalog.description}`);
    console.log("artifacts:");
    for (const artifact of catalog.artifacts) {
      console.log(`  - ${artifact.id} [${artifact.layer}/${artifact.topology}] ${artifact.path}`);
    }
    console.log("rules:");
    for (const rule of catalog.rules) {
      console.log(`  - ${rule.id}: ${rule.description}`);
    }
  }
}

async function readArchitectureFiles(root: string): Promise<SourceFileInput[]> {
  const files: SourceFileInput[] = [];
  await collect(root, files);
  return files;
}

async function collect(path: string, files: SourceFileInput[]): Promise<void> {
  const entries = await readdir(path, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;

    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      await collect(child, files);
      continue;
    }

    if (!entry.isFile() || !isArchitectureFile(child)) continue;
    files.push({
      path: relative(process.cwd(), child).replace(/\\/g, "/"),
      content: await readFile(child, "utf-8"),
    });
  }
}

function isArchitectureFile(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  return normalized.endsWith(".ts")
    || normalized.endsWith("/openmetadata.seed.json")
    || normalized.endsWith(".openapi.json")
    || (normalized.includes("/openapi/domains/") && normalized.endsWith("/spec.json"));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
