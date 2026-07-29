// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * qa-sdk def — definition-catalog 문서 관리 CLI.
 *
 * 데이터 소스: SQLite 직접 접근(기본) 또는 definition-service HTTP.
 *   --local:  SQLite DB 직접 (서버 불필요)
 *   --server: definition-service API (기본: localhost:3700)
 *   --scan:   docs/ frontmatter 직접 스캔 (read-only degraded mode)
 *   생략:     DB 파일 있으면 local, 없으면 server, 둘 다 없으면 scan 시도
 *
 * 모든 조회/분석 명령은 DefDataSource 기반. scan만 파일 직접 스캔.
 */

import type { DefDataSource } from 'definition-catalog';
import { createDataSource, type DataSourceOptions } from 'definition-data-source';
import { formatHelpSections } from '../command-spec.js';
import { hasCliFlag, parseCliArgs, toDataSourceOptions } from '../lib/cli-args.js';
import { cmdTierClassify } from '../lib/def-tier-classify.cmd.js';
import { cmdPlatformVerify } from './def/platform.js';
import {
  closeDataSource,
  getRootDir,
} from './def/shared.js';
import { buildDomainRootRegistry } from './def/domain-registry.js';
import {
  cmdContext,
  cmdHandoff,
  cmdHandoffAggregate,
} from './def/context-handoff.js';
import {
  cmdVerificationArtifact,
  cmdVerificationBindings,
} from './def/verification.js';
import { cmdState } from './def/state.js';
import { cmdAudit, cmdCodeLinkGaps, cmdScanAudit, cmdSync, scan } from './def/quality.js';
import { cmdDoctor } from './def/doctor.js';
import { DEF_HELP_SECTIONS } from './def/help.js';
import {
  cmdBody,
  cmdChildren,
  cmdFindByFile,
  cmdGet,
  cmdGuide,
  cmdIncoming,
  cmdLinkRules,
  cmdList,
  cmdOutgoing,
  cmdParent,
  cmdValidate,
} from './def/read.js';
import {
  cmdAuditDb,
  cmdBoundary,
  cmdBoundaryContext,
  cmdBottomup,
  cmdCheck,
  cmdConcepts,
  cmdImpact,
  cmdOverview,
  cmdSearch,
  cmdStats,
  cmdTopdown,
} from './def/analysis.js';

export { createPlatformQueryInvocation, createPlatformVerifyInvocation } from './def/platform.js';

async function getSource(options: DataSourceOptions): Promise<DefDataSource> {
  return createDataSource(options);
}

function printDefHelp() {
  const body = formatHelpSections(DEF_HELP_SECTIONS);
  console.log(`qa-sdk def — 문서 관리\n\n${body}`);
}

type DataSourceCommand = (
  source: DefDataSource,
  rest: readonly string[],
  flags: Record<string, string>,
) => Promise<void>;

const DATA_SOURCE_COMMANDS: Readonly<Record<string, DataSourceCommand>> = {
  list: (source, _rest, flags) => cmdList(source, flags),
  get: (source, rest, flags) => cmdGet(source, rest[0], flags.address),
  body: async (source, rest, flags) => {
    if (!rest[0]) {
      console.log('Usage: qa-sdk def body|read <문서ID> [--json]');
      return;
    }
    await cmdBody(source, rest[0], flags);
  },
  read: async (source, rest, flags) => {
    if (!rest[0]) {
      console.log('Usage: qa-sdk def body|read <문서ID> [--json]');
      return;
    }
    await cmdBody(source, rest[0], flags);
  },
  children: (source, rest) => cmdChildren(source, rest[0]),
  parent: (source, rest) => cmdParent(source, rest[0]),
  incoming: (source, rest, flags) => cmdIncoming(source, rest[0], flags.address),
  outgoing: (source, rest, flags) => cmdOutgoing(source, rest[0], flags.address),
  validate: (source, _rest, flags) => cmdValidate(source, flags),
  search: (source, rest, flags) => cmdSearch(source, rest[0] ?? flags.q ?? ''),
  concepts: (source, _rest, flags) => cmdConcepts(source, flags),
  stats: (source) => cmdStats(source),
  impact: (source, rest, flags) => cmdImpact(source, rest[0], flags.address),
  check: (source, rest) => cmdCheck(source, rest[0]),
  audit: (source, _rest, flags) => cmdAudit(source, flags),
  'audit-db': (source) => cmdAuditDb(source),
  overview: (source) => cmdOverview(source),
  tier: async (source, rest, flags) => {
    if (rest[0] === 'classify') {
      await cmdTierClassify(source, rest.slice(1), flags);
      return;
    }
    console.log('Usage: qa-sdk def tier classify');
  },
  'find-by-file': (source, rest) => cmdFindByFile(source, rest[0] ?? ''),
  guide: (source, rest) => cmdGuide(source, rest[0]),
  topdown: async (source, rest, flags) => {
    if (!rest[0]) {
      console.log('Usage: qa-sdk def topdown <그룹ID> [--overview] [--with-consumers]');
      return;
    }
    await cmdTopdown(source, rest[0], hasCliFlag(flags, 'overview') ? 'overview' : 'purpose', {
      includeConsumers: hasCliFlag(flags, 'with-consumers'),
    });
  },
  bottomup: async (source, rest) => {
    if (!rest[0]) {
      console.log('Usage: qa-sdk def bottomup <문서ID>');
      return;
    }
    await cmdBottomup(source, rest[0]);
  },
  context: async (source, rest, flags) => {
    if (!rest[0]) {
      console.log('Usage: qa-sdk def context <문서ID>');
      return;
    }
    await cmdContext(source, rest[0], flags, { buildDomainRootRegistry });
  },
  boundary: async (source, rest, flags) => {
    if (!rest[0] && !flags.address) {
      console.log(
        'Usage: qa-sdk def boundary <문서ID> [--address=<ADDR>] [--level purpose|overview] [--json]',
      );
      return;
    }
    await cmdBoundary(source, rest[0], flags);
  },
  'boundary-context': async (source, rest, flags) => {
    if (!rest[0] && !flags.address) {
      console.log(
        'Usage: qa-sdk def boundary-context <문서ID> [--address=<ADDR>] [--level purpose|overview] [--mode direct|transitive] [--json]',
      );
      return;
    }
    await cmdBoundaryContext(source, rest[0], flags);
  },
};

// ── 라우터 ────────────────────────────────────────────

export async function cliDef(args: string[]): Promise<void> {
  const { positional, flags, sourceMode } = parseCliArgs(args);
  const options = toDataSourceOptions(flags, sourceMode);
  const sub = positional[0];
  const rest = positional.slice(1);

  if (!sub || sub === 'help') {
    printDefHelp();
    return;
  }

  if (sub === 'scan') return cmdSync(flags); // scan = sync alias (하위호환)
  if (sub === 'scan-audit') return cmdScanAudit(flags);
  if (sub === 'sync') return cmdSync(flags);
  if (sub === 'code-link-gaps') return cmdCodeLinkGaps(flags);
  if (sub === 'platform-verify') return cmdPlatformVerify(getRootDir(), flags);
  if (sub === 'doctor') {
    return cmdDoctor(flags, options, { root: getRootDir(), createSource: getSource });
  }
  if (sub === 'link-rules') return cmdLinkRules();
  if (sub === 'verification-bindings') {
    return cmdVerificationBindings(getRootDir(), flags, options, getSource);
  }
  if (sub === 'verification-artifact') return cmdVerificationArtifact(getRootDir(), flags);
  if (sub === 'state') {
    return cmdState(rest, flags, options, {
      root: getRootDir(),
      scan: () => scan(),
      createSource: getSource,
      closeSource: closeDataSource,
    });
  }
  if (sub === 'handoff') return cmdHandoff(rest, flags);
  if (sub === 'handoff-aggregate') return cmdHandoffAggregate(rest, flags);

  const dataSourceCommand = DATA_SOURCE_COMMANDS[sub];
  if (dataSourceCommand) {
    let source: DefDataSource;
    try {
      source = await getSource(options);
    } catch (error) {
      console.log((error as Error).message);
      return;
    }

    try {
      await dataSourceCommand(source, rest, flags);
    } finally {
      closeDataSource(source);
    }
    return;
  }

  printDefHelp();
}
