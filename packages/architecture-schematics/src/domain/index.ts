import { strings } from '@angular-devkit/core';
import {
  apply,
  applyTemplates,
  chain,
  filter,
  mergeWith,
  move,
  type Rule,
  type SchematicContext,
  type Tree,
  url,
} from '@angular-devkit/schematics';
import { format } from 'prettier';

import { domainFolderFor, normalizePath, wireDomainModule } from './ast-wiring.js';
import type { DomainOptions } from './options.js';
import { camelize, classify, constantize, dasherize } from './strings.js';

export function domain(options: DomainOptions): Rule {
  return chain([
    validateOptions(options),
    renderDomainFiles(options),
    wireParentModule(options),
    formatTouchedTypescript(options),
  ]);
}

function validateOptions(options: DomainOptions): Rule {
  return (tree: Tree) => {
    if (!options.name || dasherize(options.name).length === 0) {
      throw new Error(
        'Option name is required and must contain at least one alphanumeric character.',
      );
    }
    if (!options.parentModule) {
      throw new Error('Option parentModule is required.');
    }
    const parent = normalizePath(options.parentModule);
    if (!parent.endsWith('.module.ts')) {
      throw new Error(`parentModule must point to a NestJS *.module.ts file: ${parent}`);
    }
    if (!tree.exists(parent)) {
      throw new Error(`parentModule does not exist: ${parent}`);
    }
    return tree;
  };
}

function renderDomainFiles(options: DomainOptions): Rule {
  return () => {
    const source = apply(url('./files/__name@dasherize__'), [
      filter((path) => {
        const needsReadModel = Boolean(options.includeReadModel || options.includeBff);
        if (!needsReadModel && path.includes('/read-model/')) return false;
        if (!needsReadModel && path.includes('/queries/')) return false;
        if (!options.includeBff && path.includes('/bff/')) return false;
        return true;
      }),
      applyTemplates({
        ...strings,
        name: options.name,
        dasherize,
        camelize,
        classify,
        constantize,
        includeReadModel: Boolean(options.includeReadModel || options.includeBff),
        includeBff: Boolean(options.includeBff),
      }),
      move(domainFolderFor(options.parentModule, options.name)),
    ]);
    return mergeWith(source);
  };
}

function wireParentModule(options: DomainOptions): Rule {
  return (tree: Tree) => {
    const domainFolder = domainFolderFor(options.parentModule, options.name);
    wireDomainModule(tree, {
      parentModule: options.parentModule,
      name: options.name,
      generatedModulePath: `${domainFolder}/${dasherize(options.name)}.module.ts`,
    });
    return tree;
  };
}

function formatTouchedTypescript(options: DomainOptions): Rule {
  return async (tree: Tree, context: SchematicContext) => {
    if (options.skipFormat) return tree;

    const domainFolder = `/${domainFolderFor(options.parentModule, options.name)}/`;
    const parentModule = `/${normalizePath(options.parentModule)}`;
    const paths: string[] = [];
    tree.visit((path) => paths.push(path));

    for (const path of paths) {
      if (!path.endsWith('.ts')) continue;
      if (path !== parentModule && !path.startsWith(domainFolder)) continue;

      const source = tree.readText(path);
      const formatted = await format(source, {
        parser: 'typescript',
        printWidth: 100,
        trailingComma: 'all',
      });
      tree.overwrite(path, formatted);
    }

    context.logger.info('Formatted generated TypeScript files with Prettier.');
    return tree;
  };
}
