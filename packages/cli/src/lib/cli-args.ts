// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import type { DataSourceOptions } from 'definition-data-source';

export type CliFlags = Record<string, string>;

export interface ParsedCliArgs {
  readonly positional: string[];
  readonly flags: CliFlags;
  readonly sourceMode?: DataSourceOptions['mode'];
}

/**
 * Parse the CLI's shared `--key value` / `--key=value` grammar.
 * Command-specific validation remains in the command module.
 */
export function parseCliArgs(args: readonly string[]): ParsedCliArgs {
  const positional: string[] = [];
  const flags: CliFlags = {};
  let sourceMode: DataSourceOptions['mode'];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const [key, inline] = arg.slice(2).split('=', 2);
    const next = args[index + 1];
    if (inline !== undefined) {
      flags[key] = inline;
    } else if (next && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = 'true';
    }

    if (key === 'local' || key === 'server' || key === 'scan') {
      sourceMode = key;
    }
  }

  return {
    positional,
    flags,
    ...(sourceMode ? { sourceMode } : {}),
  };
}

export function isFlagEnabled(value?: string): boolean {
  return value === 'true' || value === '';
}

export function hasCliFlag(flags: Readonly<CliFlags>, name: string): boolean {
  return isFlagEnabled(flags[name]);
}

export function toDataSourceOptions(
  flags: Readonly<CliFlags>,
  sourceMode?: DataSourceOptions['mode'],
): DataSourceOptions {
  const mode = sourceMode ?? (isFlagEnabled(flags.local) ? 'local' : undefined);
  return {
    ...(mode ? { mode } : {}),
    ...(flags.db || flags['db-path']
      ? { dbPath: flags.db ?? flags['db-path'] }
      : {}),
    ...(flags['server-url'] ? { serverUrl: flags['server-url'] } : {}),
    ...(flags.root ? { rootDir: flags.root } : {}),
    ...(flags.docs ? { docsDir: flags.docs } : {}),
  };
}
