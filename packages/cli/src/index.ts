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

import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import {
  dkgReport,
  dkgAxes,
  dkgPrefixes,
  dkgDomains,
  dkgOverlaps,
  dkgHistory,
  dkgAuditEvents,
  dkgExport,
  dkgImport,
  dkgRefresh,
  dkgSkew,
  dkgCoverage,
  dkgSkills,
  dkgTransitions,
  dkgTransitionAnalysis,
  dkgAudit,
  dkgService,
  dkgPrefix,
  dkgDsl,
  dkgOverview,
  dkgTables,
  dkgTable,
  dkgFlowSchemas,
  dkgFlowSchema,
  dkgTrace,
  dkgDecide,
  dkgObserve,
  dkgClaim,
  dkgRelease,
  dkgResolve,
  dkgLink,
  dkgTimeline,
  dkgClaims,
  dkgRun,
  dkgMetrics,
  dkgConverge,
  dkgSelfCheck,
  dkgDecisionsExport,
  dkgDecisionsImport,
  dkgDecisionsList,
  dkgObservations,
  dkgDecisions,
  dkgConstraints,
  dkgPromoteScan,
  dkgScanTables,
  dkgPublish,
  dkgVersion,
  dkgAddEntry,
  dkgReset,
  dkgSpecAdd,
  dkgSpecList,
  dkgSpecTransition,
  emitCliEvent,
  dkgPatterns,
  dkgPatternStats,
  dkgDiscoverLinks,
  setCatalogContext,
  getCatalogRegistry,
  getDkgGraph,
} from './commands/dkg.js';
import { loadCatalog } from 'config-loader';
import type { Catalog } from '@qa-sdk/core';
import {
  cliImpact,
} from './commands/dx.js';
import { obsRead, obsSearch, obsAppend, obsBacklinks, obsList, obsStats } from './commands/obs.js';
import { cliDef } from './commands/def.js';
import { cliQuality } from './commands/quality.js';
import {
  descriptorsToTree,
  executeCommand,
  generateHelp,
  resolveCliTreeCommand,
  formatUsageLines,
  formatUsageSpecs,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandContext,
  type CommandUsageSpec,
  type CommandDetailSpec,
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

// ── Usage ────────────────────────────────────────────

type TreeDispatch = (handlerKey: string, rest: string[]) => Promise<void>;

interface TreeCommandGroup {
  readonly rootSegments: readonly string[];
  readonly rootName: string;
  readonly tree: readonly CliCommandNode[];
  readonly dispatch: TreeDispatch;
}

const OBS_COMMAND_SPECS = [
  { name: 'read', usage: 'qa-sdk obs read <path> [--vault <name>]             Obsidian 노트 읽기' },
  { name: 'search', usage: 'qa-sdk obs search <query> [--vault <name>]          Obsidian 검색' },
  { name: 'append', usage: 'qa-sdk obs append <path> <content> [--vault <name>] Obsidian 노트에 내용 추가' },
  { name: 'backlinks', usage: 'qa-sdk obs backlinks <name> [--vault <name>]        Obsidian 백링크 조회' },
  { name: 'list', usage: 'qa-sdk obs list [prefix] [--vault <name>]' },
  { name: 'stats', usage: 'qa-sdk obs stats [--vault <name>]' },
] as const satisfies readonly CommandUsageSpec<string>[];

const OBS_COMMAND_DESCRIPTORS = [
  { id: 'obs.read', path: ['read'], usage: 'qa-sdk obs read <path> [--vault <name>]             Obsidian 노트 읽기', handlerKey: 'obs.read' },
  { id: 'obs.search', path: ['search'], usage: 'qa-sdk obs search <query> [--vault <name>]          Obsidian 검색', handlerKey: 'obs.search' },
  { id: 'obs.append', path: ['append'], usage: 'qa-sdk obs append <path> <content> [--vault <name>] Obsidian 노트에 내용 추가', handlerKey: 'obs.append' },
  { id: 'obs.backlinks', path: ['backlinks'], usage: 'qa-sdk obs backlinks <name> [--vault <name>]        Obsidian 백링크 조회', handlerKey: 'obs.backlinks' },
  { id: 'obs.list', path: ['list'], usage: 'qa-sdk obs list [prefix] [--vault <name>]', handlerKey: 'obs.list' },
  { id: 'obs.stats', path: ['stats'], usage: 'qa-sdk obs stats [--vault <name>]', handlerKey: 'obs.stats' },
] as const satisfies readonly CommandDescriptor[];

const OBS_COMMAND_TREE = descriptorsToTree(OBS_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

const DEF_TOP_LEVEL_USAGE_LINES = [
  'qa-sdk def sync [--db path]        docs → local definition SQLite 동기화',
] as const;

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
${formatUsageLines(DEF_TOP_LEVEL_USAGE_LINES)}
${formatUsageLines(OBS_COMMAND_SPECS.map((item) => item.usage))}
`.trim();


const DEF_COMMAND_DESCRIPTORS = [
  { id: 'def.scan-audit', path: ['scan-audit'], handlerKey: 'def.scan-audit' },
  { id: 'def.topdown', path: ['topdown'], handlerKey: 'def.topdown' },
  { id: 'def.bottomup', path: ['bottomup'], handlerKey: 'def.bottomup' },
  { id: 'def.context', path: ['context'], handlerKey: 'def.context' },
  { id: 'def.boundary', path: ['boundary'], handlerKey: 'def.boundary' },
  { id: 'def.boundary-context', path: ['boundary-context'], handlerKey: 'def.boundary-context' },
  { id: 'def.audit', path: ['audit'], handlerKey: 'def.audit' },
  { id: 'def.validate', path: ['validate'], handlerKey: 'def.validate' },
  { id: 'def.stats', path: ['stats'], handlerKey: 'def.stats' },
  { id: 'def.sync', path: ['sync'], handlerKey: 'def.sync' },
  { id: 'def.read', path: ['read'], handlerKey: 'def.read' },
  { id: 'def.list', path: ['list'], handlerKey: 'def.list' },
  { id: 'def.get', path: ['get'], handlerKey: 'def.get' },
  { id: 'def.body', path: ['body'], handlerKey: 'def.body' },
  { id: 'def.children', path: ['children'], handlerKey: 'def.children' },
  { id: 'def.parent', path: ['parent'], handlerKey: 'def.parent' },
  { id: 'def.incoming', path: ['incoming'], handlerKey: 'def.incoming' },
  { id: 'def.outgoing', path: ['outgoing'], handlerKey: 'def.outgoing' },
  { id: 'def.search', path: ['search'], handlerKey: 'def.search' },
  { id: 'def.concepts', path: ['concepts'], handlerKey: 'def.concepts' },
  { id: 'def.impact', path: ['impact'], handlerKey: 'def.impact' },
  { id: 'def.check', path: ['check'], handlerKey: 'def.check' },
  { id: 'def.audit-db', path: ['audit-db'], handlerKey: 'def.audit-db' },
  { id: 'def.overview', path: ['overview'], handlerKey: 'def.overview' },
  { id: 'def.link-rules', path: ['link-rules'], handlerKey: 'def.link-rules' },
  { id: 'def.find-by-file', path: ['find-by-file'], handlerKey: 'def.find-by-file' },
  { id: 'def.guide', path: ['guide'], handlerKey: 'def.guide' },
  { id: 'def.state', path: ['state'], handlerKey: 'def.state' },
] as const satisfies readonly CommandDescriptor[];

const DEF_COMMAND_TREE = descriptorsToTree(DEF_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

async function dispatchDefCommand(handlerKey: string, rest: string[]): Promise<void> {
  const subcommand = handlerKey.slice(4);
  await cliDef([subcommand, ...rest]);
}

async function dispatchDkgCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(DKG_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

const DKG_GROUP_HANDLER_REGISTRY: Record<string, RestCommandHandler> = {
  "dkg.report": () => dkgReport(),
  "dkg.refresh": () => dkgRefresh(),
  "dkg.axes": (rest) => {
    const groupIdx = rest.indexOf('--group-by');
    const groupBy = groupIdx >= 0 ? rest[groupIdx + 1] : undefined;
    dkgAxes({ ...parsePage(rest), groupBy });
  },
  "dkg.prefixes": (rest) => dkgPrefixes(parsePage(rest)),
  "dkg.domains": (rest) => dkgDomains(parsePage(rest)),
  "dkg.flow-schemas": (rest) => dkgFlowSchemas(parsePage(rest)),
  "dkg.flow-schema": (rest) => {
    if (rest[0]) dkgFlowSchema(rest[0]);
    else console.error('Usage: qa-sdk dkg flow-schema <id>');
  },
  "dkg.impact": (rest) => {
    if (!rest[0]) { console.error('Usage: qa-sdk dkg impact <axisId|prefixId> [--prefix]'); return; }
    if (!loadedCatalog) { console.error('카탈로그 로딩 실패'); return; }
    const isPrefix = rest.includes('--prefix');
    const target = rest.filter(a => a !== '--prefix')[0];
    cliImpact(loadedCatalog, getDkgGraph(), isPrefix ? { prefix: target } : { axis: target });
  },
  "dkg.overlaps": () => dkgOverlaps(),
  "dkg.history": (rest) => dkgHistory({ limit: parseInt(rest[rest.indexOf('--limit') + 1]) || 10 }),
  "dkg.audit-events": (rest) => {
    const limit = parseInt(rest[rest.indexOf('--limit') + 1]) || 30;
    const prefixIdx = rest.indexOf('--prefix');
    const commandIdx = rest.indexOf('--command');
    const targetIdx = rest.indexOf('--target');
    const lifecycleIdx = rest.indexOf('--lifecycle');
    dkgAuditEvents({
      limit,
      prefix: prefixIdx >= 0 ? rest[prefixIdx + 1] : undefined,
      command: commandIdx >= 0 ? rest[commandIdx + 1] : undefined,
      targetId: targetIdx >= 0 ? rest[targetIdx + 1] : undefined,
      lifecycleTo: lifecycleIdx >= 0 ? rest[lifecycleIdx + 1] : undefined,
      json: rest.includes('--json'),
    });
  },
  "dkg.skew": () => dkgSkew(),
  "dkg.coverage": () => dkgCoverage(),
  "dkg.skills": (rest) => dkgSkills(rest[0]),
  "dkg.audit": () => dkgAudit(),
  "dkg.transitions": (rest) => dkgTransitions(rest[0]),
  "dkg.transition": (rest) => {
    const arg = rest[0];
    if (arg === 'coverage' || arg === 'orphans' || arg === 'violations') {
      dkgTransitionAnalysis(arg);
    } else {
      dkgTransitions(arg);
    }
  },
  "dkg.export": (rest) => dkgExport({ output: rest[rest.indexOf('--output') + 1] }),
  "dkg.import": (rest) => {
    if (rest[0]) dkgImport({ input: rest[0] });
    else console.error('Usage: qa-sdk dkg import <path>');
  },
  "dkg.decisions.export": (rest) => dkgDecisionsExport({ output: rest[rest.indexOf('--output') + 1] }),
  "dkg.decisions.import": (rest) => {
    if (rest[0]) dkgDecisionsImport({ input: rest[0] });
    else console.error('Usage: qa-sdk dkg decisions import <path>');
  },
  "dkg.decisions.list": (rest) => {
    const dlLimit = rest.indexOf('--limit');
    const dlKind = rest.indexOf('--kind');
    dkgDecisionsList({
      limit: dlLimit >= 0 ? parseInt(rest[dlLimit + 1]) : undefined,
      kind: dlKind >= 0 ? rest[dlKind + 1] : undefined,
    });
  },
  "dkg.transition.coverage": () => dkgTransitionAnalysis('coverage'),
  "dkg.transition.orphans": () => dkgTransitionAnalysis('orphans'),
  "dkg.transition.violations": () => dkgTransitionAnalysis('violations'),
  "dkg.observations": (rest) => dkgObservations(parsePage(rest)),
  "dkg.decisions": (rest) => dkgDecisions(parsePage(rest)),
  "dkg.constraints": (rest) => dkgConstraints(parsePage(rest)),
  "dkg.service": (rest) => dkgService(rest[0]),
  "dkg.prefix": (rest) => {
    if (rest[0]) dkgPrefix(rest[0]);
    else console.error('Usage: qa-sdk dkg prefix <id>');
  },
  "dkg.dsl": (rest) => dkgDsl(rest[0]),
  "dkg.tables": () => dkgTables(),
  "dkg.table": (rest) => {
    if (rest[0]) dkgTable(rest[0]);
    else console.error('Usage: qa-sdk dkg table <id>');
  },
  "dkg.scan-tables": () => dkgScanTables(),
  "dkg.overview": () => dkgOverview(),
  "dkg.claims": () => dkgClaims(),
  "dkg.timeline": (rest) => dkgTimeline({ open: rest.includes('--open') }),
  "dkg.resolve": (rest) => {
    const resObsId = rest[0];
    const resDecIdx = rest.indexOf('--decision');
    const resOutIdx = rest.indexOf('--outcome');
    const resNoteIdx = rest.indexOf('--note');
    if (!resObsId || resDecIdx < 0 || resOutIdx < 0) {
      console.error('Usage: qa-sdk dkg resolve <obsId> --decision <decId> --outcome accepted|deferred|rejected [--note ...]');
      return;
    }
    dkgResolve({
      obsId: resObsId,
      decisionId: rest[resDecIdx + 1],
      outcome: rest[resOutIdx + 1],
      note: resNoteIdx >= 0 ? rest[resNoteIdx + 1] : undefined,
    });
  },
  "dkg.link": (rest) => {
    const linkObsId = rest[0];
    const linkDecIdx = rest.indexOf('--decision');
    if (!linkObsId || linkDecIdx < 0) {
      console.error('Usage: qa-sdk dkg link <obsId> --decision <decId>');
      return;
    }
    dkgLink({ obsId: linkObsId, decisionId: rest[linkDecIdx + 1] });
  },
  "dkg.run": (rest) => {
    const runSkillId = rest[0];
    if (!runSkillId) {
      console.error('Usage: qa-sdk dkg run <skillId> [args...]');
      console.error('  qa-sdk dkg skills 로 목록 확인');
      return;
    }
    dkgRun(runSkillId, rest.slice(1));
  },
  "dkg.metrics": () => dkgMetrics(),
  "dkg.converge": (rest) => dkgConverge({
    persist: rest.includes('--persist'),
    verbose: rest.includes('--verbose'),
  }),
  "dkg.spec.add": (rest) => {
    const saId = rest[rest.indexOf('--id') + 1];
    const saType = rest[rest.indexOf('--type') + 1];
    const saTitle = rest[rest.indexOf('--title') + 1];
    const saRatIdx = rest.indexOf('--rationale');
    const saGovIdx = rest.indexOf('--governs');
    if (!saId || !saType || !saTitle) {
      console.error('Usage: qa-sdk dkg spec add --id <id> --type <type> --title "..." [--rationale "..."] [--governs <id,...>]');
      return;
    }
    dkgSpecAdd({
      id: saId,
      type: saType,
      title: saTitle,
      rationale: saRatIdx >= 0 ? rest[saRatIdx + 1] : undefined,
      governs: saGovIdx >= 0 ? rest[saGovIdx + 1].split(',') : undefined,
    });
  },
  "dkg.spec.list": () => dkgSpecList(),
  "dkg.spec.transition": (rest) => {
    const stSpecId = rest[0];
    const stLifecycle = rest[1];
    if (!stSpecId || !stLifecycle) {
      console.error('Usage: qa-sdk dkg spec transition <specId> <draft|active|deprecated>');
      return;
    }
    dkgSpecTransition(stSpecId, stLifecycle);
  },
  "dkg.reset": (rest) => {
    const resetTarget = rest[0] ?? 'all';
    dkgReset(resetTarget, { confirm: rest.includes('--confirm') });
  },
  "dkg.promote": () => dkgPromoteScan(),
  "dkg.add-entry": (rest) => {
    const aeAxisId = rest[0];
    const aeEntry = rest[1];
    if (!aeAxisId || !aeEntry) {
      console.error('Usage: qa-sdk dkg add-entry <axis> <entry> [--apply] [--expand-capacity] [--write-file <path>]');
      return;
    }
    const aeWriteIdx = rest.indexOf('--write-file');
    dkgAddEntry({
      axisId: aeAxisId,
      entry: aeEntry,
      apply: rest.includes('--apply'),
      expandCapacity: rest.includes('--expand-capacity'),
      writeFile: aeWriteIdx >= 0 ? rest[aeWriteIdx + 1] : undefined,
    });
  },
  "dkg.publish": async (rest) => {
    const pubRegIdx = rest.indexOf('--registry');
    const pubVerIdx = rest.indexOf('--version');
    await dkgPublish({
      registry: pubRegIdx >= 0 ? rest[pubRegIdx + 1] : undefined,
      versionId: pubVerIdx >= 0 ? rest[pubVerIdx + 1] : undefined,
    });
  },
  "dkg.version": async (rest) => {
    const vAction = rest[0] ?? 'list';
    const vPrefix = rest[1] ?? '';
    const vVersionId = rest[2] ?? '';
    const vRegIdx = rest.indexOf('--registry');
    await dkgVersion(vAction, vPrefix, vVersionId, {
      registry: vRegIdx >= 0 ? rest[vRegIdx + 1] : undefined,
    });
  },
  "dkg.self-check": (rest) => dkgSelfCheck({ apply: rest.includes('--apply'), fast: rest.includes('--fast') }),
  "dkg.patterns": () => dkgPatterns(),
  "dkg.pattern-stats": () => dkgPatternStats(),
  "dkg.discover-links": () => dkgDiscoverLinks(),
  "dkg.diagram": async (rest) => {
    const { dkgDiagram } = await import('./commands/dkg.js');
    await dkgDiagram(rest);
  },
  "dkg.trace": (rest) => {
    if (rest[0]) dkgTrace(rest[0]);
    else console.error('Usage: qa-sdk dkg trace <nodeId>');
  },
  "dkg.decide": async (rest) => {
    const targetIdx = rest.indexOf('--target');
    const typeIdx = rest.indexOf('--type');
    const titleIdx = rest.indexOf('--title');
    const rationaleIdx = rest.indexOf('--rationale');
    if (targetIdx < 0 || typeIdx < 0 || titleIdx < 0 || rationaleIdx < 0) {
      console.error('Usage: qa-sdk dkg decide --target <id> --type <type> --title "..." --rationale "..." [--alternatives "alt1|alt2"] [--confidence 0.8] [--spec <specId>] [--force]');
      console.error('  types: capacity, new-axis, new-prefix, dim-add, merge, deprecate');
      return;
    }
    const specIdx = rest.indexOf('--spec');
    const alternativesIdx = rest.indexOf('--alternatives');
    const confidenceIdx = rest.indexOf('--confidence');
    const confidence = confidenceIdx >= 0 ? Number.parseFloat(rest[confidenceIdx + 1] ?? '') : undefined;
    const hasValidConfidence = confidence !== undefined && Number.isFinite(confidence);
    if (confidenceIdx >= 0 && (!hasValidConfidence || confidence < 0 || confidence > 1)) {
      console.error('  --confidence는 0~1 숫자여야 합니다.');
      return;
    }
    if (alternativesIdx >= 0 && !rest[alternativesIdx + 1]) {
      console.error('  --alternatives는 "alt1|alt2" 형식으로 전달하세요.');
      return;
    }
    await dkgDecide({
      target: rest[targetIdx + 1],
      type: rest[typeIdx + 1],
      title: rest[titleIdx + 1],
      rationale: rest[rationaleIdx + 1],
      alternatives:
        alternativesIdx >= 0
          ? rest[alternativesIdx + 1].split('|').map((value) => value.trim()).filter(Boolean)
          : undefined,
      confidence,
      spec: specIdx >= 0 ? rest[specIdx + 1] : undefined,
      force: rest.includes('--force'),
    });
  },
  "dkg.observe": (rest) => {
    const obsTargetIdx = rest.indexOf('--target');
    const findingIdx = rest.indexOf('--finding');
    if (obsTargetIdx < 0 || findingIdx < 0) {
      console.error('Usage: qa-sdk dkg observe --target <id> --finding "..."');
      return;
    }
    const suggIdx = rest.indexOf('--suggestion');
    dkgObserve({
      target: rest[obsTargetIdx + 1],
      finding: rest[findingIdx + 1],
      suggestion: suggIdx >= 0 ? rest[suggIdx + 1] : undefined,
    });
  },
  "dkg.claim": (rest) => {
    const claimTarget = rest[0];
    const byIdx = rest.indexOf('--by');
    if (!claimTarget || byIdx < 0) {
      console.error('Usage: qa-sdk dkg claim <id> --by <worker> [--reason "..."]');
      return;
    }
    const reasonIdx = rest.indexOf('--reason');
    dkgClaim({
      target: claimTarget,
      by: rest[byIdx + 1],
      reason: reasonIdx >= 0 ? rest[reasonIdx + 1] : undefined,
    });
  },
  "dkg.release": (rest) => {
    if (rest[0]) dkgRelease(rest[0]);
    else console.error('Usage: qa-sdk dkg release <id>');
  },
};

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

async function dispatchServiceCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(SERVICE_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchQualityCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(QUALITY_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchReviewCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(REVIEW_GROUP_HANDLER_REGISTRY, handlerKey, rest);
}

const INGEST_HANDLER_REGISTRY = INGEST_GROUP_HANDLER_REGISTRY;

async function dispatchIngestCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(INGEST_HANDLER_REGISTRY, handlerKey, rest);
}

async function dispatchObsCommand(handlerKey: string, rest: string[]): Promise<void> {
  const vaultIdx = rest.indexOf('--vault');
  const vault = vaultIdx >= 0 ? rest[vaultIdx + 1] : undefined;

  switch (handlerKey) {
    case 'obs.read':
      if (rest[0]) obsRead(rest[0], vault);
      else console.error('Usage: qa-sdk obs read <path>');
      return;
    case 'obs.search':
      if (rest[0]) obsSearch(rest[0], vault);
      else console.error('Usage: qa-sdk obs search <query>');
      return;
    case 'obs.append': {
      const appendPath = rest[0];
      const contentIdx = rest.indexOf('--content');
      if (!appendPath || contentIdx < 0) {
        console.error('Usage: qa-sdk obs append <path> --content "..."');
        return;
      }
      obsAppend(appendPath, rest[contentIdx + 1], vault);
      return;
    }
    case 'obs.backlinks':
      if (rest[0]) obsBacklinks(rest[0], vault);
      else console.error('Usage: qa-sdk obs backlinks <name>');
      return;
    case 'obs.list':
      obsList(rest[0] ?? '', vault);
      return;
    case 'obs.stats':
      obsStats(vault);
      return;
  }
}

const GATE_HANDLER_REGISTRY = GATE_GROUP_HANDLER_REGISTRY;

async function dispatchGateCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(GATE_HANDLER_REGISTRY, handlerKey, rest);
}

const QUERY_HANDLER_REGISTRY = QUERY_GROUP_HANDLER_REGISTRY;

async function dispatchQueryCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(QUERY_HANDLER_REGISTRY, handlerKey, rest);
}

const SPEC_HANDLER_REGISTRY = SPEC_GROUP_HANDLER_REGISTRY;

async function dispatchSpecCommand(handlerKey: string, rest: string[]): Promise<void> {
  await dispatchFromRegistry(SPEC_HANDLER_REGISTRY, handlerKey, rest);
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
  { rootSegments: ['def'], rootName: 'qa-sdk def', tree: DEF_COMMAND_TREE, dispatch: dispatchDefCommand },
  { rootSegments: ['service'], rootName: 'qa-sdk service', tree: SERVICE_GROUP_COMMAND_TREE, dispatch: dispatchServiceCommand },
  { rootSegments: ['dkg'], rootName: 'qa-sdk dkg', tree: DKG_GROUP_COMMAND_TREE, dispatch: dispatchDkgCommand },
  { rootSegments: ['quality'], rootName: 'qa-sdk quality', tree: QUALITY_GROUP_COMMAND_TREE, dispatch: dispatchQualityCommand },
  { rootSegments: ['review'], rootName: 'qa-sdk review', tree: REVIEW_GROUP_COMMAND_TREE, dispatch: dispatchReviewCommand },
  { rootSegments: ['ingest'], rootName: 'qa-sdk ingest', tree: INGEST_GROUP_COMMAND_TREE, dispatch: dispatchIngestCommand },
  { rootSegments: ['obs'], rootName: 'qa-sdk obs', tree: OBS_COMMAND_TREE, dispatch: dispatchObsCommand },
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

  switch (sub.name) {
    case 'spec drift': {
      const { cliSpecDrift } = await import('./commands/spec-drift.js');
      return cliSpecDrift(sub.rest);
    }

    // Definition Catalog 명령어
    case 'def help':
      await cliDef(['help', ...sub.rest]);
      return;
    case 'def':
      await cliDef(sub.rest);
      return;

    // Quality Gate 명령어
    case 'quality':
      await cliQuality(sub.rest);
      return;

    default:
      console.error(`알 수 없는 명령: ${sub.name}`);
      console.log(USAGE);
      process.exit(1);
  }
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

  // 2단어 fallback: tree 미전환 command group + legacy direct commands
  const twoWord = [
    'spec drift',
  ];
  if (args.length >= 2) {
    const candidate = `${args[0]} ${args[1]}`;
    if (twoWord.includes(candidate)) {
      return { name: candidate, rest: args.slice(2) };
    }
  }
  // 1단어 커맨드
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

function parsePage(argv: string[]): { page?: number; limit?: number } {
  const pageIdx = argv.indexOf('--page');
  const limitIdx = argv.indexOf('--limit');
  return {
    page: pageIdx >= 0 ? parseInt(argv[pageIdx + 1]) : undefined,
    limit: limitIdx >= 0 ? parseInt(argv[limitIdx + 1]) : undefined,
  };
}

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
