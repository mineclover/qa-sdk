// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { isAbsolute, relative, resolve } from 'node:path';

import type {
  OntologyPackScaffoldDiagnostic,
  OntologyPackScaffoldPlannedFile,
} from '../ontology-pack-scaffold-plan.js';

export function resolveSafeRepoPath(input: {
  readonly rootDir: string;
  readonly field: string;
  readonly inputPath: string;
  readonly fallbackPath: string;
  readonly diagnostics: OntologyPackScaffoldDiagnostic[];
}): string {
  const value = input.inputPath.trim().replaceAll('\\', '/');
  if (value.length === 0 || value.includes('\0')) {
    input.diagnostics.push(unsafePathDiagnostic(input.field, input.inputPath));
    return normalizeRepoPath(input.fallbackPath);
  }

  const resolved = resolve(input.rootDir, value);
  const repoRelativePath = relative(input.rootDir, resolved);
  if (
    repoRelativePath.length === 0 ||
    repoRelativePath === '..' ||
    repoRelativePath.startsWith(`..${'/'}`) ||
    repoRelativePath.startsWith(`..${'\\'}`) ||
    isAbsolute(repoRelativePath)
  ) {
    input.diagnostics.push(unsafePathDiagnostic(input.field, input.inputPath));
    return normalizeRepoPath(input.fallbackPath);
  }

  return normalizeRepoPath(repoRelativePath);
}

export function detectConflictingOutputPaths(
  files: readonly Pick<OntologyPackScaffoldPlannedFile, 'path' | 'role'>[],
): OntologyPackScaffoldDiagnostic[] {
  const byPath = new Map<string, string[]>();
  for (const file of files) {
    const roles = byPath.get(file.path) ?? [];
    roles.push(file.role);
    byPath.set(file.path, roles);
  }
  return [...byPath.entries()]
    .filter(([, roles]) => roles.length > 1)
    .map(([path, roles]) => ({
      severity: 'error' as const,
      code: 'conflicting-output-path' as const,
      message: `Output path "${path}" is planned for multiple scaffold artifacts.`,
      path,
      details: { roles },
    }));
}

function unsafePathDiagnostic(field: string, value: string): OntologyPackScaffoldDiagnostic {
  return {
    severity: 'error',
    code: 'unsafe-path',
    message: `Path option "${field}" must resolve inside the repository and must not be empty.`,
    field,
    value,
  };
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/+/g, '/').replace(/\/$/, '');
}
