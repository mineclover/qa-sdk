import type { Tree } from "@angular-devkit/schematics";
import ts from "typescript";

import { classify, dasherize } from "./strings.js";

export interface WireModuleOptions {
  parentModule: string;
  name: string;
  generatedModulePath: string;
}

export function wireDomainModule(host: Tree, options: WireModuleOptions): void {
  const parentModulePath = normalizePath(options.parentModule);
  const buffer = host.read(parentModulePath);
  if (!buffer) {
    throw new Error(`Parent module not found: ${parentModulePath}`);
  }

  const sourceText = buffer.toString("utf-8");
  const moduleClassName = `${classify(options.name)}Module`;
  const importPath = relativeImport(parentModulePath, options.generatedModulePath);
  const importStatement = `import { ${moduleClassName} } from "${importPath}";\n`;

  if (sourceText.includes(importStatement.trim())) {
    return;
  }

  const sourceFile = ts.createSourceFile(
    parentModulePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const moduleDecorator = findNestModuleDecorator(sourceFile);
  if (!moduleDecorator) {
    throw new Error(`No @Module decorator found in ${parentModulePath}`);
  }

  const importsProperty = findObjectArrayProperty(moduleDecorator, "imports");
  if (!importsProperty) {
    throw new Error(`No imports array found in @Module decorator: ${parentModulePath}`);
  }

  if (importsProperty.elements.some((element) => element.getText(sourceFile) === moduleClassName)) {
    host.overwrite(parentModulePath, insertImport(sourceText, importStatement));
    return;
  }

  const withModule = insertIntoArray(
    sourceText,
    importsProperty.elements,
    importsProperty.arrayLiteral,
    sourceFile,
    moduleClassName,
  );
  host.overwrite(parentModulePath, insertImport(withModule, importStatement));
}

function findNestModuleDecorator(sourceFile: ts.SourceFile): ts.Decorator | undefined {
  let found: ts.Decorator | undefined;

  const visit = (node: ts.Node): void => {
    if (found || !ts.isClassDeclaration(node)) {
      ts.forEachChild(node, visit);
      return;
    }

    const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
    found = decorators.find((decorator) => {
      const expression = decorator.expression;
      return ts.isCallExpression(expression)
        && ts.isIdentifier(expression.expression)
        && expression.expression.text === "Module";
    });
  };

  visit(sourceFile);
  return found;
}

function findObjectArrayProperty(
  decorator: ts.Decorator,
  name: string,
): { arrayLiteral: ts.ArrayLiteralExpression; elements: ts.NodeArray<ts.Expression> } | undefined {
  const call = decorator.expression;
  if (!ts.isCallExpression(call)) return undefined;
  const [arg] = call.arguments;
  if (!arg || !ts.isObjectLiteralExpression(arg)) return undefined;

  for (const prop of arg.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    if (!ts.isIdentifier(prop.name) || prop.name.text !== name) continue;
    if (!ts.isArrayLiteralExpression(prop.initializer)) continue;
    return { arrayLiteral: prop.initializer, elements: prop.initializer.elements };
  }

  return undefined;
}

function insertImport(sourceText: string, importStatement: string): string {
  if (sourceText.includes(importStatement.trim())) return sourceText;
  const importMatches = [...sourceText.matchAll(/^import .*;\n/gm)];
  if (importMatches.length === 0) return `${importStatement}${sourceText}`;
  const last = importMatches[importMatches.length - 1];
  const insertAt = (last.index ?? 0) + last[0].length;
  return `${sourceText.slice(0, insertAt)}${importStatement}${sourceText.slice(insertAt)}`;
}

function insertIntoArray(
  sourceText: string,
  elements: ts.NodeArray<ts.Expression>,
  arrayLiteral: ts.ArrayLiteralExpression,
  sourceFile: ts.SourceFile,
  moduleClassName: string,
): string {
  if (elements.length === 0) {
    const insertAt = arrayLiteral.getStart(sourceFile) + 1;
    return `${sourceText.slice(0, insertAt)}${moduleClassName}${sourceText.slice(insertAt)}`;
  }

  const last = elements[elements.length - 1];
  const insertAt = last.getEnd();
  return `${sourceText.slice(0, insertAt)}, ${moduleClassName}${sourceText.slice(insertAt)}`;
}

function relativeImport(fromFile: string, toFile: string): string {
  const fromParts = normalizePath(fromFile).split("/").slice(0, -1);
  const toParts = normalizePath(toFile).replace(/\.ts$/, "").split("/");

  while (fromParts.length > 0 && toParts.length > 0 && fromParts[0] === toParts[0]) {
    fromParts.shift();
    toParts.shift();
  }

  const up = fromParts.map(() => "..");
  const path = [...up, ...toParts].join("/");
  return path.startsWith(".") ? path : `./${path}`;
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

export function domainFolderFor(parentModule: string, name: string): string {
  return `${domainRootFor(parentModule)}/${dasherize(name)}`;
}

export function parentFolderFor(parentModule: string): string {
  const parentDir = normalizePath(parentModule).split("/").slice(0, -1).join("/");
  return parentDir;
}

function domainRootFor(parentModule: string): string {
  const parentDir = parentFolderFor(parentModule);
  if (parentDir.endsWith("/modules") || parentDir.includes("/modules/")) {
    return parentDir;
  }
  if (parentDir === "src") {
    return "src/modules";
  }
  return `${parentDir}/modules`;
}
