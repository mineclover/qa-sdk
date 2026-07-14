// @def.boundary deterministic-label-architecture
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { OperationalOntologyPack } from 'operational-ontology/pack';

import { resolveKnownOntologyPack } from '../known-ontology-packs.js';
import type { OntologyPackValidateIssue, OntologyPackValidateResolution } from './types.js';

export interface LoadedOntologyPack {
  readonly pack: OperationalOntologyPack | null;
  readonly resolution: OntologyPackValidateResolution;
  readonly issues: readonly OntologyPackValidateIssue[];
}

const SUPPORTED_PACK_FILE_EXTENSIONS = new Set(['.cjs', '.js', '.json', '.mjs']);

export async function loadOntologyPack(
  packRef: string,
  rootDir: string,
  invocationDir: string,
): Promise<LoadedOntologyPack> {
  const known = resolveKnownOntologyPack(packRef);
  if (known.ok) {
    return {
      pack: known.pack,
      resolution: {
        kind: 'known-pack',
        packRef,
        knownPackId: known.packId,
      },
      issues: [],
    };
  }

  const resolvedPath = resolve(invocationDir, packRef);
  const looksLikePath = isPathLikePackRef(packRef);
  if (!looksLikePath && !existsSync(resolvedPath)) {
    return {
      pack: null,
      resolution: { kind: 'unresolved', packRef },
      issues: [
        {
          level: 'error',
          source: 'resolver',
          path: 'packRef',
          code: known.error.code,
          message: known.error.message,
          details: {
            supportedPackIds: known.error.supportedPackIds,
          },
        },
      ],
    };
  }

  return loadPackFromFile(packRef, resolvedPath, rootDir);
}

async function loadPackFromFile(
  packRef: string,
  resolvedPath: string,
  rootDir: string,
): Promise<LoadedOntologyPack> {
  const filePath = toDisplayPath(rootDir, resolvedPath);
  const resolution: OntologyPackValidateResolution = {
    kind: 'file-path',
    packRef,
    filePath,
    supportedFilePath:
      'Supported file refs are .json pack objects or built .js/.mjs/.cjs modules exporting default or named pack.',
  };

  let fileStat;
  try {
    fileStat = await stat(resolvedPath);
  } catch {
    return {
      pack: null,
      resolution,
      issues: [
        {
          level: 'error',
          source: 'loader',
          path: filePath,
          code: 'pack-file-not-found',
          message: `Pack file "${filePath}" does not exist.`,
        },
      ],
    };
  }

  if (!fileStat.isFile()) {
    return {
      pack: null,
      resolution,
      issues: [
        {
          level: 'error',
          source: 'loader',
          path: filePath,
          code: 'pack-ref-not-file',
          message: `Pack file ref "${filePath}" must point to a file.`,
        },
      ],
    };
  }

  const extension = extname(resolvedPath);
  if (!SUPPORTED_PACK_FILE_EXTENSIONS.has(extension)) {
    return {
      pack: null,
      resolution,
      issues: [
        {
          level: 'error',
          source: 'loader',
          path: filePath,
          code: 'unsupported-pack-file',
          message: `Unsupported pack file "${filePath}". Use .json, .js, .mjs, or .cjs; build TypeScript before validating by file path.`,
        },
      ],
    };
  }

  try {
    const payload =
      extension === '.json'
        ? (JSON.parse(await readFile(resolvedPath, 'utf8')) as unknown)
        : ((await import(pathToFileURL(resolvedPath).href)) as unknown);
    const extracted = extractOperationalOntologyPack(payload);
    if (extracted.pack) {
      return { pack: extracted.pack, resolution, issues: extracted.issues };
    }
    if (extracted.issues.length > 0) {
      return { pack: null, resolution, issues: extracted.issues };
    }
    return {
      pack: null,
      resolution,
      issues: [
        {
          level: 'error',
          source: 'loader',
          path: filePath,
          code: 'pack-export-missing',
          message:
            'Pack file must contain a pack object, a { pack } object, or a module default/named pack export.',
        },
      ],
    };
  } catch (error) {
    return {
      pack: null,
      resolution,
      issues: [
        {
          level: 'error',
          source: 'loader',
          path: filePath,
          code: 'pack-file-load-failed',
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}

export function extractOperationalOntologyPack(payload: unknown): {
  readonly pack: OperationalOntologyPack | null;
  readonly issues: readonly OntologyPackValidateIssue[];
} {
  if (isPackCandidate(payload)) {
    return { pack: payload as OperationalOntologyPack, issues: [] };
  }
  if (!isRecord(payload)) return { pack: null, issues: [] };

  const preferred = [payload['default'], payload['pack'], payload['ontologyPack']];
  for (const candidate of preferred) {
    if (isPackCandidate(candidate)) {
      return { pack: candidate as OperationalOntologyPack, issues: [] };
    }
  }

  const candidates = packCandidatesFromRecord(payload);
  if (candidates.length === 1) {
    return { pack: candidates[0] as OperationalOntologyPack, issues: [] };
  }
  if (candidates.length > 1) {
    return {
      pack: null,
      issues: [
        {
          level: 'error',
          source: 'loader',
          path: 'module.exports',
          code: 'pack-export-ambiguous',
          message:
            'Pack module exports multiple pack-like objects; export the target as default or named pack.',
        },
      ],
    };
  }
  return { pack: null, issues: [] };
}

function packCandidatesFromRecord(
  payload: Record<string, unknown>,
): readonly OperationalOntologyPack[] {
  const candidates = recordValues(payload).filter(isPackCandidate);
  const defaultExport = payload['default'];
  if (isRecord(defaultExport) && !isPackCandidate(defaultExport)) {
    const nestedPreferred = [
      defaultExport['default'],
      defaultExport['pack'],
      defaultExport['ontologyPack'],
    ];
    for (const candidate of nestedPreferred) {
      if (isPackCandidate(candidate)) return [candidate as OperationalOntologyPack];
    }
    candidates.push(...recordValues(defaultExport).filter(isPackCandidate));
  }
  return uniquePackCandidates(candidates);
}

function recordValues(record: Record<string, unknown>): unknown[] {
  return Reflect.ownKeys(record).map((key) => record[key as keyof typeof record]);
}

function uniquePackCandidates(
  candidates: readonly OperationalOntologyPack[],
): readonly OperationalOntologyPack[] {
  const seen = new Set<OperationalOntologyPack>();
  const unique: OperationalOntologyPack[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    unique.push(candidate);
  }
  return unique;
}

function isPathLikePackRef(packRef: string): boolean {
  return (
    packRef.includes('/') ||
    packRef.includes('\\') ||
    packRef.startsWith('.') ||
    SUPPORTED_PACK_FILE_EXTENSIONS.has(extname(packRef))
  );
}

function isPackCandidate(value: unknown): value is OperationalOntologyPack {
  return (
    isRecord(value) &&
    typeof value['packId'] === 'string' &&
    isRecord(value['schema']) &&
    Array.isArray(value['schema']['axes']) &&
    Array.isArray(value['schema']['taxonomies']) &&
    Array.isArray(value['schema']['relationCategories'])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toDisplayPath(rootDir: string, path: string): string {
  if (!isAbsolute(path)) return path.replaceAll('\\', '/').replace(/^\.\//, '');
  const relativePath = relative(rootDir, path).replaceAll('\\', '/');
  if (relativePath && !relativePath.startsWith('../') && relativePath !== '..') {
    return relativePath;
  }
  return path.replaceAll('\\', '/');
}
