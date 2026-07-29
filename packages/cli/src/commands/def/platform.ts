// @def.boundary docs-control-plane
// @def.doc docs-control-plane

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

export function hasExternalPlatform(flags: Record<string, string>): boolean {
  return Boolean(flags['platform-bin'] || process.env.QA_SPEC_PLATFORM_BIN || flags.platform === 'true');
}

function createPlatformInvocation(
  command: PlatformCompatibilityCommand,
  root: string,
  flags: Record<string, string>,
): { readonly command: string; readonly args: readonly string[] } {
  const executable = flags['platform-bin'] ?? process.env.QA_SPEC_PLATFORM_BIN ?? 'qa-spec-platform';
  const args = [command, root];
  if (flags.store && command === 'verify') args.push('--store', flags.store);
  if (flags.docs && command !== 'verify') args.push('--docs', flags.docs);
  if (flags['code-dir'] && command === 'code-link-gaps') args.push('--code-dir', flags['code-dir']);
  if (flags.scope && command === 'code-link-gaps') args.push('--scope', flags.scope);
  if (flags.limit && command === 'code-link-gaps') args.push('--limit', flags.limit);
  if (flags['include-tests'] === 'true') args.push('--include-tests');
  if (flags['include-non-src'] === 'true' && command === 'code-link-gaps') args.push('--include-non-src');
  if (flags.strict === 'true' && command === 'code-link-gaps') args.push('--strict');
  if (flags.json === 'true') args.push('--json');
  if (executable.endsWith('.js')) return { command: process.execPath, args: [executable, ...args] };
  return { command: executable, args };
}

export async function cmdPlatformVerify(root: string, flags: Record<string, string>): Promise<void> {
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
