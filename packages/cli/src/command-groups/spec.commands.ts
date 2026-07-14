// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from '../command-spec.js';
import {
  runSpecCodegen,
  runSpecDecode,
  runSpecList,
  runSpecResolve,
  runSpecSemanticPackReport,
  runSpecTrace,
  runSpecValidate,
} from '../commands/spec.js';

export const SPEC_COMMAND_DESCRIPTORS = [
  {
    id: 'spec.list',
    path: ['list'],
    usage: 'qa-sdk spec list [options]',
    description: 'Prefix spec 목록 + schema + spec docs',
    options: [
      {
        flag: '--specs',
        valueHint: '<path>',
        type: 'string',
        description: 'spec 파일/디렉토리 경로',
      },
      { flag: '--catalog', type: 'boolean', description: 'DEMO_CATALOG 연동 사용' },
    ],
    handlerKey: 'spec.list',
  },
  {
    id: 'spec.resolve',
    path: ['resolve'],
    usage: 'qa-sdk spec resolve --prefix <id> --values <json> [options]',
    description: 'Export title 생성',
    options: [
      { flag: '--prefix', valueHint: '<id>', type: 'string', description: 'Prefix ID' },
      { flag: '--values', valueHint: '<json>', type: 'string', description: '차원 값 JSON' },
      {
        flag: '--specs',
        valueHint: '<path>',
        type: 'string',
        description: 'spec 파일/디렉토리 경로',
      },
      { flag: '--catalog', type: 'boolean', description: 'DEMO_CATALOG 연동 사용' },
    ],
    handlerKey: 'spec.resolve',
  },
  {
    id: 'spec.validate',
    path: ['validate'],
    usage: 'qa-sdk spec validate --schema <id> --data <json> [options]',
    description: '스키마 검증',
    options: [
      { flag: '--schema', valueHint: '<id>', type: 'string', description: 'Schema ID' },
      { flag: '--data', valueHint: '<json>', type: 'string', description: '검증할 데이터 JSON' },
      {
        flag: '--specs',
        valueHint: '<path>',
        type: 'string',
        description: 'spec 파일/디렉토리 경로',
      },
      { flag: '--catalog', type: 'boolean', description: 'DEMO_CATALOG 연동 사용' },
    ],
    handlerKey: 'spec.validate',
  },
  {
    id: 'spec.trace',
    path: ['trace'],
    usage: 'qa-sdk spec trace --id <specId> [options]',
    description: '추적성 경로 조회',
    options: [
      { flag: '--id', valueHint: '<specId>', type: 'string', description: 'Spec ID (FEAT-xxx 등)' },
      {
        flag: '--specs',
        valueHint: '<path>',
        type: 'string',
        description: 'spec 파일/디렉토리 경로',
      },
      { flag: '--catalog', type: 'boolean', description: 'DEMO_CATALOG 연동 사용' },
    ],
    handlerKey: 'spec.trace',
  },
  {
    id: 'spec.decode',
    path: ['decode'],
    usage: 'qa-sdk spec decode --address <addr> [options]',
    description: '주소 → 제목 변환 (decode→entries→export)',
    options: [
      {
        flag: '--address',
        valueHint: '<prefix:v:idx>',
        type: 'string',
        description: '디코딩할 주소',
      },
      { flag: '--deep', type: 'boolean', description: 'Deep resolve (참조 해결) 수행' },
      {
        flag: '--format',
        valueHint: '<text|json>',
        type: 'string',
        description: '출력 형식 (기본: text)',
      },
      {
        flag: '--specs',
        valueHint: '<path>',
        type: 'string',
        description: 'spec 파일/디렉토리 경로',
      },
      { flag: '--catalog', type: 'boolean', description: 'DEMO_CATALOG 연동 사용' },
    ],
    handlerKey: 'spec.decode',
  },
  {
    id: 'spec.codegen',
    path: ['codegen'],
    usage: 'qa-sdk spec codegen [options]',
    description: '코드 생성 (ts|esm|cjs|proto|json-schema|dts)',
    options: [
      { flag: '--output', valueHint: '<path>', type: 'string', description: '출력 파일 경로' },
      {
        flag: '--format',
        valueHint: '<fmt>',
        type: 'string',
        description: '생성 형식 (ts|esm|cjs|proto|json-schema|dts)',
      },
      {
        flag: '--specs',
        valueHint: '<path>',
        type: 'string',
        description: 'spec 파일/디렉토리 경로',
      },
      { flag: '--catalog', type: 'boolean', description: 'DEMO_CATALOG 연동 사용' },
    ],
    handlerKey: 'spec.codegen',
  },
  {
    id: 'spec.drift',
    path: ['drift'],
    usage: 'qa-sdk spec drift [options]',
    description: 'Spec drift 감지',
    handlerKey: 'spec.drift',
  },
  {
    id: 'spec.semantic-pack.report',
    path: ['semantic-pack', 'report'],
    usage:
      'qa-sdk spec semantic-pack report [--manifest <file>] [--changes <file>] [--proposals <file>] [--format json|markdown] [--no-git]',
    description: 'Semantic Indexing Pack compatibility report 생성',
    options: [
      {
        flag: '--manifest',
        valueHint: '<file>',
        type: 'string',
        description: 'SemanticIndexingPackManifest JSON',
      },
      {
        flag: '--changes',
        valueHint: '<file>',
        type: 'string',
        description: 'SemanticIndexingSurfaceChangeInput[] JSON',
      },
      {
        flag: '--proposals',
        valueHint: '<file>',
        type: 'string',
        description: 'SemanticIndexingPromotionProposal[] JSON',
      },
      { flag: '--format', valueHint: '<json|markdown>', type: 'string', description: '출력 형식' },
      { flag: '--no-git', type: 'boolean', description: 'git dirty/freshness 보강 비활성화' },
    ],
    handlerKey: 'spec.semantic-pack.report',
  },
] as const satisfies readonly CommandDescriptor[];

export const SPEC_COMMAND_TREE = descriptorsToTree(
  SPEC_COMMAND_DESCRIPTORS,
) as readonly CliCommandNode[];

export const SPEC_COMMAND_SPECS = collectCommandUsageSpecs(
  ['spec'],
  SPEC_COMMAND_TREE,
) as readonly CommandUsageSpec<string>[];

export const SPEC_HANDLER_REGISTRY = {
  'spec.list': runSpecList,
  'spec.resolve': runSpecResolve,
  'spec.validate': runSpecValidate,
  'spec.trace': runSpecTrace,
  'spec.decode': runSpecDecode,
  'spec.codegen': runSpecCodegen,
  'spec.drift': async (rest: string[]) => {
    const { cliSpecDrift } = await import('../commands/spec-drift.js');
    return cliSpecDrift(rest);
  },
  'spec.semantic-pack.report': runSpecSemanticPackReport,
} satisfies Readonly<Record<string, RestCommandHandler>>;
