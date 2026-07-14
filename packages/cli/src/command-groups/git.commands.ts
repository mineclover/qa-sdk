// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { parseArgs } from 'node:util';
import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
} from '../command-spec.js';
import { gitConflicts, watchGitConflicts } from '../commands/git-conflicts.js';
import { gitScan } from '../commands/git-scan.js';

type RestCommandHandler = (rest: string[]) => Promise<void> | void;

export const GIT_COMMAND_DESCRIPTORS = [
  {
    id: 'git.conflicts',
    path: ['conflicts'],
    usage: 'qa-sdk git conflicts [options]      Git 충돌/발산 리포트',
    handlerKey: 'git.conflicts',
    options: [
      {
        flag: '--root',
        valueHint: '<path>',
        type: 'string',
        description: '분석 대상 저장소 루트 (기본: .)',
      },
      {
        flag: '--remote',
        valueHint: '<name>',
        type: 'string',
        description: '원격 이름 (기본: origin)',
      },
      {
        flag: '--base',
        valueHint: '<ref>',
        type: 'string',
        description: '기준 브랜치/참조 (기본: upstream 또는 remote HEAD)',
      },
      {
        flag: '--current',
        valueHint: '<ref>',
        type: 'string',
        description: '현재 브랜치 대신 비교할 ref (기본: HEAD)',
      },
      {
        flag: '--max-commits',
        valueHint: '<n>',
        type: 'string',
        description: 'source별 포함할 최근 커밋 수 (기본: 12)',
      },
      {
        flag: '--skip-fetch',
        type: 'boolean',
        description: 'fetch 없이 로컬에 저장된 remote ref만 사용',
      },
      {
        flag: '--skip-worktrees',
        type: 'boolean',
        description: '다른 local worktree는 분석에서 제외',
      },
      {
        flag: '--output',
        valueHint: '<path>',
        type: 'string',
        description: 'JSON 리포트를 파일로 저장',
      },
      { flag: '--watch', type: 'boolean', description: '주기적으로 리포트를 다시 계산' },
      {
        flag: '--interval-ms',
        valueHint: '<n>',
        type: 'string',
        description: 'watch 주기 ms (기본: 5000)',
      },
      { flag: '--json', type: 'boolean', description: 'JSON으로 출력' },
      {
        flag: '--limit',
        valueHint: '<n>',
        type: 'string',
        description: '사람이 읽는 출력 최대 개수 (기본: 10)',
      },
    ],
  },
  {
    id: 'git.scan',
    path: ['scan'],
    usage: 'qa-sdk git scan [options]          Git 메타데이터 수집 → SchemaSnapshot',
    handlerKey: 'git.scan',
    options: [
      {
        flag: '--root',
        valueHint: '<path>',
        type: 'string',
        description: '모노레포 루트 (기본: .)',
      },
      {
        flag: '--output',
        valueHint: '<dir>',
        type: 'string',
        description: '저장 디렉토리 (기본: ./schemas)',
      },
      {
        flag: '--id',
        valueHint: '<name>',
        type: 'string',
        description: '스키마 ID (기본: repo 이름에서 추출)',
      },
    ],
  },
] as const satisfies readonly CommandDescriptor[];

export const GIT_COMMAND_TREE = descriptorsToTree(
  GIT_COMMAND_DESCRIPTORS,
) as readonly CliCommandNode[];

export const GIT_COMMAND_SPECS = collectCommandUsageSpecs(
  ['git'],
  GIT_COMMAND_TREE,
) as readonly CommandUsageSpec<string>[];

export const GIT_HANDLER_REGISTRY = {
  'git.conflicts': async (rest: string[]) => {
    const { values } = parseArgs({
      args: rest,
      options: {
        root: { type: 'string', default: '.' },
        remote: { type: 'string', default: 'origin' },
        base: { type: 'string' },
        current: { type: 'string' },
        'max-commits': { type: 'string', default: '12' },
        json: { type: 'boolean', default: false },
        output: { type: 'string' },
        watch: { type: 'boolean', default: false },
        'interval-ms': { type: 'string', default: '5000' },
        limit: { type: 'string', default: '10' },
        'skip-fetch': { type: 'boolean', default: false },
        'skip-worktrees': { type: 'boolean', default: false },
      },
      strict: true,
    });

    const args = {
      root: values.root ?? '.',
      remote: values.remote ?? 'origin',
      base: values.base,
      current: values.current,
      maxCommits: parseInt(values['max-commits'] ?? '12', 10),
      json: values.json ?? false,
      output: values.output,
      watch: values.watch ?? false,
      intervalMs: parseInt(values['interval-ms'] ?? '5000', 10),
      limit: parseInt(values.limit ?? '10', 10),
      skipFetch: values['skip-fetch'] ?? false,
      skipWorktrees: values['skip-worktrees'] ?? false,
    };

    if (args.watch) {
      await watchGitConflicts(args);
      return;
    }

    await gitConflicts(args);
  },
  'git.scan': async (rest: string[]) => {
    const { values } = parseArgs({
      args: rest,
      options: {
        root: { type: 'string', default: '.' },
        output: { type: 'string', default: './schemas' },
        id: { type: 'string' },
      },
      strict: true,
    });
    await gitScan({
      root: values.root ?? '.',
      output: values.output ?? './schemas',
      id: values.id,
    });
  },
} satisfies Readonly<Record<string, RestCommandHandler>>;
