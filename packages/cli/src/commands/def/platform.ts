// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { accessSync, constants, existsSync } from 'node:fs';
import { delimiter, isAbsolute, join } from 'node:path';
import { execa } from 'execa';

export type PlatformCompatibilityCommand = 'verify' | 'scan-audit' | 'code-link-gaps';

/**
 * Build the invocation for the externally-owned spec-management platform.
 *
 * The platform owns parsing, storage and taxonomy. qa-sdk only owns this
 * process bridge and deliberately does not import platform implementation
 * packages.
 */
export function createPlatformVerifyInvocation(
  root: string,
  flags: Record<string, string>,
): { readonly command: string; readonly args: readonly string[] } {
  return createPlatformInvocation('verify', root, flags);
}

export function createPlatformQueryInvocation(
  command: Exclude<PlatformCompatibilityCommand, 'verify'>,
  root: string,
  flags: Record<string, string>,
): { readonly command: string; readonly args: readonly string[] } {
  return createPlatformInvocation(command, root, flags);
}

/**
 * Return whether an executable can be invoked from a configured path.
 *
 * `pathValue` is injectable so command routing remains deterministic in tests
 * and does not need to mutate the process environment.
 */
export function isPlatformExecutableAvailable(
  executable: string,
  pathValue = process.env.PATH,
): boolean {
  const isReadable = (candidate: string) => {
    try {
      accessSync(candidate, constants.R_OK);
      return existsSync(candidate);
    } catch {
      return false;
    }
  };
  const isExecutable = (candidate: string) => {
    try {
      accessSync(candidate, constants.X_OK);
      return existsSync(candidate);
    } catch {
      return false;
    }
  };

  // JavaScript entrypoints are launched through the current Node process and
  // therefore only need to be readable. Explicit path-like values are also
  // supported for local development and package-manager shims.
  if (isAbsolute(executable) || executable.includes('/') || executable.includes('\\')) {
    return executable.endsWith('.js') ? isReadable(executable) : isExecutable(executable);
  }

  const pathEntries = pathValue?.split(delimiter).filter(Boolean) ?? [];
  const candidates =
    process.platform === 'win32'
      ? [executable, `${executable}.cmd`, `${executable}.exe`]
      : [executable];
  return pathEntries.some((directory) =>
    candidates.some((candidate) => isExecutable(join(directory, candidate))),
  );
}

export function resolvePlatformMode(
  flags: Record<string, string>,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  return flags.platform ?? environment.QA_SPEC_PLATFORM_MODE;
}

export function hasExternalPlatform(
  flags: Record<string, string>,
  pathValue = process.env.PATH,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  // Explicit configuration must remain fail-loud: a typo in --platform-bin or
  // QA_SPEC_PLATFORM_BIN should produce the existing execution error rather
  // than silently switching to a different collector.
  const mode = resolvePlatformMode(flags, environment);
  if (flags['platform-bin'] || environment.QA_SPEC_PLATFORM_BIN || mode === 'true') {
    return true;
  }
  return mode === 'auto' && isPlatformExecutableAvailable('qa-spec-platform', pathValue);
}

function createPlatformInvocation(
  command: PlatformCompatibilityCommand,
  root: string,
  flags: Record<string, string>,
): { readonly command: string; readonly args: readonly string[] } {
  const executable =
    flags['platform-bin'] ?? process.env.QA_SPEC_PLATFORM_BIN ?? 'qa-spec-platform';
  const args = [command, root];
  if (flags.store && command === 'verify') args.push('--store', flags.store);
  if (flags.docs && command !== 'verify') args.push('--docs', flags.docs);
  if (flags['code-dir'] && command === 'code-link-gaps') args.push('--code-dir', flags['code-dir']);
  if (flags.scope && command === 'code-link-gaps') args.push('--scope', flags.scope);
  if (flags.limit && command === 'code-link-gaps') args.push('--limit', flags.limit);
  if (flags['include-tests'] === 'true') args.push('--include-tests');
  if (flags['include-non-src'] === 'true' && command === 'code-link-gaps')
    args.push('--include-non-src');
  if (flags.strict === 'true' && command === 'code-link-gaps') args.push('--strict');
  if (flags.json === 'true') args.push('--json');
  if (executable.endsWith('.js')) return { command: process.execPath, args: [executable, ...args] };
  return { command: executable, args };
}

export async function cmdPlatformVerify(
  root: string,
  flags: Record<string, string>,
): Promise<void> {
  await runPlatformCommand('verify', root, flags);
}

export async function cmdPlatformQuery(
  command: Exclude<PlatformCompatibilityCommand, 'verify'>,
  root: string,
  flags: Record<string, string>,
): Promise<void> {
  await runPlatformCommand(command, root, flags);
}

async function runPlatformCommand(
  command: PlatformCompatibilityCommand,
  root: string,
  flags: Record<string, string>,
): Promise<void> {
  const invocation = createPlatformInvocation(command, root, flags);
  try {
    const result = await execa(invocation.command, invocation.args, {
      cwd: root,
      reject: false,
      stdio: 'inherit',
    });
    if (result.failed || result.exitCode === undefined) {
      console.error(
        `spec-management platform 실행 실패 (${command}): ${result.shortMessage ?? 'external command failed'}\n` +
          'Install @spec-platform/qa-sdk-adapter or pass --platform-bin=<qa-spec-platform path>.',
      );
      process.exitCode = result.exitCode ?? 1;
      return;
    }
    if (result.exitCode !== 0) process.exitCode = result.exitCode;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(
      `spec-management platform 실행 실패 (${command}): ${detail}\n` +
        'Install @spec-platform/qa-sdk-adapter or pass --platform-bin=<qa-spec-platform path>.',
    );
    process.exitCode = 1;
  }
}
