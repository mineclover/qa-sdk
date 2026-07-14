import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const formatExtensions = new Set([
  '.cjs',
  '.css',
  '.cts',
  '.js',
  '.json',
  '.jsonc',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);
const generatedPath =
  /(^|\/)(?:\.omx|\.ralph-tui|coverage|dist|node_modules|test-results)(\/|$)|(?:^|\/)(?:[^/]+\.golden\/|packages\/docs-explorer\/public\/data\.json|packages\/platform-demo\/public\/def-catalog-data\.json$)/;

const args = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === '--'));
const all = args.includes('--all');
const write = args.includes('--write');
const baseIndex = args.findIndex((arg) => arg === '--base' || arg.startsWith('--base='));
const base =
  baseIndex === -1
    ? undefined
    : args[baseIndex].startsWith('--base=')
      ? args[baseIndex].slice('--base='.length)
      : args[baseIndex + 1];
const unknownOptions = args.filter(
  (option, index) =>
    option !== '--all' &&
    option !== '--write' &&
    !option.startsWith('--base=') &&
    option !== '--base' &&
    !(baseIndex !== -1 && index === baseIndex + 1),
);
if (unknownOptions.length > 0) {
  console.error(`Unknown option: ${unknownOptions.join(', ')}`);
  process.exit(2);
}
if (baseIndex !== -1 && !base) {
  console.error('--base requires a git revision');
  process.exit(2);
}

function gitFiles(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter(Boolean);
}

const candidates = all
  ? gitFiles(['ls-files', '-z'])
  : base
    ? [
        ...gitFiles(['diff', '--name-only', '--diff-filter=ACMR', '-z', base]),
        ...gitFiles(['ls-files', '--others', '--exclude-standard', '-z']),
      ]
    : [
        ...gitFiles(['diff', '--name-only', '--diff-filter=ACMR', '-z', 'HEAD']),
        ...gitFiles(['ls-files', '--others', '--exclude-standard', '-z']),
      ];
const files = [...new Set(candidates)]
  .filter((file) => formatExtensions.has(file.slice(file.lastIndexOf('.'))))
  .filter((file) => !generatedPath.test(file))
  .filter((file) => existsSync(resolve(repoRoot, file)))
  .sort();

if (files.length === 0) {
  console.log(`${write ? 'format:write' : 'format:check'} passed (no selected source files)`);
  process.exit(0);
}

const command = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
const chunkSize = 200;
let failed = false;

console.log(
  base
    ? `${write ? 'Formatting' : 'Checking formatting'} for ${files.length} source files changed since ${base}...`
    : all
      ? `${write ? 'Formatting' : 'Checking formatting'} for ${files.length} tracked source files...`
      : `${write ? 'Formatting' : 'Checking formatting'} for ${files.length} changed source files...`,
);

for (let offset = 0; offset < files.length; offset += chunkSize) {
  const chunk = files.slice(offset, offset + chunkSize);
  const result = spawnSync(
    command,
    ['pnpm', 'exec', 'oxfmt', write ? '--write' : '--check', ...chunk],
    {
      cwd: repoRoot,
      stdio: 'inherit',
    },
  );

  if (result.error) {
    console.error(result.error.message);
    failed = true;
  } else if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  console.error(
    all && !base
      ? 'format:check:all failed; existing tracked baseline files still need formatting.'
      : `${write ? 'format:write' : 'format:check'} failed; inspect the oxfmt output before continuing.`,
  );
  process.exit(1);
}

console.log(`${write ? 'format:write' : 'format:check'} passed`);
