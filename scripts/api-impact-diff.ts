import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import {
  extractSymbolsForLineRanges,
  parseTypeScriptFile,
  type LineRange,
} from './api-impact-ast.js';

export function collectChangedSymbols(
  root: string,
  changedFiles: readonly string[],
): ReadonlyMap<string, readonly string[]> {
  const symbolsByFile = new Map<string, readonly string[]>();
  for (const file of changedFiles) {
    const absolutePath = resolve(root, file);
    if (!existsSync(absolutePath)) {
      symbolsByFile.set(absolutePath, []);
      continue;
    }
    const diff = readDiff(root, file);
    const ranges = parseAddedLineRanges(diff);
    const parsedFile = parseTypeScriptFile(absolutePath);
    symbolsByFile.set(
      absolutePath,
      ranges.length === 0
        ? extractSymbolsForLineRanges(parsedFile, [{ start: 1, end: Number.MAX_SAFE_INTEGER }])
        : extractSymbolsForLineRanges(parsedFile, ranges),
    );
  }
  return symbolsByFile;
}

export function collectChangedFiles(root: string): string[] {
  return filterApiImpactFiles(
    mergeChangedFiles(
      readGitNames(root, ['diff', '--name-only', 'HEAD', '--']),
      readGitNames(root, ['ls-files', '--others', '--exclude-standard', '--']),
    ),
  );
}

export function mergeChangedFiles(
  trackedFiles: readonly string[],
  untrackedFiles: readonly string[],
): string[] {
  return Array.from(new Set([...trackedFiles, ...untrackedFiles])).filter(
    (file) => file.trim().length > 0,
  );
}

export function filterApiImpactFiles(files: readonly string[]): string[] {
  return files.filter((file) => API_IMPACT_EXTENSIONS.has(extname(file).toLowerCase()));
}

export function parseAddedLineRanges(diff: string): LineRange[] {
  const ranges: LineRange[] = [];
  for (const line of diff.split('\n')) {
    const match = line.match(/^@@ .* \+(\d+)(?:,(\d+))? @@/);
    if (!match) continue;
    const start = Number(match[1]);
    const count = Number(match[2] ?? 1);
    if (count === 0) continue;
    ranges.push({ start, end: start + count - 1 });
  }
  return ranges;
}

function readDiff(root: string, file: string): string {
  try {
    return execFileSync('git', ['diff', '--unified=0', 'HEAD', '--', file], {
      cwd: root,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

function readGitNames(root: string, args: readonly string[]): string[] {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\n')
      .map((file) => file.trim())
      .filter((file) => file.length > 0);
  } catch {
    return [];
  }
}

const API_IMPACT_EXTENSIONS = new Set(['.ts', '.tsx', '.yaml', '.yml']);
