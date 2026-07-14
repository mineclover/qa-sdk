#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listTemplateCatalogs } from './catalog.js';
import { promoteOpenApiFragment } from './openapi-promote.js';
import { validateScenarios } from './scenario-validator.js';
import { validateArchitecture, type SourceFileInput } from './validator.js';

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'catalog') {
    printCatalog();
    return;
  }

  if (command === 'validate') {
    const root = arg ?? 'src';
    const files = await readArchitectureFiles(root);
    await collectAdjacentRegistryMarkers(root, files);
    const result = validateArchitecture(files);

    if (result.issues.length === 0) {
      console.log(`architecture validation passed (${files.length} files)`);
      return;
    }

    for (const issue of result.issues) {
      const imported = issue.importPath ? ` import="${issue.importPath}"` : '';
      console.error(`${issue.severity.toUpperCase()} ${issue.ruleId} ${issue.path}${imported}`);
      console.error(`  ${issue.message}`);
    }
    process.exit(result.ok ? 0 : 1);
  }

  if (command === 'promote-openapi') {
    const options = parsePromoteOpenApiArgs(process.argv.slice(3));
    const result = await promoteOpenApiFragment(options);
    console.log(`promoted OpenAPI domain spec: ${result.domain}`);
    console.log(`  ${result.source} -> ${result.target}`);
    return;
  }

  if (command === 'domain') {
    await runDomainSchematic(process.argv.slice(3));
    return;
  }

  if (command === 'validate-scenarios') {
    const root = arg ?? 'docs/scenarios';
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
  qa-scaffold domain <name> --parent-module <path> [--bff] [--skip-format]
`);
}

async function runDomainSchematic(args: string[]): Promise<void> {
  const [name, ...rest] = args;
  if (!name)
    throw new Error('domain requires a slice name (e.g., qa-scaffold domain payment ...).');

  const options: Record<string, string | boolean> = { name };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--parent-module') {
      options.parentModule = rest[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (arg === '--bff') {
      options.includeBff = true;
      continue;
    }
    if (arg === '--read-model') {
      options.includeReadModel = true;
      continue;
    }
    if (arg === '--skip-format') {
      options.skipFormat = true;
      continue;
    }
    throw new Error(`Unknown domain option: ${arg}`);
  }
  if (!options.parentModule) {
    throw new Error('domain requires --parent-module <path>.');
  }

  // Resolve collection.json (one level above dist/cli.js when built; src/cli.ts when ts-node).
  const here = dirname(fileURLToPath(import.meta.url));
  const collectionPath = join(here, '..', 'collection.json');

  const { NodeWorkflow } = await import('@angular-devkit/schematics/tools/index.js');
  const workflow = new NodeWorkflow(process.cwd(), { force: false, dryRun: false });

  await new Promise<void>((resolve, reject) => {
    workflow
      .execute({
        collection: collectionPath,
        schematic: 'domain',
        options,
        allowPrivate: false,
        debug: false,
        logger: {
          fatal: console.error.bind(console),
          error: console.error.bind(console),
          warn: console.warn.bind(console),
          info: console.log.bind(console),
          debug: () => undefined,
          createChild: () => null as never,
          // pino-호환 메서드들 (NodeWorkflow 가 호출)
        } as never,
      })
      .subscribe({
        next: () => undefined,
        complete: () => resolve(),
        error: (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))),
      });
  });
}

function parsePromoteOpenApiArgs(args: string[]): {
  source: string;
  contractsRoot: string;
  domain?: string;
  force?: boolean;
} {
  const [source, ...rest] = args;
  if (!source) {
    throw new Error('promote-openapi requires a source file path.');
  }

  const options: {
    source: string;
    contractsRoot?: string;
    domain?: string;
    force?: boolean;
  } = { source };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg === '--contracts-root') {
      options.contractsRoot = rest[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--domain') {
      options.domain = rest[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown promote-openapi option: ${arg}`);
  }

  if (!options.contractsRoot) {
    throw new Error('promote-openapi requires --contracts-root <path>.');
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
    console.log('artifacts:');
    for (const artifact of catalog.artifacts) {
      console.log(`  - ${artifact.id} [${artifact.layer}/${artifact.topology}] ${artifact.path}`);
    }
    console.log('rules:');
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

/**
 * 슬라이스 디렉터리만 입력으로 받았을 때, 부모 디렉터리에 존재하는
 * `<domain>-slices.registry.ts` 마커를 file list 에 합류시킨다.
 * validator 의 `isDomainSliceProperlyGrouped` 가 마커 존재 여부를 본다.
 */
async function collectAdjacentRegistryMarkers(
  root: string,
  files: SourceFileInput[],
): Promise<void> {
  const normalized = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const segments = normalized.split('/');
  if (segments.length < 1) return;

  // 부모 두 단계까지 marker 검사 (density 같은 top-level 슬라이스도 커버)
  for (let depth = 1; depth <= 2; depth += 1) {
    const parentSegments = segments.slice(0, segments.length - depth);
    if (parentSegments.length === 0) break;
    const parent = parentSegments.join('/');
    let entries;
    try {
      entries = await readdir(parent, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('-slices.registry.ts')) continue;
      const absPath = join(parent, entry.name);
      const rel = relative(process.cwd(), absPath).replace(/\\/g, '/');
      if (files.some((f) => f.path === rel)) continue;
      files.push({
        path: rel,
        content: await readFile(absPath, 'utf-8'),
      });
    }
  }
}

async function collect(path: string, files: SourceFileInput[]): Promise<void> {
  const entries = await readdir(path, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;

    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      await collect(child, files);
      continue;
    }

    if (!entry.isFile() || !isArchitectureFile(child)) continue;
    files.push({
      path: relative(process.cwd(), child).replace(/\\/g, '/'),
      content: await readFile(child, 'utf-8'),
    });
  }
}

function isArchitectureFile(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  return (
    normalized.endsWith('.ts') ||
    normalized.endsWith('/openmetadata.seed.json') ||
    normalized.endsWith('.openapi.json') ||
    (normalized.includes('/openapi/domains/') && normalized.endsWith('/spec.json'))
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
