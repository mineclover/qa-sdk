import { existsSync, lstatSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseTypeScriptFileCached, type AstFileCache } from './api-impact-ast.js';
import type { Endpoint } from './oa-spec-resolver.js';

export interface ImplementationSite {
  filePath: string;
  className: string;
  methodName: string;
  lineNumber: number;
  api: string;
  method: string;
  path: string;
  operationId?: string;
  serviceId?: string;
}

export function findImplementations(
  root: string,
  endpoints: Endpoint[],
  implementationRoots: readonly string[] = [join(root, 'simulations/enterprise-pm/services')],
  astCache?: AstFileCache,
): Map<string, ImplementationSite> {
  const mapping = new Map<string, ImplementationSite>();
  const files = findImplementationFiles(implementationRoots);

  for (const file of files) {
    const routes = parseTypeScriptFileCached(file, astCache).routes;
    for (const route of routes) {
      for (const ep of endpoints) {
        if (ep.method !== route.method || !pathsEquivalent(ep.path, route.path)) continue;
        const api = `${route.method} ${ep.path}`;
        const mappingKey = `${ep.sourceProfileId ?? 'default'}:${api}`;
        mapping.set(mappingKey, {
          filePath: file,
          className: route.className,
          methodName: route.methodName,
          lineNumber: route.lineNumber,
          api,
          method: route.method,
          path: ep.path,
          ...(ep.operationId ? { operationId: ep.operationId } : {}),
          ...(ep.sourceProfileId ? { serviceId: ep.sourceProfileId } : {}),
        });
      }
    }
  }

  return mapping;
}

export function findImplementationFiles(implementationRoots: readonly string[]): string[] {
  return Array.from(new Set(implementationRoots.flatMap((dir) => findTsFiles(dir))));
}

function pathsEquivalent(left: string, right: string): boolean {
  const leftSegments = normalizePath(left).split('/');
  const rightSegments = normalizePath(right).split('/');
  if (leftSegments.length !== rightSegments.length) return false;
  return leftSegments.every((segment, index) => {
    const other = rightSegments[index];
    return segment === other || (segment.startsWith(':') && other.startsWith(':'));
  });
}

function normalizePath(path: string): string {
  return (
    `/${path}`
      .replace(/\/+/g, '/')
      .replace(/\/$/, '')
      .split('/')
      .map((segment) => {
        if (segment.startsWith('{') && segment.endsWith('}')) return ':param';
        if (segment.startsWith(':')) return ':param';
        return segment;
      })
      .join('/') || '/'
  );
}

const EXCLUDED_SOURCE_DIRS = new Set(['node_modules', 'dist', '.vite', 'coverage']);

function findTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  let results: string[] = [];
  const list = readdirSync(dir);
  list.forEach((file) => {
    file = join(dir, file);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink()) {
      return;
    }
    if (stat.isDirectory()) {
      if (EXCLUDED_SOURCE_DIRS.has(basename(file))) {
        return;
      }
      results = results.concat(findTsFiles(file));
    } else if (file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.d.ts')) {
      results.push(file);
    }
  });
  return results;
}
