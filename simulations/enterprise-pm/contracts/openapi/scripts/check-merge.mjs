#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(root, "src");
const domainsDir = join(srcDir, "domains");

function readYaml(path) {
  return parse(readFileSync(path, "utf-8")) ?? {};
}

function sortDomainNames(names) {
  return [...names].sort((a, b) => (a === "common" ? -1 : b === "common" ? 1 : a.localeCompare(b)));
}

function main() {
  const basePath = join(srcDir, "openapi.yaml");
  const localProfilePath = join(srcDir, "profiles", "local.yaml");
  if (!existsSync(basePath)) throw new Error(`missing base spec: ${basePath}`);
  if (!existsSync(localProfilePath)) throw new Error(`missing local profile: ${localProfilePath}`);

  const pathOwners = new Map();
  const componentOwners = new Map();
  const domainNames = sortDomainNames(
    readdirSync(domainsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );

  for (const domainName of domainNames) {
    const specPath = join(domainsDir, domainName, "spec.yaml");
    if (!existsSync(specPath)) continue;
    const spec = readYaml(specPath);

    for (const path of Object.keys(spec.paths ?? {})) {
      const previous = pathOwners.get(path);
      if (previous) {
        throw new Error(`duplicate path "${path}" in ${domainName}; previous owner: ${previous}`);
      }
      pathOwners.set(path, domainName);
    }

    for (const [section, values] of Object.entries(spec.components ?? {})) {
      for (const key of Object.keys(values ?? {})) {
        const componentKey = `${section}.${key}`;
        const previous = componentOwners.get(componentKey);
        if (previous) {
          throw new Error(`duplicate component "${componentKey}" in ${domainName}; previous owner: ${previous}`);
        }
        componentOwners.set(componentKey, domainName);
      }
    }
  }

  console.log(
    `openapi merge compatibility passed (domains=${domainNames.length}, paths=${pathOwners.size}, components=${componentOwners.size})`,
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

