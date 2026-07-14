#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(root, 'src');
const domainsDir = join(srcDir, 'domains');

function readYaml(path) {
  return parse(readFileSync(path, 'utf-8')) ?? {};
}

function sortDomainNames(names) {
  return [...names].sort((a, b) => (a === 'common' ? -1 : b === 'common' ? 1 : a.localeCompare(b)));
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  if (Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]),
  );
}

function main() {
  const basePath = join(srcDir, 'openapi.yaml');
  const localProfilePath = join(srcDir, 'profiles', 'local.yaml');
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
    const specPath = join(domainsDir, domainName, 'spec.yaml');
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
      for (const [key, shape] of Object.entries(values ?? {})) {
        const componentKey = `${section}.${key}`;
        const previous = componentOwners.get(componentKey);
        if (previous) {
          // 동일 이름의 컴포넌트가 여러 도메인에 정의될 수 있다 (예: GraphSnapshotRecord
          // 가 audit-explorer 와 graph-explorer BFF 양쪽에서 같은 graph snapshot 을
          // 노출). 형태가 정확히 일치하면 deduplicate 하고 통과 — 다르면 충돌로 거부.
          if (deepEqual(previous.shape, shape)) {
            continue;
          }
          throw new Error(
            `conflicting component "${componentKey}" in ${domainName}; previous owner: ${previous.domain} (shapes differ)`,
          );
        }
        componentOwners.set(componentKey, { domain: domainName, shape });
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
