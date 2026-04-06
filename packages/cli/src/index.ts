/**
 * qa-sdk CLI — DSL 접근 도구.
 *
 * CLI는 시스템을 제어하지 않는다.
 * 외부 상태를 관찰(scan)하고, DSL로 기술(register)하고,
 * 변경을 시뮬레이션(dry-run)하고, 인터페이스를 생성(codegen)한다.
 *
 * 실제 version bump, build, deploy는 각 환경의 도구가 수행한다.
 * CLI는 그 결과를 수집하여 일관적 인터페이스로 관리할 뿐이다.
 */

import { pathToFileURL } from 'node:url';
import {
  emitCliEvent,
  setCatalogContext,
} from './commands/dkg.js';
import { loadCatalog } from 'config-loader';
import type { Catalog } from '@qa-sdk/core';
import { cliQuality } from './commands/quality.js';
import {
  executeCommand,
  generateHelp,
  resolveCliTreeCommand,
  formatUsageLines,
  formatUsageSpecs,
  type CliCommandNode,
  type CommandContext,
  type RestCommandHandler,
} from './command-spec.js';
import {
  SERVICE_COMMAND_SPECS as SERVICE_GROUP_COMMAND_SPECS,
  SERVICE_COMMAND_TREE as SERVICE_GROUP_COMMAND_TREE,
  SERVICE_HANDLER_REGISTRY as SERVICE_GROUP_HANDLER_REGISTRY,
} from './command-groups/service.commands.js';
import {
  FLOW_COMMAND_SPECS as FLOW_GROUP_COMMAND_SPECS,
  FLOW_COMMAND_TREE as FLOW_GROUP_COMMAND_TREE,
  FLOW_HANDLER_REGISTRY as FLOW_GROUP_HANDLER_REGISTRY,
} from './command-groups/flow.commands.js';
import {
  DKG_COMMAND_SPECS as DKG_GROUP_COMMAND_SPECS,
  DKG_COMMAND_TREE as DKG_GROUP_COMMAND_TREE,
  createDkgHandlerRegistry,
} from './command-groups/dkg.commands.js';
import {
  QUALITY_COMMAND_SPECS as QUALITY_GROUP_COMMAND_SPECS,
  QUALITY_COMMAND_TREE as QUALITY_GROUP_COMMAND_TREE,
  QUALITY_HANDLER_REGISTRY as QUALITY_GROUP_HANDLER_REGISTRY,
} from './command-groups/quality.commands.js';
import {
  REVIEW_COMMAND_SPECS as REVIEW_GROUP_COMMAND_SPECS,
  REVIEW_COMMAND_TREE as REVIEW_GROUP_COMMAND_TREE,
  REVIEW_HANDLER_REGISTRY as REVIEW_GROUP_HANDLER_REGISTRY,
} from './command-groups/review.commands.js';
import {
  INGEST_COMMAND_SPECS as INGEST_GROUP_COMMAND_SPECS,
  INGEST_COMMAND_TREE as INGEST_GROUP_COMMAND_TREE,
  INGEST_HANDLER_REGISTRY as INGEST_GROUP_HANDLER_REGISTRY,
} from './command-groups/ingest.commands.js';
import {
  GATE_COMMAND_SPECS as GATE_GROUP_COMMAND_SPECS,
  GATE_COMMAND_TREE as GATE_GROUP_COMMAND_TREE,
  GATE_HANDLER_REGISTRY as GATE_GROUP_HANDLER_REGISTRY,
} from './command-groups/gate.commands.js';
import {
  QUERY_COMMAND_SPECS as QUERY_GROUP_COMMAND_SPECS,
  QUERY_COMMAND_TREE as QUERY_GROUP_COMMAND_TREE,
  QUERY_HANDLER_REGISTRY as QUERY_GROUP_HANDLER_REGISTRY,
} from './command-groups/query.commands.js';
import {
  SPEC_COMMAND_SPECS as SPEC_GROUP_COMMAND_SPECS,
  SPEC_COMMAND_TREE as SPEC_GROUP_COMMAND_TREE,
  SPEC_HANDLER_REGISTRY as SPEC_GROUP_HANDLER_REGISTRY,
} from './command-groups/spec.commands.js';
import {
  TEST_COMMAND_TREE as TEST_GROUP_COMMAND_TREE,
  TEST_HANDLER_REGISTRY as TEST_GROUP_HANDLER_REGISTRY,
  TEST_COMMAND_SPECS as TEST_GROUP_COMMAND_SPECS,
} from './command-groups/test.commands.js';
import {
  CATALOG_COMMAND_TREE as CATALOG_GROUP_COMMAND_TREE,
  CATALOG_HANDLER_REGISTRY as CATALOG_GROUP_HANDLER_REGISTRY,
  CATALOG_COMMAND_SPECS as CATALOG_GROUP_COMMAND_SPECS,
} from './command-groups/catalog.commands.js';
import {
  ROOT_COMMAND_TREE as ROOT_GROUP_COMMAND_TREE,
  createRootHandlerRegistry,
  ROOT_COMMAND_SPECS as ROOT_GROUP_COMMAND_SPECS,
  DX_COMMAND_SPECS as DX_GROUP_COMMAND_SPECS,
} from './command-groups/root.commands.js';
import {
  SCAN_COMMAND_TREE as SCAN_GROUP_COMMAND_TREE,
  SCAN_HANDLER_REGISTRY as SCAN_GROUP_HANDLER_REGISTRY,
  SCAN_COMMAND_SPECS as SCAN_GROUP_COMMAND_SPECS,
} from './command-groups/scan.commands.js';
import {
  GIT_COMMAND_TREE as GIT_GROUP_COMMAND_TREE,
  GIT_HANDLER_REGISTRY as GIT_GROUP_HANDLER_REGISTRY,
  GIT_COMMAND_SPECS as GIT_GROUP_COMMAND_SPECS,
} from './command-groups/git.commands.js';
import {
  PREFIX_COMMAND_TREE as PREFIX_GROUP_COMMAND_TREE,
  createPrefixHandlerRegistry,
  PREFIX_COMMAND_SPECS as PREFIX_GROUP_COMMAND_SPECS,
} from './command-groups/prefix.commands.js';
import {
  FACET_COMMAND_TREE as FACET_GROUP_COMMAND_TREE,
  FACET_HANDLER_REGISTRY as FACET_GROUP_HANDLER_REGISTRY,
  FACET_COMMAND_SPECS as FACET_GROUP_COMMAND_SPECS,
} from './command-groups/facet.commands.js';
import {
  MOTION_COMMAND_SPECS as MOTION_GROUP_COMMAND_SPECS,
  MOTION_COMMAND_TREE as MOTION_GROUP_COMMAND_TREE,
  MOTION_HANDLER_REGISTRY as MOTION_GROUP_HANDLER_REGISTRY,
} from './command-groups/motion.commands.js';
import {
  OBS_COMMAND_SPECS as OBS_GROUP_COMMAND_SPECS,
  OBS_COMMAND_TREE as OBS_GROUP_COMMAND_TREE,
  OBS_HANDLER_REGISTRY as OBS_GROUP_HANDLER_REGISTRY,
} from './command-groups/obs.commands.js';
import {
  DEF_COMMAND_SPECS as DEF_GROUP_COMMAND_SPECS,
  DEF_COMMAND_TREE as DEF_GROUP_COMMAND_TREE,
  DEF_HANDLER_REGISTRY as DEF_GROUP_HANDLER_REGISTRY,
  DEF_TOP_LEVEL_USAGE_LINES as DEF_GROUP_TOP_LEVEL_USAGE_LINES,
} from './command-groups/def.commands.js';

// ── Usage ────────────────────────────────────────────

type TreeDispatch = (handlerKey: string, rest: string[]) => Promise<void>;

interface TreeCommandGroup {
  readonly rootSegments: readonly string[];
  readonly rootName: string;
  readonly tree: readonly CliCommandNode[];
  readonly dispatch: TreeDispatch;
}

export const USAGE = `
qa-sdk — DSL 접근 도구

Global Options:
  --catalog <path>       카탈로그 파일 (.ts/.js/.json). 기본: qa-sdk.config.ts 또는 DEMO_CATALOG

Usage:
${formatUsageSpecs(ROOT_GROUP_COMMAND_SPECS)}
${formatUsageSpecs(SCAN_GROUP_COMMAND_SPECS)}
${formatUsageSpecs(GIT_GROUP_COMMAND_SPECS)}
${formatUsageSpecs(FACET_GROUP_COMMAND_SPECS)}
${formatUsageSpecs(MOTION_GROUP_COMMAND_SPECS)}
${formatUsageSpecs(SPEC_GROUP_COMMAND_SPECS)}
${formatUsageSpecs(DX_GROUP_COMMAND_SPECS)}

${formatUsageSpecs(DKG_GROUP_COMMAND_SPECS)}

${formatUsageSpecs(FLOW_GROUP_COMMAND_SPECS)}

${formatUsageSpecs(SERVICE_GROUP_COMMAND_SPECS)}

${formatUsageSpecs(INGEST_GROUP_COMMAND_SPECS)}
${formatUsageSpecs(GATE_GROUP_COMMAND_SPECS)}
${formatUsageSpecs(QUERY_GROUP_COMMAND_SPECS)}

${formatUsageSpecs(REVIEW_GROUP_COMMAND_SPECS)}

${formatUsageSpecs(PREFIX_GROUP_COMMAND_SPECS)}
${formatUsageSpecs(TEST_GROUP_COMMAND_SPECS)}

${formatUsageSpecs(QUALITY_GROUP_COMMAND_SPECS)}

${formatUsageSpecs(CATALOG_GROUP_COMMAND_SPECS)}
${formatUsageLines(DEF_GROUP_TOP_LEVEL_USAGE_LINES)}
${formatUsageSpecs(OBS_GROUP_COMMAND_SPECS)}
`.trim();

async function dispatchFromRegistry(
  registry: Readonly<Record<string, RestCommandHandler>>,
  handlerKey: string,
  rest: string[],
): Promise<void> {
  const handler = registry[handlerKey];
  if (handler) {
    await handler(rest);
  }
}

async function dispatchDefCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(DEF_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchDkgCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(createDkgHandlerRegistry(loadedCatalog), handlerKey, rest);
}

async function dispatchServiceCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(SERVICE_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchQualityCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(QUALITY_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchReviewCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(REVIEW_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchIngestCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(INGEST_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchObsCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(OBS_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchGateCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(GATE_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchQueryCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(QUERY_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchSpecCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(SPEC_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchTestCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(TEST_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchCatalogCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(CATALOG_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchMotionCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(MOTION_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchFlowCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(FLOW_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchRootCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(createRootHandlerRegistry(loadedCatalog), handlerKey, rest);
}

async function dispatchScanCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(SCAN_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchGitCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(GIT_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchPrefixCommand(handlerKey: string, rest: string[]): Promise<void> {
  if (!loadedCatalog) { console.error('카탈로그 로딩 실패'); return; }
  await dispatchFromRegistry(createPrefixHandlerRegistry(loadedCatalog), handlerKey, rest);
}

async function dispatchFacetCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(FACET_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

const TREE_COMMAND_GROUPS: readonly TreeCommandGroup[] = [
  { rootSegments: ['scan'], rootName: 'qa-sdk scan', tree: SCAN_GROUP_COMMAND_TREE, dispatch: dispatchScanCommand },
  { rootSegments: ['git'], rootName: 'qa-sdk git', tree: GIT_GROUP_COMMAND_TREE, dispatch: dispatchGitCommand },
  { rootSegments: ['prefix'], rootName: 'qa-sdk prefix', tree: PREFIX_GROUP_COMMAND_TREE, dispatch: dispatchPrefixCommand },
  { rootSegments: ['facet'], rootName: 'qa-sdk facet', tree: FACET_GROUP_COMMAND_TREE, dispatch: dispatchFacetCommand },
  { rootSegments: ['def'], rootName: 'qa-sdk def', tree: DEF_GROUP_COMMAND_TREE, dispatch: dispatchDefCommand },
  { rootSegments: ['service'], rootName: 'qa-sdk service', tree: SERVICE_GROUP_COMMAND_TREE, dispatch: dispatchServiceCommand },
  { rootSegments: ['dkg'], rootName: 'qa-sdk dkg', tree: DKG_GROUP_COMMAND_TREE, dispatch: dispatchDkgCommand },
  { rootSegments: [], rootName: 'qa-sdk', tree: QUALITY_GROUP_COMMAND_TREE, dispatch: dispatchQualityCommand },
  { rootSegments: ['review'], rootName: 'qa-sdk review', tree: REVIEW_GROUP_COMMAND_TREE, dispatch: dispatchReviewCommand },

  { rootSegments: ['ingest'], rootName: 'qa-sdk ingest', tree: INGEST_GROUP_COMMAND_TREE, dispatch: dispatchIngestCommand },
  { rootSegments: ['obs'], rootName: 'qa-sdk obs', tree: OBS_GROUP_COMMAND_TREE, dispatch: dispatchObsCommand },
  { rootSegments: ['gate'], rootName: 'qa-sdk gate', tree: GATE_GROUP_COMMAND_TREE, dispatch: dispatchGateCommand },
  { rootSegments: ['query'], rootName: 'qa-sdk query', tree: QUERY_GROUP_COMMAND_TREE, dispatch: dispatchQueryCommand },
  { rootSegments: ['spec'], rootName: 'qa-sdk spec', tree: SPEC_GROUP_COMMAND_TREE, dispatch: dispatchSpecCommand },
  { rootSegments: ['test'], rootName: 'qa-sdk test', tree: TEST_GROUP_COMMAND_TREE, dispatch: dispatchTestCommand },
  { rootSegments: ['catalog'], rootName: 'qa-sdk catalog', tree: CATALOG_GROUP_COMMAND_TREE, dispatch: dispatchCatalogCommand },
  { rootSegments: ['motion'], rootName: 'qa-sdk motion', tree: MOTION_GROUP_COMMAND_TREE, dispatch: dispatchMotionCommand },
  { rootSegments: ['flow'], rootName: 'qa-sdk flow', tree: FLOW_GROUP_COMMAND_TREE, dispatch: dispatchFlowCommand },
  { rootSegments: [], rootName: 'qa-sdk', tree: ROOT_GROUP_COMMAND_TREE, dispatch: dispatchRootCommand },
] as const;

function createHandlerRegistry(dispatch: TreeDispatch): Record<string, (ctx: CommandContext) => Promise<void>> {
  return new Proxy({} as Record<string, (ctx: CommandContext) => Promise<void>>, {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      return async (ctx: CommandContext) => dispatch(prop, ctx.rawArgs);
    },
  });
}

function tryPrintTreeHelp(args: string[]): boolean {
  const normalizedArgs = args.filter((arg) => arg !== '--help' && arg !== '-h');

  for (const group of TREE_COMMAND_GROUPS) {
    const [rootSegment] = group.rootSegments;
    if (normalizedArgs.length === group.rootSegments.length && normalizedArgs[0] === rootSegment) {
      console.log(generateHelp(group.rootName, group.tree));
      return true;
    }

    const resolved = resolveCliTreeCommand(normalizedArgs, group.rootSegments, group.tree);
    if (resolved) {
      console.log(generateHelp(group.rootName, group.tree, resolved.node));
      return true;
    }
  }

  return false;
}

async function tryExecuteTreeCommand(args: string[]): Promise<boolean> {
  for (const group of TREE_COMMAND_GROUPS) {
    const handled = await executeCommand(
      args,
      group.tree,
      { handlers: createHandlerRegistry(group.dispatch) },
      group.rootSegments,
    );
    if (handled) return true;
  }
  return false;
}

// ── Module State ────────────────────────────────────
let loadedCatalog: Catalog | undefined;

// ── Main ─────────────────────────────────────────────

export async function main(argv = process.argv.slice(2)) {
  const args = argv;

  // --catalog 글로벌 옵션 추출
  const catalogIdx = args.indexOf('--catalog');
  let catalogPath: string | undefined;
  const filteredArgs = [...args];
  if (catalogIdx >= 0 && catalogIdx + 1 < args.length) {
    catalogPath = args[catalogIdx + 1];
    filteredArgs.splice(catalogIdx, 2);
  }

  if (filteredArgs.length === 0) {
    console.log(USAGE);
    return;
  }

  if (filteredArgs.includes('--help') || filteredArgs.includes('-h')) {
    if (tryPrintTreeHelp(filteredArgs)) return;
    console.log(USAGE);
    return;
  }

  const sub = resolveSubcommandInternal(filteredArgs);

  // 카탈로그가 필요한 명령 → loadCatalog() 실행
  const DX_COMMANDS = new Set([
    'encode',
    'decode',
    'resolve',
    'find-version',
    'list-prefixes',
    'list-axes',
    'derive-refs',
    'impact',
  ]);
  // codegen --registry 시에는 로컬 카탈로그 로딩 불필요
  const hasRegistryFlag = filteredArgs.includes('--registry');
  const needsCatalog =
    catalogPath ||
    sub.name.startsWith('dkg') ||
    sub.name.startsWith('catalog') ||
    sub.name.startsWith('prefix') ||
    (sub.name === 'codegen' && !hasRegistryFlag) ||
    DX_COMMANDS.has(sub.name);
  if (needsCatalog) {
    loadedCatalog = await loadCatalog(catalogPath);
    setCatalogContext(loadedCatalog);
  }

  // 모든 CLI 명령을 cli_event 좌표로 기록
  try {
    emitCliEvent(sub.name);
  } catch {
    /* 관측 실패는 명령 실행에 영향 없음 */
  }

  if (await tryExecuteTreeCommand(filteredArgs)) {
    return;
  }

  console.error(`알 수 없는 명령: ${sub.name}`);
  console.log(USAGE);
  process.exit(1);
}

// ── Subcommand 해석 ──────────────────────────────────

interface Subcommand {
  name: string;
  rest: string[];
}

interface InternalSubcommand extends Subcommand {
  handlerKey?: string;
}

function resolveSubcommandInternal(args: string[]): InternalSubcommand {
  for (const group of TREE_COMMAND_GROUPS) {
    const resolved = resolveCliTreeCommand(args, group.rootSegments, group.tree);
    if (resolved) {
      return {
        name: resolved.commandName,
        rest: resolved.rest,
        handlerKey: resolved.node.handlerKey,
      };
    }
  }

  // 1단어 커맨드 fallback
  const oneWord = [
    'quality',
  ];
  if (oneWord.includes(args[0])) {
    return { name: args[0], rest: args.slice(1) };
  }
  return { name: args.join(' '), rest: [] };
}

export function resolveSubcommand(args: string[]): Subcommand {
  const sub = resolveSubcommandInternal(args);
  return { name: sub.name, rest: sub.rest };
}

// ── DKG helpers ─────────────────────────────────────

// ── Entry ────────────────────────────────────────────

const isDirectExecution = (() => {
  const entry = process.argv[1];
  return !!entry && pathToFileURL(entry).href === import.meta.url;
})();

if (isDirectExecution) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
