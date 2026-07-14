import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from '../command-spec.js';
import { cliTaxonomy } from '../commands/taxonomy/index.js';

export const TAXONOMY_COMMAND_DESCRIPTORS = [
  { id: 'tax.help', path: ['help'], handlerKey: 'tax.help' },
  { id: 'tax.validate', path: ['validate'], handlerKey: 'tax.validate' },
  { id: 'tax.show', path: ['show'], handlerKey: 'tax.show' },
  { id: 'tax.codegen', path: ['codegen'], handlerKey: 'tax.codegen' },
  { id: 'tax.diff', path: ['diff'], handlerKey: 'tax.diff' },
  { id: 'tax.git-diff', path: ['git-diff'], handlerKey: 'tax.git-diff' },
  { id: 'tax.migration', path: ['migration'], handlerKey: 'tax.migration' },
  { id: 'tax.doctor', path: ['doctor'], handlerKey: 'tax.doctor' },
] as const satisfies readonly CommandDescriptor[];

export const TAXONOMY_COMMAND_TREE = descriptorsToTree(
  TAXONOMY_COMMAND_DESCRIPTORS,
) as readonly CliCommandNode[];

export const TAXONOMY_COMMAND_SPECS = collectCommandUsageSpecs(
  ['tax'],
  TAXONOMY_COMMAND_TREE,
) as readonly CommandUsageSpec<string>[];

export const TAXONOMY_TOP_LEVEL_USAGE_LINES = [
  'qa-sdk tax help                    도움말',
  'qa-sdk tax validate <file>         yaml 텍소노미 검증',
  'qa-sdk tax show <file> <ref>       텍소노미 단위 조회 (3-tier ref)',
  'qa-sdk tax codegen <file> --out    TS 5 파일 생성',
  'qa-sdk tax diff <a> <b>            두 yaml 비교',
  'qa-sdk tax git-diff [base]         git base 대비 yaml 변경 diff',
  'qa-sdk tax migration --base <ref>  git base vs working tree 마이그레이션 계획',
  'qa-sdk tax doctor <file> --auto    외부 SSOT drift 점검',
] as const;

export const TAXONOMY_HANDLER_REGISTRY = new Proxy({} as Record<string, RestCommandHandler>, {
  get(_target, prop) {
    if (typeof prop !== 'string' || !prop.startsWith('tax.')) return undefined;
    return async (rest: string[]) => {
      const subcommand = prop.slice(4);
      await cliTaxonomy([...subcommand.split('.'), ...rest]);
    };
  },
});
