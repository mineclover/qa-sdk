// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import type { Catalog } from "@qa-sdk/core";
import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
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
  dkgPatterns,
  dkgPatternStats,
  dkgDiscoverLinks,
  getDkgGraph,
} from '../commands/dkg.js';
import { cliImpact } from "../commands/dx.js";

export const DKG_COMMAND_DESCRIPTORS = [
  { id: "dkg.report", path: ["report"], usage: "qa-sdk dkg report                  전체 현황 + SQLite 상태", handlerKey: "dkg.report" },
  { id: "dkg.refresh", path: ["refresh"], usage: "qa-sdk dkg refresh                 bootstrap 재실행", handlerKey: "dkg.refresh" },
  { id: "dkg.axes", path: ["axes"], usage: "qa-sdk dkg axes [--page N] [--group-by prefix|domain]  축 목록", handlerKey: "dkg.axes" },
  { id: "dkg.prefixes", path: ["prefixes"], usage: "qa-sdk dkg prefixes [--page N]     prefix 목록", handlerKey: "dkg.prefixes" },
  { id: "dkg.domains", path: ["domains"], usage: "qa-sdk dkg domains                 도메인 목록", handlerKey: "dkg.domains" },
  { id: "dkg.flow-schemas", path: ["flow-schemas"], usage: "qa-sdk dkg flow-schemas [--page N] FlowSchemaNode 목록", handlerKey: "dkg.flow-schemas" },
  { id: "dkg.flow-schema", path: ["flow-schema"], usage: "qa-sdk dkg flow-schema <id>        FlowSchema 프로파일", handlerKey: "dkg.flow-schema" },
  { id: "dkg.impact", path: ["impact"], usage: "qa-sdk dkg impact <axis>           영향 분석", handlerKey: "dkg.impact" },
  { id: "dkg.overlaps", path: ["overlaps"], usage: "qa-sdk dkg overlaps                축 중복 스캔", handlerKey: "dkg.overlaps" },
  { id: "dkg.history", path: ["history"], usage: "qa-sdk dkg history [--limit N]     스냅샷 히스토리", handlerKey: "dkg.history" },
  { id: "dkg.audit-events", path: ["audit-events"], usage: "qa-sdk dkg audit-events [--limit N] [--prefix P] [--command C] [--target ID] [--lifecycle L]", handlerKey: "dkg.audit-events" },
  { id: "dkg.skew", path: ["skew"], usage: "qa-sdk dkg skew                    배포 스큐 상세", handlerKey: "dkg.skew" },
  { id: "dkg.coverage", path: ["coverage"], usage: "qa-sdk dkg coverage                entry 커버리지", handlerKey: "dkg.coverage" },
  { id: "dkg.skills", path: ["skills"], usage: "qa-sdk dkg skills                  skill 목록", handlerKey: "dkg.skills" },
  { id: "dkg.service", path: ["service"], usage: "qa-sdk dkg service [id]            서비스 탐색 (id 없으면 목록)", handlerKey: "dkg.service" },
  { id: "dkg.prefix", path: ["prefix"], usage: "qa-sdk dkg prefix <id>             prefix 심층 탐색", handlerKey: "dkg.prefix" },
  { id: "dkg.dsl", path: ["dsl"], usage: "qa-sdk dkg dsl [id]                DSL 번들 탐색 (id 없으면 목록)", handlerKey: "dkg.dsl" },
  { id: "dkg.overview", path: ["overview"], usage: "qa-sdk dkg overview                시스템 대시보드", handlerKey: "dkg.overview" },
  { id: "dkg.trace", path: ["trace"], usage: "qa-sdk dkg trace <id>              노드 역추적 (전체 인과 체인)", handlerKey: "dkg.trace" },
  { id: "dkg.decide", path: ["decide"], usage: "qa-sdk dkg decide [options]        의사결정 기록", handlerKey: "dkg.decide" },
  { id: "dkg.observe", path: ["observe"], usage: "qa-sdk dkg observe [options]       관측 기록", handlerKey: "dkg.observe" },
  { id: "dkg.claim", path: ["claim"], usage: "qa-sdk dkg claim <id> --by <name>  작업 선점 (전파)", handlerKey: "dkg.claim" },
  { id: "dkg.release", path: ["release"], usage: "qa-sdk dkg release <id>            작업 해제", handlerKey: "dkg.release" },
  { id: "dkg.claims", path: ["claims"], usage: "qa-sdk dkg claims                  활성 claim 목록", handlerKey: "dkg.claims" },
  { id: "dkg.resolve", path: ["resolve"], usage: "qa-sdk dkg resolve <obs> [opts]    관측을 결정으로 해소 (루프 닫기)", handlerKey: "dkg.resolve" },
  { id: "dkg.link", path: ["link"], usage: "qa-sdk dkg link <obs> --decision   관측 → 결정 연결", handlerKey: "dkg.link" },
  { id: "dkg.timeline", path: ["timeline"], usage: "qa-sdk dkg timeline [--open]       시간순 이력", handlerKey: "dkg.timeline" },
  { id: "dkg.metrics", path: ["metrics"], usage: "qa-sdk dkg metrics                 전체 metric 대시보드", handlerKey: "dkg.metrics" },
  { id: "dkg.converge", path: ["converge"], usage: "qa-sdk dkg converge [--persist] [--verbose]  수렴 분석 실행 (metric+converge+health chain)", handlerKey: "dkg.converge" },
  { id: "dkg.promote", path: ["promote"], usage: "qa-sdk dkg promote                 좌표 승격 후보 스캔 (5Q 자동 판정)", handlerKey: "dkg.promote" },
  { id: "dkg.reset", path: ["reset"], usage: "qa-sdk dkg reset <target> [--confirm]  지정 초기화 (bootstrap|operational|snapshots|auto|catalog|all)", handlerKey: "dkg.reset" },
  { id: "dkg.add-entry", path: ["add-entry"], usage: "qa-sdk dkg add-entry <axis> <entry> [--apply]  축 entry 추가 (check→mutate→record)", handlerKey: "dkg.add-entry" },
  { id: "dkg.publish", path: ["publish"], usage: "qa-sdk dkg publish [--registry url] [--version id]  카탈로그 → registry 등록", handlerKey: "dkg.publish" },
  { id: "dkg.version", path: ["version"], usage: "qa-sdk dkg version <action> <prefix> [versionId]    버전 lifecycle (list|lock|release|activate)", handlerKey: "dkg.version" },
  { id: "dkg.self-check", path: ["self-check"], usage: "qa-sdk dkg self-check [--apply]    빌드/테스트 자기 진단 (기본: dry-run)", handlerKey: "dkg.self-check" },
  { id: "dkg.patterns", path: ["patterns"], usage: "qa-sdk dkg patterns                패턴 분류 규칙 목록", handlerKey: "dkg.patterns" },
  { id: "dkg.pattern-stats", path: ["pattern-stats"], usage: "qa-sdk dkg pattern-stats           패턴 통계", handlerKey: "dkg.pattern-stats" },
  { id: "dkg.discover-links", path: ["discover-links"], usage: "qa-sdk dkg discover-links          co-occurrence 기반 IntentLink 후보 발견", handlerKey: "dkg.discover-links" },
  { id: "dkg.run", path: ["run"], usage: "qa-sdk dkg run <skillId> [args]    skill 직접 실행", handlerKey: "dkg.run" },
  { id: "dkg.export", path: ["export"], usage: "qa-sdk dkg export [--output path]  SQLite → JSON (전체)", handlerKey: "dkg.export" },
  { id: "dkg.import", path: ["import"], usage: "qa-sdk dkg import <input>          JSON → SQLite (전체)", handlerKey: "dkg.import" },
  { id: "dkg.tables", path: ["tables"], usage: "qa-sdk dkg tables                   테이블 목록", handlerKey: "dkg.tables" },
  { id: "dkg.table", path: ["table"], usage: "qa-sdk dkg table <id>               테이블 상세 (컬럼 + FK + prefix 참조)", handlerKey: "dkg.table" },
  { id: "dkg.transitions", path: ["transitions"], usage: "qa-sdk dkg transitions [specId]     전이 spec 목록 (effect별 + 축 사용 빈도)", handlerKey: "dkg.transitions" },
  { id: "dkg.transition", path: ["transition"], usage: "qa-sdk dkg transition <name>        전이 spec 상세 (축 역할 + 상태 의존성)", handlerKey: "dkg.transition" },
  { id: "dkg.transition.coverage", path: ["transition", "coverage"], usage: "qa-sdk dkg transition coverage      전이 커버리지 분석", handlerKey: "dkg.transition.coverage" },
  { id: "dkg.transition.orphans", path: ["transition", "orphans"], usage: "qa-sdk dkg transition orphans       전이 미관찰 prefix 분석", handlerKey: "dkg.transition.orphans" },
  { id: "dkg.transition.violations", path: ["transition", "violations"], usage: "qa-sdk dkg transition violations    전이 위반 통계", handlerKey: "dkg.transition.violations" },
  { id: "dkg.audit", path: ["audit"], usage: "qa-sdk dkg audit                    DKG 감사 (observation/decision/constraint 상태)", handlerKey: "dkg.audit" },
  { id: "dkg.diagram", path: ["diagram"], usage: "qa-sdk dkg diagram <kind> [id] [--output] [--format]  다이어그램 생성 (mmd|html|svg|png)", handlerKey: "dkg.diagram" },
  { id: "dkg.observations", path: ["observations"], usage: "qa-sdk dkg observations", handlerKey: "dkg.observations" },
  { id: "dkg.decisions", path: ["decisions"], usage: "qa-sdk dkg decisions", handlerKey: "dkg.decisions" },
  { id: "dkg.decisions.export", path: ["decisions", "export"], usage: "qa-sdk dkg decisions export [--output path]  의사결정만 백업", handlerKey: "dkg.decisions.export" },
  { id: "dkg.decisions.import", path: ["decisions", "import"], usage: "qa-sdk dkg decisions import <input>          의사결정 복원 (머지)", handlerKey: "dkg.decisions.import" },
  { id: "dkg.decisions.list", path: ["decisions", "list"], usage: "qa-sdk dkg decisions list [--limit N]        최근 의사결정 조회", handlerKey: "dkg.decisions.list" },
  { id: "dkg.constraints", path: ["constraints"], usage: "qa-sdk dkg constraints", handlerKey: "dkg.constraints" },
  { id: "dkg.scan-tables", path: ["scan-tables"], usage: "qa-sdk dkg scan-tables", handlerKey: "dkg.scan-tables" },
  { id: "dkg.spec.add", path: ["spec", "add"], usage: "qa-sdk dkg spec add --id <id> --type <type> --title \"...\" [--rationale \"...\"] [--governs <id,...>]", handlerKey: "dkg.spec.add" },
  { id: "dkg.spec.list", path: ["spec", "list"], usage: "qa-sdk dkg spec list", handlerKey: "dkg.spec.list" },
  { id: "dkg.spec.transition", path: ["spec", "transition"], usage: "qa-sdk dkg spec transition <specId> <draft|active|deprecated>", handlerKey: "dkg.spec.transition" }
] as const satisfies readonly CommandDescriptor[];

export const DKG_COMMAND_TREE =
  descriptorsToTree(DKG_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const DKG_COMMAND_SPECS =
  collectCommandUsageSpecs(["dkg"], DKG_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export function createDkgHandlerRegistry(
  loadedCatalog?: Catalog,
): Readonly<Record<string, RestCommandHandler>> {
  return {
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
      const { dkgDiagram } = await import('../commands/dkg.js');
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
}

function parsePage(argv: string[]): { page?: number; limit?: number } {
  const pageIdx = argv.indexOf('--page');
  const limitIdx = argv.indexOf('--limit');
  return {
    page: pageIdx >= 0 ? parseInt(argv[pageIdx + 1]) : undefined,
    limit: limitIdx >= 0 ? parseInt(argv[limitIdx + 1]) : undefined,
  };
}
