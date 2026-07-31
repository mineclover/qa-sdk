#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const adapterPackage = '@spec-platform/qa-sdk-adapter';

export function resolveSpecPlatformRoot(root = repositoryRoot, environment = process.env) {
  return resolve(root, environment.SPEC_PLATFORM_ROOT ?? '../spec-management-platform');
}

export function resolveAdapterCli(platformRoot) {
  return join(platformRoot, 'harnesses', 'qa-sdk', 'adapter', 'dist', 'cli.js');
}

export function normalizeWorkspaceArgs(args) {
  return args[0] === '--' ? args.slice(1) : args;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    stdio: 'inherit',
    ...options,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function assertPlatformWorkspace(platformRoot) {
  const manifestPath = join(platformRoot, 'package.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`spec-management-platform workspace not found: ${platformRoot}`);
  }
  const workspaceManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (workspaceManifest.name !== 'spec-management-platform') {
    throw new Error(
      `unexpected workspace at ${platformRoot}: ${workspaceManifest.name ?? 'unnamed'}`,
    );
  }
}

function main(args) {
  const normalizedArgs = normalizeWorkspaceArgs(args);
  const shouldBuild = normalizedArgs[0] === '--build';
  const commandArgs = shouldBuild ? normalizedArgs.slice(1) : normalizedArgs;
  const platformRoot = resolveSpecPlatformRoot();
  assertPlatformWorkspace(platformRoot);

  if (shouldBuild) {
    const buildStatus = run('corepack', [
      'pnpm',
      '--dir',
      platformRoot,
      '--filter',
      adapterPackage,
      'build',
    ]);
    if (buildStatus !== 0) return buildStatus;
    if (commandArgs.length === 0) return 0;
  }

  if (commandArgs.length === 0) {
    console.error('Usage: corepack pnpm platform:workspace [--build] -- def <command> [options]');
    return 1;
  }

  const adapterCli = resolveAdapterCli(platformRoot);
  if (!existsSync(adapterCli)) {
    console.error(
      `workspace adapter build not found: ${adapterCli}\n` +
        'Run: corepack pnpm platform:workspace:build',
    );
    return 1;
  }

  const qaCli = join(repositoryRoot, 'packages', 'cli', 'dist', 'index.js');
  if (!existsSync(qaCli)) {
    console.error(
      'qa-sdk CLI build not found: packages/cli/dist/index.js\n' +
        'Run: corepack pnpm --filter @qa-sdk/cli build',
    );
    return 1;
  }

  return run(process.execPath, [qaCli, ...commandArgs], {
    env: {
      ...process.env,
      QA_SPEC_PLATFORM_BIN: process.env.QA_SPEC_PLATFORM_BIN ?? adapterCli,
    },
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
