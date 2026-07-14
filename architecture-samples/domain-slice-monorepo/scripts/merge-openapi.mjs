import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
const openapiRoot = join(root, 'packages/contracts/openapi');
const outputPath = join(openapiRoot, '.merged.openapi.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function mergeObjects(target, source, label) {
  if (!source) return;
  for (const [key, value] of Object.entries(source)) {
    if (target[key] !== undefined) {
      throw new Error(`duplicate ${label}: ${key}`);
    }
    target[key] = value;
  }
}

function mergeComponentGroups(target, source, label) {
  if (!source) return;
  for (const [groupName, group] of Object.entries(source)) {
    target[groupName] ??= {};
    mergeObjects(target[groupName], group, `${label} ${groupName}`);
  }
}

export function mergeSpecs(baseSpec, profileSpec, domainSpecs) {
  const merged = {
    ...baseSpec,
    ...profileSpec,
    tags: [...(baseSpec.tags ?? []), ...(profileSpec.tags ?? [])],
    paths: {},
    components: {},
  };

  mergeObjects(merged.paths, baseSpec.paths ?? {}, 'OpenAPI path');
  mergeObjects(merged.paths, profileSpec.paths ?? {}, 'OpenAPI path');
  mergeComponentGroups(merged.components, baseSpec.components ?? {}, 'OpenAPI component');
  mergeComponentGroups(merged.components, profileSpec.components ?? {}, 'OpenAPI component');

  for (const domain of domainSpecs) {
    merged.tags.push(...(domain.tags ?? []));
    mergeObjects(merged.paths, domain.paths ?? {}, 'OpenAPI path');
    mergeComponentGroups(merged.components, domain.components ?? {}, 'OpenAPI component');
  }

  return merged;
}

function readDomainSpecs() {
  const domainsDir = join(openapiRoot, 'domains');
  const domainNames = readdirSync(domainsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => {
      if (left === 'common') return -1;
      if (right === 'common') return 1;
      return left.localeCompare(right);
    });

  return domainNames.map((name) => readJson(join(domainsDir, name, 'spec.json')));
}

function main() {
  const merged = mergeSpecs(
    readJson(join(openapiRoot, 'base.openapi.json')),
    readJson(join(openapiRoot, 'profiles/local.json')),
    readDomainSpecs(),
  );

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(merged, null, 2)}\n`);

  console.log(`merged OpenAPI written: ${outputPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
