// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * TypeScript 소스에서 export된 심볼을 수집한다.
 *
 * AST 없이 regex 패턴 매칭.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { ImplementedSymbol, SymbolKind } from './types.js';

const EXPORT_FUNCTION_RE = /^export\s+(?:async\s+)?function\s+(\w+)/gm;
const EXPORT_CLASS_RE = /^export\s+(?:abstract\s+)?class\s+(\w+)/gm;
const EXPORT_INTERFACE_RE = /^export\s+(?:interface|type)\s+(\w+)/gm;
const ROUTE_HONO_RE = /\.(?:get|post|put|patch|delete)\s*\(\s*["'`](\/[^"'`]*?)["'`]/gm;
const ROUTE_EXPRESS_RE = /router\.(?:get|post|put|patch|delete)\s*\(\s*["'`](\/[^"'`]*?)["'`]/gm;
const ROUTE_CONTROLLER_RE = /@(?:Get|Post|Put|Patch|Delete)\s*\(\s*["'`](\/[^"'`]*?)["'`]\s*\)/gm;

function extractMethod(line: string): string {
  const m =
    line.match(/\.(get|post|put|patch|delete)\s*\(/i) ??
    line.match(/@(Get|Post|Put|Patch|Delete)\s*\(/i);
  return m?.[1]?.toUpperCase() ?? 'GET';
}

function scanSource(source: string, filePath: string): ImplementedSymbol[] {
  const symbols: ImplementedSymbol[] = [];
  const seen = new Set<string>();

  function add(name: string, kind: SymbolKind, line?: number) {
    if (seen.has(`${kind}:${name}`)) return;
    seen.add(`${kind}:${name}`);
    symbols.push({ name, kind, filePath, line, exported: true });
  }

  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // export function
    for (const m of line.matchAll(EXPORT_FUNCTION_RE)) {
      if (m[1]) add(m[1], 'function', i + 1);
    }
    // export class
    for (const m of line.matchAll(EXPORT_CLASS_RE)) {
      if (m[1]) add(m[1], 'class', i + 1);
    }
    // export interface/type
    for (const m of line.matchAll(EXPORT_INTERFACE_RE)) {
      if (m[1]) add(m[1], 'type', i + 1);
    }
    // Hono routes
    for (const m of line.matchAll(ROUTE_HONO_RE)) {
      if (m[1]) add(`${extractMethod(line)} ${m[1]}`, 'endpoint', i + 1);
    }
    // Express routes
    for (const m of line.matchAll(ROUTE_EXPRESS_RE)) {
      if (m[1]) add(`${extractMethod(line)} ${m[1]}`, 'endpoint', i + 1);
    }
    // NestJS controller
    for (const m of line.matchAll(ROUTE_CONTROLLER_RE)) {
      if (m[1]) add(`${extractMethod(line)} ${m[1]}`, 'endpoint', i + 1);
    }
  }

  return symbols;
}

async function walkTs(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...(await walkTs(full)));
      } else if (
        entry.isFile() &&
        /\.tsx?$/.test(entry.name) &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.spec.ts')
      ) {
        files.push(full);
      }
    }
  } catch {
    // 디렉토리 접근 실패 시 무시
  }
  return files;
}

/** 패키지 디렉토리의 src 하위 .ts 파일에서 export 심볼을 수집한다. */
export async function scanImplementations(packageDir: string): Promise<ImplementedSymbol[]> {
  const srcDir = join(packageDir, 'src');
  const files = await walkTs(srcDir);
  const symbols: ImplementedSymbol[] = [];

  for (const file of files) {
    const source = await readFile(file, 'utf-8');
    const relPath = relative(packageDir, file);
    symbols.push(...scanSource(source, relPath));
  }

  return symbols;
}
