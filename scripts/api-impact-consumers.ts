import * as ts from 'typescript';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import type { ImplementationSite } from './endpoint-mapper.js';

export type ConsumerMatchKind = 'operation-id' | 'http-call' | 'text-path';

export interface ConsumerMatch {
  filePath: string;
  kind: ConsumerMatchKind;
  lineNumber?: number;
  detail: string;
}

interface HttpCall {
  method: string;
  path: string;
  lineNumber: number;
}

export function findConsumerMatches(
  site: ImplementationSite,
  consumerRoots: readonly string[],
  root: string,
): ConsumerMatch[] {
  const matches: ConsumerMatch[] = [];
  for (const filePath of findConsumerFiles(consumerRoots)) {
    const sourceText = readFileSync(filePath, 'utf-8');
    const sourceFile = createSourceFile(filePath, sourceText);
    const displayPath = relative(root, filePath);
    const fileMatches: ConsumerMatch[] = [];

    if (site.operationId && containsOperationIdentifier(sourceFile, site.operationId)) {
      fileMatches.push({
        filePath: displayPath,
        kind: 'operation-id',
        detail: `contains OpenAPI operationId ${site.operationId}`,
      });
    }

    for (const call of extractHttpCalls(sourceFile)) {
      if (!httpCallMatchesSite(call, site)) continue;
      fileMatches.push({
        filePath: displayPath,
        kind: 'http-call',
        lineNumber: call.lineNumber,
        detail: `matches ${call.method} ${site.path} via Request/fetch-like call`,
      });
    }

    if (fileMatches.length === 0 && pathTextMatches(sourceText, site.path)) {
      fileMatches.push({
        filePath: displayPath,
        kind: 'text-path',
        detail: 'contains endpoint path text; operation invocation is not confirmed',
      });
    }
    matches.push(...fileMatches);
  }
  return matches;
}

function createSourceFile(filePath: string, sourceText: string): ts.SourceFile {
  return ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function extractHttpCalls(sourceFile: ts.SourceFile): HttpCall[] {
  const calls: HttpCall[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Request'
    ) {
      const path = requestPath(node.arguments?.[0]);
      if (path) {
        calls.push({
          method: requestMethod(node.arguments?.[1]) ?? 'GET',
          path,
          lineNumber: lineNumber(sourceFile, node),
        });
      }
    }
    if (ts.isCallExpression(node) && isFetchLikeExpression(node.expression)) {
      const path = requestPath(node.arguments[0]);
      if (path) {
        calls.push({
          method: requestMethod(node.arguments[1]) ?? 'GET',
          path,
          lineNumber: lineNumber(sourceFile, node),
        });
      }
    }
    node.forEachChild(visit);
  }

  visit(sourceFile);
  return calls;
}

function isFetchLikeExpression(expression: ts.Expression): boolean {
  if (!ts.isIdentifier(expression)) return false;
  return /^(?:fetch|fetchImpl)$/i.test(expression.text);
}

function requestPath(argument: ts.Expression | undefined): string | undefined {
  if (!argument) return undefined;
  if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
    return pathFromText(argument.text);
  }
  if (!ts.isTemplateExpression(argument)) return undefined;
  let value = argument.head.text;
  for (const span of argument.templateSpans) value += ':param' + span.literal.text;
  return pathFromText(value);
}

function requestMethod(argument: ts.Expression | undefined): string | undefined {
  if (!argument || !ts.isObjectLiteralExpression(argument)) return undefined;
  for (const property of argument.properties) {
    if (!ts.isPropertyAssignment(property) || !property.name) continue;
    const name = property.name.getText().replace(/["']/g, '');
    if (name !== 'method' || !ts.isStringLiteral(property.initializer)) continue;
    return property.initializer.text.toUpperCase();
  }
  return undefined;
}

function pathFromText(value: string): string | undefined {
  try {
    const parsed = new URL(value, 'http://api.local');
    return parsed.pathname || '/';
  } catch {
    return value.startsWith('/') ? value.split('?')[0] : undefined;
  }
}

function httpCallMatchesSite(call: HttpCall, site: ImplementationSite): boolean {
  return call.method === site.method && pathsMatch(call.path, site.path);
}

function pathsMatch(left: string, right: string): boolean {
  const leftSegments = normalizePath(left).split('/');
  const rightSegments = normalizePath(right).split('/');
  if (leftSegments.length !== rightSegments.length) return false;
  return leftSegments.every((segment, index) => {
    const other = rightSegments[index];
    return segment === other || segment === ':param' || other === ':param';
  });
}

function pathTextMatches(sourceText: string, path: string): boolean {
  const segments = normalizePath(path)
    .split('/')
    .filter(Boolean)
    .map((segment) => (segment === ':param' ? parameterSegmentPattern : escapeRegExp(segment)));
  if (segments.length === 0) return false;
  return new RegExp(`/${segments.join('/')}`).test(sourceText);
}

const parameterSegmentPattern = '(?:\\{[^}/]+\\}|:[A-Za-z0-9_$.-]+|\\$\\{[^}/]+\\})';

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

function containsOperationIdentifier(sourceFile: ts.SourceFile, operationId: string): boolean {
  let found = false;
  function visit(node: ts.Node): void {
    if (found) return;
    if (
      (ts.isIdentifier(node) && node.text === operationId) ||
      (ts.isPropertyAccessExpression(node) && node.getText(sourceFile) === operationId)
    ) {
      found = true;
      return;
    }
    node.forEachChild(visit);
  }
  visit(sourceFile);
  return found;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findConsumerFiles(roots: readonly string[]): string[] {
  const files: string[] = [];
  for (const root of roots) collectTypeScriptFiles(root, files);
  return Array.from(new Set(files));
}

function collectTypeScriptFiles(dir: string, files: string[]): void {
  try {
    for (const entry of readdirSync(dir)) {
      const filePath = join(dir, entry);
      const stat = lstatSync(filePath);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        if (new Set(['node_modules', 'dist', 'coverage', '.vite']).has(basename(filePath)))
          continue;
        collectTypeScriptFiles(filePath, files);
      } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        files.push(filePath);
      }
    }
  } catch {
    /* missing consumer roots are an empty evidence set */
  }
}

function lineNumber(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}
