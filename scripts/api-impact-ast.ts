import * as ts from 'typescript';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

export interface AstImportBinding {
  localName: string;
  importedName: string;
  moduleSpecifier: string;
  resolvedFilePath?: string;
  lineNumber: number;
}

export interface AstDependencyEdge {
  kind: 'di';
  fromFilePath: string;
  fromClassName: string;
  localName: string;
  dependencyName: string;
  propertyName?: string;
  targetFilePath?: string;
  targetClassName?: string;
  lineNumber: number;
}

export interface AstMethodCallEdge {
  kind: 'call';
  fromFilePath: string;
  fromClassName: string;
  fromMethodName: string;
  dependencyName: string;
  targetMethodName: string;
  targetFilePath?: string;
  targetClassName?: string;
  lineNumber: number;
}

export interface AstMethodInfo {
  name: string;
  startLine: number;
  endLine: number;
}

export interface AstClassInfo {
  name: string;
  startLine: number;
  endLine: number;
  methods: AstMethodInfo[];
}

export interface AstControllerRoute {
  filePath: string;
  className: string;
  methodName: string;
  method: string;
  path: string;
  lineNumber: number;
}

export interface AstFileInfo {
  filePath: string;
  imports: AstImportBinding[];
  classes: AstClassInfo[];
  dependencyEdges: AstDependencyEdge[];
  methodCalls: AstMethodCallEdge[];
  routes: AstControllerRoute[];
}

export interface AstDependencyGraph {
  files: ReadonlyMap<string, AstFileInfo>;
  dependencyEdges: readonly AstDependencyEdge[];
  methodCalls: readonly AstMethodCallEdge[];
}

export type AstFileCache = Map<string, AstFileInfo>;

export interface MethodReachability {
  dependencyEdges: AstDependencyEdge[];
  methodCalls: AstMethodCallEdge[];
}

export interface LineRange {
  start: number;
  end: number;
}

const HTTP_DECORATORS = new Set(['Get', 'Post', 'Put', 'Delete', 'Patch']);

export function parseTypeScriptFile(
  filePath: string,
  sourceText = readFileSync(filePath, 'utf-8'),
): AstFileInfo {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(filePath),
  );
  const imports = collectImports(sourceFile, filePath);
  const importsByLocalName = new Map(imports.map((binding) => [binding.localName, binding]));
  const classes: AstClassInfo[] = [];
  const dependencyEdges: AstDependencyEdge[] = [];
  const methodCalls: AstMethodCallEdge[] = [];
  const routes: AstControllerRoute[] = [];

  sourceFile.forEachChild((node) => {
    if (!ts.isClassDeclaration(node) || !node.name) return;
    const className = node.name.text;
    const methods = node.members
      .filter((member): member is ts.MethodDeclaration => ts.isMethodDeclaration(member))
      .map((method) => ({
        name: methodName(method.name),
        startLine: lineNumber(sourceFile, method.getStart(sourceFile)),
        endLine: lineNumber(sourceFile, method.getEnd()),
      }))
      .filter((method) => method.name.length > 0);

    classes.push({
      name: className,
      startLine: lineNumber(sourceFile, node.getStart(sourceFile)),
      endLine: lineNumber(sourceFile, node.getEnd()),
      methods,
    });

    const controllerDecorator = findDecorator(node, 'Controller');
    if (controllerDecorator) {
      const controllerPath = stringArgument(controllerDecorator) ?? '';

      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        const routeDecorator = (ts.getDecorators(member) ?? [])
          .map((decorator) => decorator.expression)
          .find(
            (expression): expression is ts.CallExpression =>
              ts.isCallExpression(expression) &&
              ts.isIdentifier(expression.expression) &&
              HTTP_DECORATORS.has(expression.expression.text),
          );
        if (!routeDecorator) continue;
        const methodNameValue = methodName(member.name);
        if (!methodNameValue) continue;
        const routeMethod = (routeDecorator.expression as ts.Identifier).text.toUpperCase();
        const routePath = stringArgument(routeDecorator) ?? '';
        routes.push({
          filePath,
          className,
          methodName: methodNameValue,
          method: routeMethod,
          path: joinControllerPath(controllerPath, routePath),
          lineNumber: lineNumber(sourceFile, routeDecorator.getStart(sourceFile)),
        });
      }
    }

    const dependencyProperties = new Map<string, AstDependencyEdge>();
    const constructor = node.members.find((member): member is ts.ConstructorDeclaration =>
      ts.isConstructorDeclaration(member),
    );
    for (const parameter of constructor?.parameters ?? []) {
      const propertyName = parameterName(parameter.name);
      const dependencyName = injectedDependencyName(parameter) ?? typeName(parameter.type);
      if (!propertyName || !dependencyName) continue;

      const binding = importsByLocalName.get(dependencyName);
      const edge: AstDependencyEdge = {
        kind: 'di',
        fromFilePath: filePath,
        fromClassName: className,
        localName: dependencyName,
        dependencyName: binding?.importedName ?? dependencyName,
        ...(propertyName ? { propertyName } : {}),
        ...(binding?.resolvedFilePath ? { targetFilePath: binding.resolvedFilePath } : {}),
        ...(binding?.importedName ? { targetClassName: binding.importedName } : {}),
        lineNumber: lineNumber(sourceFile, parameter.getStart(sourceFile)),
      };
      dependencyEdges.push(edge);
      dependencyProperties.set(propertyName, edge);
    }

    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member) || !member.body) continue;
      const fromMethodName = methodName(member.name);
      if (!fromMethodName) continue;
      member.body.forEachChild((child) => {
        visitMethodCalls(child, (call) => {
          if (!ts.isPropertyAccessExpression(call.expression)) return;
          const receiver = call.expression.expression;
          if (!ts.isPropertyAccessExpression(receiver)) return;
          if (receiver.expression.kind !== ts.SyntaxKind.ThisKeyword) return;
          const dependencyProperty = receiver.name.text;
          const dependency = dependencyProperties.get(dependencyProperty);
          if (!dependency) return;
          methodCalls.push({
            kind: 'call',
            fromFilePath: filePath,
            fromClassName: className,
            fromMethodName,
            dependencyName: dependency.dependencyName,
            targetMethodName: call.expression.name.text,
            ...(dependency.targetFilePath ? { targetFilePath: dependency.targetFilePath } : {}),
            ...(dependency.targetClassName ? { targetClassName: dependency.targetClassName } : {}),
            lineNumber: lineNumber(sourceFile, call.getStart(sourceFile)),
          });
        });
      });
    }
  });

  return { filePath, imports, classes, dependencyEdges, methodCalls, routes };
}

export function parseTypeScriptFileCached(filePath: string, cache?: AstFileCache): AstFileInfo {
  const cached = cache?.get(filePath);
  if (cached) return cached;
  const parsed = parseTypeScriptFile(filePath);
  cache?.set(filePath, parsed);
  return parsed;
}

export function methodBodyContainsToken(
  filePath: string,
  className: string,
  methodNameValue: string,
  token: string,
): boolean {
  const sourceText = readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(filePath),
  );
  for (const node of sourceFile.statements) {
    if (!ts.isClassDeclaration(node) || node.name?.text !== className) continue;
    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member) || methodName(member.name) !== methodNameValue) continue;
      return member.body?.getText(sourceFile).includes(token) ?? false;
    }
  }
  return false;
}

export function buildDependencyGraph(
  filePaths: readonly string[],
  cache?: AstFileCache,
  onProgress?: (processed: number, total: number) => void,
): AstDependencyGraph {
  const files = new Map<string, AstFileInfo>();
  const existingPaths = Array.from(new Set(filePaths)).filter((path) => existsSync(path));
  for (const [index, filePath] of existingPaths.entries()) {
    const info = parseTypeScriptFileCached(filePath, cache);
    files.set(filePath, info);
    const processed = index + 1;
    if (onProgress && (processed % 50 === 0 || processed === existingPaths.length)) {
      onProgress(processed, existingPaths.length);
    }
  }

  return {
    files,
    dependencyEdges: Array.from(files.values()).flatMap((info) => info.dependencyEdges),
    methodCalls: Array.from(files.values()).flatMap((info) => info.methodCalls),
  };
}

export function extractSymbolsForLineRanges(
  file: AstFileInfo,
  ranges: readonly LineRange[],
): string[] {
  const symbols = new Set<string>();
  for (const classInfo of file.classes) {
    if (ranges.some((range) => overlaps(range, classInfo.startLine, classInfo.endLine))) {
      symbols.add(classInfo.name);
    }
    for (const method of classInfo.methods) {
      if (ranges.some((range) => overlaps(range, method.startLine, method.endLine))) {
        symbols.add(`${classInfo.name}.${method.name}`);
      }
    }
  }
  return Array.from(symbols);
}

export function findMethodReachability(
  graph: AstDependencyGraph,
  start: { filePath: string; className: string; methodName: string },
  targetFilePath: string,
  targetSymbols: readonly string[] = [],
): MethodReachability | null {
  interface Node {
    filePath: string;
    className: string;
    methodName: string;
    dependencyEdges: AstDependencyEdge[];
    methodCalls: AstMethodCallEdge[];
  }

  const startKey = methodKey(start.filePath, start.className, start.methodName);
  const queue: Array<{
    node: Node;
    dependencyEdges: AstDependencyEdge[];
    methodCalls: AstMethodCallEdge[];
  }> = [
    {
      node: {
        ...start,
        dependencyEdges: [],
        methodCalls: [],
      },
      dependencyEdges: [],
      methodCalls: [],
    },
  ];
  const visited = new Set([startKey]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const call of graph.methodCalls) {
      if (
        methodKey(call.fromFilePath, call.fromClassName, call.fromMethodName) !==
        methodKey(current.node.filePath, current.node.className, current.node.methodName)
      ) {
        continue;
      }
      if (!call.targetFilePath) continue;
      const callDependency = graph.dependencyEdges.find(
        (edge) =>
          edge.fromFilePath === call.fromFilePath &&
          edge.fromClassName === call.fromClassName &&
          edge.dependencyName === call.dependencyName,
      );
      const targetMatchesFile = resolve(call.targetFilePath) === resolve(targetFilePath);
      const targetMatchesSymbol =
        targetSymbols.length === 0 ||
        targetSymbols.some(
          (symbol) =>
            symbol === call.targetClassName ||
            symbol.endsWith(`.${call.targetMethodName}`) ||
            symbol === call.targetMethodName,
        );
      const nextCalls = [...current.methodCalls, call];
      const nextDependencyEdges = callDependency
        ? [...current.dependencyEdges, callDependency]
        : current.dependencyEdges;
      if (targetMatchesFile && targetMatchesSymbol) {
        return { dependencyEdges: nextDependencyEdges, methodCalls: nextCalls };
      }

      const nextNode = {
        filePath: call.targetFilePath,
        className: call.targetClassName ?? call.dependencyName,
        methodName: call.targetMethodName,
        dependencyEdges: [],
        methodCalls: [],
      };
      const nextKey = methodKey(nextNode.filePath, nextNode.className, nextNode.methodName);
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);
      queue.push({
        node: nextNode,
        dependencyEdges: nextDependencyEdges,
        methodCalls: nextCalls,
      });
    }
  }

  return null;
}

export function findDependencyPath(
  graph: AstDependencyGraph,
  startFilePath: string,
  targetFilePath: string,
  maxDepth = 4,
): AstDependencyEdge[] | null {
  const queue: Array<{ filePath: string; edges: AstDependencyEdge[] }> = [
    { filePath: startFilePath, edges: [] },
  ];
  const visited = new Set([resolve(startFilePath)]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (resolve(current.filePath) === resolve(targetFilePath)) return current.edges;
    if (current.edges.length >= maxDepth) continue;

    for (const edge of graph.dependencyEdges) {
      if (edge.fromFilePath !== current.filePath || !edge.targetFilePath) continue;
      const nextPath = resolve(edge.targetFilePath);
      if (visited.has(nextPath)) continue;
      visited.add(nextPath);
      queue.push({ filePath: edge.targetFilePath, edges: [...current.edges, edge] });
    }
  }

  return null;
}

function collectImports(sourceFile: ts.SourceFile, filePath: string): AstImportBinding[] {
  const bindings: AstImportBinding[] = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    const moduleSpecifier = statement.moduleSpecifier.text;
    const resolvedFilePath = resolveModulePath(filePath, moduleSpecifier);
    const lineNumber = lineNumberForNode(sourceFile, statement);
    const importClause = statement.importClause;
    if (!importClause) continue;

    if (importClause.name) {
      bindings.push({
        localName: importClause.name.text,
        importedName: 'default',
        moduleSpecifier,
        ...(resolvedFilePath ? { resolvedFilePath } : {}),
        lineNumber,
      });
    }
    if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
      bindings.push({
        localName: importClause.namedBindings.name.text,
        importedName: '*',
        moduleSpecifier,
        ...(resolvedFilePath ? { resolvedFilePath } : {}),
        lineNumber,
      });
    }
    if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
      for (const element of importClause.namedBindings.elements) {
        bindings.push({
          localName: element.name.text,
          importedName: element.propertyName?.text ?? element.name.text,
          moduleSpecifier,
          ...(resolvedFilePath ? { resolvedFilePath } : {}),
          lineNumber,
        });
      }
    }
  }
  return bindings;
}

function findDecorator(node: ts.Node, name: string): ts.CallExpression | undefined {
  return decoratorsOf(node)
    .map((decorator) => decorator.expression)
    .find(
      (expression): expression is ts.CallExpression =>
        ts.isCallExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === name,
    );
}

function decoratorsOf(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

function injectedDependencyName(parameter: ts.ParameterDeclaration): string | undefined {
  const decorator = findDecorator(parameter, 'Inject');
  if (!decorator) return undefined;
  const token = decorator.arguments[0];
  return token && ts.isIdentifier(token) ? token.text : undefined;
}

function typeName(type: ts.TypeNode | undefined): string | undefined {
  if (!type || !ts.isTypeReferenceNode(type)) return undefined;
  if (ts.isIdentifier(type.typeName)) return type.typeName.text;
  if (ts.isQualifiedName(type.typeName)) return type.typeName.right.text;
  return undefined;
}

function stringArgument(node: ts.CallExpression): string | undefined {
  const argument = node.arguments[0];
  return argument && ts.isStringLiteral(argument) ? argument.text : undefined;
}

function parameterName(name: ts.BindingName): string | undefined {
  return ts.isIdentifier(name) ? name.text : undefined;
}

function methodName(name: ts.PropertyName | undefined): string {
  if (!name) return '';
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
    return name.text;
  return '';
}

function joinControllerPath(controllerPath: string, routePath: string): string {
  const parts = [controllerPath, routePath]
    .map((part) => part.trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return parts.length === 0 ? '/' : `/${parts.join('/')}`;
}

function resolveModulePath(filePath: string, moduleSpecifier: string): string | undefined {
  if (!moduleSpecifier.startsWith('.')) return undefined;
  const withoutRuntimeExtension = moduleSpecifier.replace(/\.(?:m|c)?js$/, '');
  const basePath = resolve(dirname(filePath), withoutRuntimeExtension);
  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.mts`,
    `${basePath}.cts`,
    join(basePath, 'index.ts'),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function visitMethodCalls(node: ts.Node, callback: (call: ts.CallExpression) => void): void {
  if (ts.isCallExpression(node)) callback(node);
  node.forEachChild((child) => visitMethodCalls(child, callback));
}

function lineNumber(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function lineNumberForNode(sourceFile: ts.SourceFile, node: ts.Node): number {
  return lineNumber(sourceFile, node.getStart(sourceFile));
}

function methodKey(filePath: string, className: string, methodName: string): string {
  return `${resolve(filePath)}#${className}.${methodName}`;
}

function overlaps(range: LineRange, startLine: number, endLine: number): boolean {
  return range.start <= endLine && startLine <= range.end;
}

function scriptKindFor(filePath: string): ts.ScriptKind {
  switch (extname(filePath)) {
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.jsx':
      return ts.ScriptKind.JSX;
    default:
      return ts.ScriptKind.TS;
  }
}
