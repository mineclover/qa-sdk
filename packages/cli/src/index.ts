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

import { parseArgs } from "node:util";
import { gitScan } from "./commands/git-scan.js";
import { register } from "./commands/register.js";
import {
  dkgReport, dkgAxes, dkgPrefixes, dkgDomains, dkgImpact, dkgOverlaps,
  dkgHistory, dkgExport, dkgImport, dkgRefresh, dkgSkew, dkgCoverage, dkgSkills, dkgTransitions, dkgTransitionAnalysis, dkgAudit,
  dkgService, dkgPrefix, dkgDsl, dkgOverview, dkgTables, dkgTable,
  dkgTrace, dkgDecide, dkgObserve, dkgClaim, dkgRelease,
  dkgResolve, dkgLink, dkgTimeline, dkgClaims, dkgRun, dkgMetrics, dkgConverge, dkgSelfCheck,
  dkgDecisionsExport, dkgDecisionsImport, dkgDecisionsList,
  dkgPromoteScan, dkgScanTables,
  dkgPublish, dkgVersion,
  dkgAddEntry, dkgReset,
  dkgSpecAdd, dkgSpecList, dkgSpecTransition,
  emitCliEvent,
  dkgPatterns, dkgPatternStats,
  dkgDiscoverLinks,
  setCatalogContext, getCatalogRegistry,
} from "./commands/dkg.js";
import { loadCatalog } from "./catalog-loader.js";
import type { Catalog } from "@qa-sdk/core";
import {
  cliEncode, cliDecode, cliResolve, cliFindVersion, cliDeriveRefs,
  cliImpact, cliListPrefixes, cliListAxes,
} from "./commands/dx.js";
import { obsRead, obsSearch, obsAppend, obsBacklinks, obsList, obsStats } from "./commands/obs.js";
import { dryRun, type ChangeScenario } from "./commands/dry-run.js";
import { schemaPull } from "./commands/schema-pull.js";
import { codegen, runMigrationTest, type CodegenFormat } from "./commands/codegen.js";
import { specList, specResolve, specValidate, specTrace, specDecode, specCodegen } from "./commands/spec.js";
import { init } from "./commands/init.js";
import { syncObsidian } from "./commands/sync-obsidian.js";

// ── Usage ────────────────────────────────────────────

const USAGE = `
qa-sdk — DSL 접근 도구

Global Options:
  --catalog <path>       카탈로그 파일 (.ts/.js/.json). 기본: qa-sdk.config.ts 또는 DEMO_CATALOG

Usage:
  qa-sdk init [options]            새 카탈로그 프로젝트 스캐폴딩
  qa-sdk scan git [options]          Git 메타데이터 수집 → SchemaSnapshot
  qa-sdk register [options]          SchemaSnapshot → Registry 등록
  qa-sdk dry-run [options]           변경 시뮬레이션 (DAG 전파, 변경 없음)
  qa-sdk codegen [options]           SchemaSnapshot → 타입 인터페이스 생성
  qa-sdk inspect [options]           Registry 상태 조회
  qa-sdk spec list [options]         Prefix spec 목록 + schema + spec docs
  qa-sdk spec resolve <prefix> ...   Export title 생성
  qa-sdk spec validate <schema> ...  스키마 검증
  qa-sdk spec trace <specId>         추적성 경로 조회
  qa-sdk spec decode <addr>          주소 → 제목 변환 (decode→entries→export)
  qa-sdk spec codegen [options]      코드 생성 (ts|esm|cjs|proto|json-schema)

  qa-sdk encode <prefix> [--dim val] 문자열 → 주소 인코딩
  qa-sdk decode <addr>               주소 → 문자열 디코딩
  qa-sdk resolve <addr>              자동 마이그레이션
  qa-sdk find-version <axis> <entry> 문자열이 있는 버전 찾기
  qa-sdk list-prefixes [--json]      prefix 목록
  qa-sdk list-axes [--json]          축 목록
  qa-sdk derive-refs [--check]       refEntries 정합성
  qa-sdk impact --axis <id>          영향 분석

  qa-sdk dkg report                  전체 현황 + SQLite 상태
  qa-sdk dkg refresh                 bootstrap 재실행
  qa-sdk dkg axes [--page N]         축 목록
  qa-sdk dkg prefixes [--page N]     prefix 목록
  qa-sdk dkg domains                 도메인 목록
  qa-sdk dkg impact <axis>           영향 분석
  qa-sdk dkg overlaps                축 중복 스캔
  qa-sdk dkg history [--limit N]     스냅샷 히스토리
  qa-sdk dkg skew                    배포 스큐 상세
  qa-sdk dkg coverage                entry 커버리지
  qa-sdk dkg skills                  skill 목록
  qa-sdk dkg service [id]            서비스 탐색 (id 없으면 목록)
  qa-sdk dkg prefix <id>             prefix 심층 탐색
  qa-sdk dkg dsl [id]                DSL 번들 탐색 (id 없으면 목록)
  qa-sdk dkg overview                시스템 대시보드
  qa-sdk dkg trace <id>              노드 역추적 (전체 인과 체인)
  qa-sdk dkg decide [options]        의사결정 기록
  qa-sdk dkg observe [options]       관측 기록
  qa-sdk dkg claim <id> --by <name>  작업 선점 (전파)
  qa-sdk dkg release <id>            작업 해제
  qa-sdk dkg claims                  활성 claim 목록
  qa-sdk dkg resolve <obs> [opts]    관측을 결정으로 해소 (루프 닫기)
  qa-sdk dkg link <obs> --decision   관측 → 결정 연결
  qa-sdk dkg timeline [--open]       시간순 이력
  qa-sdk dkg metrics                 전체 metric 대시보드
  qa-sdk dkg converge [--persist] [--verbose]  수렴 분석 실행 (metric+converge+health chain)
  qa-sdk dkg promote                 좌표 승격 후보 스캔 (5Q 자동 판정)
  qa-sdk dkg reset <target> [--confirm]  지정 초기화 (bootstrap|operational|snapshots|auto|catalog|all)
  qa-sdk dkg add-entry <axis> <entry> [--apply]  축 entry 추가 (check→mutate→record)
  qa-sdk dkg publish [--registry url] [--version id]  카탈로그 → registry 등록
  qa-sdk dkg version <action> <prefix> [versionId]    버전 lifecycle (list|lock|release|activate)
  qa-sdk dkg self-check [--apply]    빌드/테스트 자기 진단 (기본: dry-run)
  qa-sdk dkg patterns                패턴 분류 규칙 목록
  qa-sdk dkg pattern-stats           패턴 통계
  qa-sdk dkg discover-links          co-occurrence 기반 IntentLink 후보 발견
  qa-sdk dkg run <skillId> [args]    skill 직접 실행
  qa-sdk dkg export [--output path]  SQLite → JSON (전체)
  qa-sdk dkg import <input>          JSON → SQLite (전체)
  qa-sdk dkg tables                   테이블 목록
  qa-sdk dkg table <id>               테이블 상세 (컬럼 + FK + prefix 참조)
  qa-sdk dkg transitions [specId]     전이 spec 목록 (effect별 + 축 사용 빈도)
  qa-sdk dkg transition <name>        전이 spec 상세 (축 역할 + 상태 의존성)
  qa-sdk dkg transition coverage      전이 커버리지 분석
  qa-sdk dkg transition orphans       전이 미관찰 prefix 분석
  qa-sdk dkg transition violations    전이 위반 통계
  qa-sdk dkg audit                    DKG 감사 (observation/decision/constraint 상태)
  qa-sdk dkg diagram <kind> [id] [--output] [--format]  다이어그램 생성 (mmd|html|svg|png)
  qa-sdk dkg decisions export [--output path]  의사결정만 백업
  qa-sdk dkg decisions import <input>          의사결정 복원 (머지)
  qa-sdk dkg decisions list [--limit N]        최근 의사결정 조회

  qa-sdk catalog list                등록된 카탈로그 목록
  qa-sdk catalog info <id>           카탈로그 상세 정보

  qa-sdk sync-obsidian [options]     CATALOG → Obsidian 볼트 전체 동기화
  qa-sdk obs read <path>             Obsidian 노트 읽기
  qa-sdk obs search <query>          Obsidian 검색
  qa-sdk obs append <path> <content> Obsidian 노트에 내용 추가
  qa-sdk obs backlinks <name>        Obsidian 백링크 조회

Commands:

  sync-obsidian
    --vault <name>         대상 Obsidian 볼트 (기본: spec-prefix)
    --dry-run              미리보기 (실제 쓰기 없음)


  scan git
    --root <path>          모노레포 루트 (기본: .)
    --output <dir>         저장 디렉토리 (기본: ./schemas)
    --id <name>            스키마 ID (기본: repo 이름에서 추출)

  register
    --registry <url>       Registry 서버 URL ($QA_REGISTRY_URL)
    --input <path>         SchemaSnapshot (파일 또는 디렉토리, 기본: ./schemas)
    --version-id <id>      등록할 버전 ID (필수)

  dry-run
    --input <path>         기준 SchemaSnapshot (로컬 시뮬레이션)
    --change <json>        변경 시나리오 JSON
    --registry <url>       Registry 기준 (원격 시뮬레이션)

  codegen
    --format <fmt>         출력 형식: proto, ts (기본: ts)
    --input <path>         SchemaSnapshot (파일 또는 디렉토리, 기본: ./schemas)
    --output <dir>         출력 디렉토리 (기본: ./generated)
    --package <name>       protobuf package 이름 (기본: qa.apm.v1)

  inspect
    --registry <url>       Registry 서버 URL ($QA_REGISTRY_URL)
    --snapshot-id <id>     특정 스냅샷 ID (생략 시 active)
    --output <dir>         저장 디렉토리 (기본: ./schemas)
`.trim();

// ── Module State ────────────────────────────────────
let loadedCatalog: Catalog | undefined;

// ── Main ─────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    return;
  }

  // --catalog 글로벌 옵션 추출
  const catalogIdx = args.indexOf("--catalog");
  let catalogPath: string | undefined;
  const filteredArgs = [...args];
  if (catalogIdx >= 0 && catalogIdx + 1 < args.length) {
    catalogPath = args[catalogIdx + 1];
    filteredArgs.splice(catalogIdx, 2);
  }

  const sub = resolveSubcommand(filteredArgs);

  // 카탈로그가 필요한 명령 → loadCatalog() 실행
  const DX_COMMANDS = new Set(["encode", "decode", "resolve", "find-version", "list-prefixes", "list-axes", "derive-refs", "impact"]);
  const needsCatalog = catalogPath || sub.name.startsWith("dkg") || sub.name.startsWith("catalog") || sub.name === "codegen" || DX_COMMANDS.has(sub.name);
  if (needsCatalog) {
    loadedCatalog = await loadCatalog(catalogPath);
    setCatalogContext(loadedCatalog);
  }

  // 모든 CLI 명령을 cli_event 좌표로 기록
  try { emitCliEvent(sub.name); } catch { /* 관측 실패는 명령 실행에 영향 없음 */ }

  switch (sub.name) {
    case "init":
      return runInit(sub.rest);
    case "scan git":
      return runScanGit(sub.rest);
    case "register":
      return runRegister(sub.rest);
    case "dry-run":
      return runDryRun(sub.rest);
    case "codegen":
      return runCodegen(sub.rest);
    case "inspect":
      return runInspect(sub.rest);
    case "spec list":
      return runSpecList(sub.rest);
    case "spec resolve":
      return runSpecResolve(sub.rest);
    case "spec validate":
      return runSpecValidate(sub.rest);
    case "spec trace":
      return runSpecTrace(sub.rest);
    case "spec decode":
      return runSpecDecode(sub.rest);
    case "spec codegen":
      return runSpecCodegen(sub.rest);

    // Obsidian 동기화
    case "sync-obsidian":
      return runSyncObsidian(sub.rest);

    // Obsidian 조회/수정
    case "obs read":
      if (sub.rest[0]) obsRead(sub.rest[0], sub.rest[sub.rest.indexOf("--vault") + 1]);
      else console.error("Usage: qa-sdk obs read <path>");
      return;
    case "obs search":
      if (sub.rest[0]) obsSearch(sub.rest[0], sub.rest[sub.rest.indexOf("--vault") + 1]);
      else console.error("Usage: qa-sdk obs search <query>");
      return;
    case "obs append": {
      const appendPath = sub.rest[0];
      const contentIdx = sub.rest.indexOf("--content");
      if (!appendPath || contentIdx < 0) {
        console.error('Usage: qa-sdk obs append <path> --content "..."');
        return;
      }
      obsAppend(appendPath, sub.rest[contentIdx + 1], sub.rest[sub.rest.indexOf("--vault") + 1]);
      return;
    }
    case "obs backlinks":
      if (sub.rest[0]) obsBacklinks(sub.rest[0], sub.rest[sub.rest.indexOf("--vault") + 1]);
      else console.error("Usage: qa-sdk obs backlinks <name>");
      return;
    case "obs list":
      obsList(sub.rest[0] ?? "", sub.rest[sub.rest.indexOf("--vault") + 1]);
      return;
    case "obs stats":
      obsStats(sub.rest[sub.rest.indexOf("--vault") + 1]);
      return;

    // DX 명령어
    case "encode":
      return runEncode(sub.rest);
    case "decode":
      return runDecode(sub.rest);
    case "resolve":
      return runResolve(sub.rest);
    case "find-version":
      return runFindVersion(sub.rest);
    case "list-prefixes":
      cliListPrefixes(loadedCatalog!, { json: sub.rest.includes("--json") });
      return;
    case "list-axes":
      cliListAxes(loadedCatalog!, { json: sub.rest.includes("--json") });
      return;
    case "derive-refs":
      cliDeriveRefs(loadedCatalog!, { check: true });
      return;
    case "impact":
      return runImpactCmd(sub.rest);

    // DKG 명령어
    case "dkg report":
      dkgReport();
      return;
    case "dkg refresh":
      dkgRefresh();
      return;
    case "dkg axes":
      dkgAxes(parsePage(sub.rest));
      return;
    case "dkg prefixes":
      dkgPrefixes(parsePage(sub.rest));
      return;
    case "dkg domains":
      dkgDomains(parsePage(sub.rest));
      return;
    case "dkg impact":
      if (sub.rest[0]) dkgImpact(sub.rest[0]);
      else console.error("Usage: qa-sdk dkg impact <axisId>");
      return;
    case "dkg overlaps":
      dkgOverlaps();
      return;
    case "dkg history":
      dkgHistory({ limit: parseInt(sub.rest[sub.rest.indexOf("--limit") + 1]) || 10 });
      return;
    case "dkg skew":
      dkgSkew();
      return;
    case "dkg coverage":
      dkgCoverage();
      return;
    case "dkg skills":
      dkgSkills();
      return;
    case "dkg audit":
      dkgAudit();
      return;
    case "dkg transitions":
      dkgTransitions(sub.rest[0]);
      return;
    case "dkg transition": {
      const arg = sub.rest[0];
      if (arg === "coverage" || arg === "orphans" || arg === "violations") {
        dkgTransitionAnalysis(arg);
      } else {
        dkgTransitions(arg);
      }
      return;
    }
    case "dkg export":
      dkgExport({ output: sub.rest[sub.rest.indexOf("--output") + 1] });
      return;
    case "dkg import":
      if (sub.rest[0]) dkgImport({ input: sub.rest[0] });
      else console.error("Usage: qa-sdk dkg import <path>");
      return;
    case "dkg decisions export":
      dkgDecisionsExport({ output: sub.rest[sub.rest.indexOf("--output") + 1] });
      return;
    case "dkg decisions import":
      if (sub.rest[0]) dkgDecisionsImport({ input: sub.rest[0] });
      else console.error("Usage: qa-sdk dkg decisions import <path>");
      return;
    case "dkg decisions list": {
      const dlLimit = sub.rest.indexOf("--limit");
      const dlKind = sub.rest.indexOf("--kind");
      dkgDecisionsList({
        limit: dlLimit >= 0 ? parseInt(sub.rest[dlLimit + 1]) : undefined,
        kind: dlKind >= 0 ? sub.rest[dlKind + 1] : undefined,
      });
      return;
    }
    case "dkg service":
      dkgService(sub.rest[0]);
      return;
    case "dkg prefix":
      if (sub.rest[0]) dkgPrefix(sub.rest[0]);
      else console.error("Usage: qa-sdk dkg prefix <id>");
      return;
    case "dkg dsl":
      dkgDsl(sub.rest[0]);
      return;
    case "dkg tables":
      dkgTables();
      return;
    case "dkg table":
      if (sub.rest[0]) dkgTable(sub.rest[0]);
      else console.error("Usage: qa-sdk dkg table <id>");
      return;
    case "dkg scan-tables":
      dkgScanTables();
      return;
    case "dkg overview":
      dkgOverview();
      return;
    case "dkg claims":
      dkgClaims();
      return;
    case "dkg timeline":
      dkgTimeline({ open: sub.rest.includes("--open") });
      return;
    case "dkg resolve": {
      const resObsId = sub.rest[0];
      const resDecIdx = sub.rest.indexOf("--decision");
      const resOutIdx = sub.rest.indexOf("--outcome");
      const resNoteIdx = sub.rest.indexOf("--note");
      if (!resObsId || resDecIdx < 0 || resOutIdx < 0) {
        console.error("Usage: qa-sdk dkg resolve <obsId> --decision <decId> --outcome accepted|deferred|rejected [--note ...]");
        return;
      }
      dkgResolve({
        obsId: resObsId,
        decisionId: sub.rest[resDecIdx + 1],
        outcome: sub.rest[resOutIdx + 1],
        note: resNoteIdx >= 0 ? sub.rest[resNoteIdx + 1] : undefined,
      });
      return;
    }
    case "dkg link": {
      const linkObsId = sub.rest[0];
      const linkDecIdx = sub.rest.indexOf("--decision");
      if (!linkObsId || linkDecIdx < 0) {
        console.error("Usage: qa-sdk dkg link <obsId> --decision <decId>");
        return;
      }
      dkgLink({ obsId: linkObsId, decisionId: sub.rest[linkDecIdx + 1] });
      return;
    }
    case "dkg run": {
      const runSkillId = sub.rest[0];
      if (!runSkillId) {
        console.error("Usage: qa-sdk dkg run <skillId> [args...]");
        console.error("  qa-sdk dkg skills 로 목록 확인");
        return;
      }
      dkgRun(runSkillId, sub.rest.slice(1));
      return;
    }
    case "dkg metrics":
      dkgMetrics();
      return;
    case "dkg converge":
      dkgConverge({
        persist: sub.rest.includes("--persist"),
        verbose: sub.rest.includes("--verbose"),
      });
      return;
    case "dkg spec add": {
      const saId = sub.rest[sub.rest.indexOf("--id") + 1];
      const saType = sub.rest[sub.rest.indexOf("--type") + 1];
      const saTitle = sub.rest[sub.rest.indexOf("--title") + 1];
      const saRatIdx = sub.rest.indexOf("--rationale");
      const saGovIdx = sub.rest.indexOf("--governs");
      if (!saId || !saType || !saTitle) {
        console.error('Usage: qa-sdk dkg spec add --id <id> --type <type> --title "..." [--rationale "..."] [--governs <id,...>]');
        return;
      }
      dkgSpecAdd({
        id: saId, type: saType, title: saTitle,
        rationale: saRatIdx >= 0 ? sub.rest[saRatIdx + 1] : undefined,
        governs: saGovIdx >= 0 ? sub.rest[saGovIdx + 1].split(",") : undefined,
      });
      return;
    }
    case "dkg spec list":
      dkgSpecList();
      return;
    case "dkg spec transition": {
      const stSpecId = sub.rest[0];
      const stLifecycle = sub.rest[1];
      if (!stSpecId || !stLifecycle) {
        console.error("Usage: qa-sdk dkg spec transition <specId> <draft|active|deprecated>");
        return;
      }
      dkgSpecTransition(stSpecId, stLifecycle);
      return;
    }
    case "dkg reset": {
      const resetTarget = sub.rest[0] ?? "all";
      dkgReset(resetTarget, { confirm: sub.rest.includes("--confirm") });
      return;
    }
    case "dkg promote":
      dkgPromoteScan();
      return;
    case "dkg add-entry": {
      const aeAxisId = sub.rest[0];
      const aeEntry = sub.rest[1];
      if (!aeAxisId || !aeEntry) {
        console.error("Usage: qa-sdk dkg add-entry <axis> <entry> [--apply] [--expand-capacity] [--write-file <path>]");
        return;
      }
      const aeWriteIdx = sub.rest.indexOf("--write-file");
      dkgAddEntry({
        axisId: aeAxisId,
        entry: aeEntry,
        apply: sub.rest.includes("--apply"),
        expandCapacity: sub.rest.includes("--expand-capacity"),
        writeFile: aeWriteIdx >= 0 ? sub.rest[aeWriteIdx + 1] : undefined,
      });
      return;
    }
    case "dkg publish": {
      const pubRegIdx = sub.rest.indexOf("--registry");
      const pubVerIdx = sub.rest.indexOf("--version");
      await dkgPublish({
        registry: pubRegIdx >= 0 ? sub.rest[pubRegIdx + 1] : undefined,
        versionId: pubVerIdx >= 0 ? sub.rest[pubVerIdx + 1] : undefined,
      });
      return;
    }
    case "dkg version": {
      const vAction = sub.rest[0] ?? "list";
      const vPrefix = sub.rest[1] ?? "";
      const vVersionId = sub.rest[2] ?? "";
      const vRegIdx = sub.rest.indexOf("--registry");
      await dkgVersion(vAction, vPrefix, vVersionId, { registry: vRegIdx >= 0 ? sub.rest[vRegIdx + 1] : undefined });
      return;
    }
    case "dkg self-check":
      dkgSelfCheck({ apply: sub.rest.includes("--apply") });
      return;
    case "dkg patterns":
      dkgPatterns();
      return;
    case "dkg pattern-stats":
      dkgPatternStats();
      return;
    case "dkg discover-links":
      dkgDiscoverLinks();
      return;
    case "dkg diagram": {
      const { dkgDiagram } = await import("./commands/dkg.js");
      await dkgDiagram(sub.rest);
      break;
    }
    case "dkg trace":
      if (sub.rest[0]) dkgTrace(sub.rest[0]);
      else console.error("Usage: qa-sdk dkg trace <nodeId>");
      return;
    case "dkg decide": {
      const targetIdx = sub.rest.indexOf("--target");
      const typeIdx = sub.rest.indexOf("--type");
      const titleIdx = sub.rest.indexOf("--title");
      const rationaleIdx = sub.rest.indexOf("--rationale");
      if (targetIdx < 0 || typeIdx < 0 || titleIdx < 0 || rationaleIdx < 0) {
        console.error('Usage: qa-sdk dkg decide --target <id> --type <type> --title "..." --rationale "..." [--spec <specId>]');
        console.error("  types: capacity, new-axis, new-prefix, dim-add, merge, deprecate");
        return;
      }
      const specIdx = sub.rest.indexOf("--spec");
      dkgDecide({
        target: sub.rest[targetIdx + 1],
        type: sub.rest[typeIdx + 1],
        title: sub.rest[titleIdx + 1],
        rationale: sub.rest[rationaleIdx + 1],
        spec: specIdx >= 0 ? sub.rest[specIdx + 1] : undefined,
      });
      return;
    }
    case "dkg observe": {
      const obsTargetIdx = sub.rest.indexOf("--target");
      const findingIdx = sub.rest.indexOf("--finding");
      if (obsTargetIdx < 0 || findingIdx < 0) {
        console.error('Usage: qa-sdk dkg observe --target <id> --finding "..."');
        return;
      }
      const suggIdx = sub.rest.indexOf("--suggestion");
      dkgObserve({
        target: sub.rest[obsTargetIdx + 1],
        finding: sub.rest[findingIdx + 1],
        suggestion: suggIdx >= 0 ? sub.rest[suggIdx + 1] : undefined,
      });
      return;
    }
    case "dkg claim": {
      const claimTarget = sub.rest[0];
      const byIdx = sub.rest.indexOf("--by");
      if (!claimTarget || byIdx < 0) {
        console.error('Usage: qa-sdk dkg claim <id> --by <worker> [--reason "..."]');
        return;
      }
      const reasonIdx = sub.rest.indexOf("--reason");
      dkgClaim({ target: claimTarget, by: sub.rest[byIdx + 1], reason: reasonIdx >= 0 ? sub.rest[reasonIdx + 1] : undefined });
      return;
    }
    case "dkg release":
      if (sub.rest[0]) dkgRelease(sub.rest[0]);
      else console.error("Usage: qa-sdk dkg release <id>");
      return;

    // Catalog 명령어
    case "catalog list": {
      const reg = getCatalogRegistry();
      const catalogs = reg.listCatalogs();
      if (catalogs.length === 0) {
        console.log("  등록된 카탈로그 없음");
      } else {
        console.log(`\n══ Catalogs (${catalogs.length}) ══\n`);
        for (const c of catalogs) {
          console.log(`  ${c.id.padEnd(15)} ${c.name.padEnd(20)} prefixes=${c.prefixCount}`);
        }
      }
      return;
    }
    case "catalog info": {
      const infoId = sub.rest[0];
      if (!infoId) {
        console.error("Usage: qa-sdk catalog info <id>");
        return;
      }
      const reg = getCatalogRegistry();
      if (!reg.has(infoId)) {
        console.error(`카탈로그 '${infoId}' 없음. 사용 가능: ${reg.listCatalogs().map(c => c.id).join(", ")}`);
        process.exitCode = 1;
        return;
      }
      const cat = reg.getCatalog(infoId);
      console.log(`\n══ Catalog: ${cat.id} ══`);
      console.log(`  name:     ${cat.name}`);
      console.log(`  axes:     ${Object.keys(cat.axes).length}`);
      console.log(`  prefixes: ${Object.keys(cat.prefixes).length}`);
      console.log(`  tables:   ${cat.tables ? Object.keys(cat.tables).length : 0}`);
      console.log(`\n  Axes:`);
      for (const [id, a] of Object.entries(cat.axes)) {
        const versions = Object.keys(a.versions);
        console.log(`    ${id.padEnd(15)} versions=${versions.length}`);
      }
      console.log(`\n  Prefixes:`);
      for (const [id, p] of Object.entries(cat.prefixes)) {
        console.log(`    ${id.padEnd(15)} ${p.name.padEnd(15)} dims=${p.labels.length}`);
      }
      return;
    }

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

function resolveSubcommand(args: string[]): Subcommand {
  // 3단어: "dkg decisions export" 등
  const threeWord = [
    "dkg decisions export", "dkg decisions import", "dkg decisions list",
    "dkg spec add", "dkg spec list", "dkg spec transition",
  ];
  if (args.length >= 3) {
    const candidate = `${args[0]} ${args[1]} ${args[2]}`;
    if (threeWord.includes(candidate)) {
      return { name: candidate, rest: args.slice(3) };
    }
  }
  // 2단어: "scan git", "spec list", "spec resolve", "spec validate"
  const twoWord = [
    "scan git", "spec list", "spec resolve", "spec validate", "spec trace", "spec decode", "spec codegen",
    "dkg report", "dkg refresh", "dkg axes", "dkg prefixes", "dkg domains", "dkg impact", "dkg overlaps",
    "dkg history", "dkg skew", "dkg coverage", "dkg skills", "dkg export", "dkg import",
    "dkg service", "dkg prefix", "dkg dsl", "dkg overview",
    "dkg trace", "dkg decide", "dkg observe", "dkg claim", "dkg release",
    "dkg claims", "dkg resolve", "dkg link", "dkg timeline", "dkg run", "dkg metrics", "dkg converge", "dkg self-check",
    "dkg promote", "dkg reset", "dkg add-entry", "dkg publish", "dkg version", "dkg patterns", "dkg pattern-stats", "dkg diagram",
    "dkg tables", "dkg table", "dkg scan-tables", "dkg transitions", "dkg transition", "dkg audit", "dkg discover-links",
    "catalog list", "catalog info",
    "obs read", "obs search", "obs append", "obs backlinks", "obs list", "obs stats",
  ];
  if (args.length >= 2) {
    const candidate = `${args[0]} ${args[1]}`;
    if (twoWord.includes(candidate)) {
      return { name: candidate, rest: args.slice(2) };
    }
  }
  // 1단어 커맨드
  const oneWord = [
    "init",
    "register", "dry-run", "codegen", "inspect",
    "encode", "decode", "resolve", "find-version", "list-prefixes", "list-axes", "derive-refs", "impact",
    "sync-obsidian",
  ];
  if (oneWord.includes(args[0])) {
    return { name: args[0], rest: args.slice(1) };
  }
  return { name: args.join(" "), rest: [] };
}

// ── scan git ─────────────────────────────────────────

async function runScanGit(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      root: { type: "string", default: "." },
      output: { type: "string", default: "./schemas" },
      id: { type: "string" },
    },
    strict: true,
  });

  await gitScan({
    root: values.root!,
    output: values.output!,
    id: values.id,
  });
}

// ── register ─────────────────────────────────────────

async function runRegister(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      registry: { type: "string" },
      input: { type: "string", default: "./schemas" },
      "version-id": { type: "string" },
    },
    strict: true,
  });

  const registryUrl = values.registry ?? process.env.QA_REGISTRY_URL;
  if (!registryUrl) {
    console.error("--registry 또는 $QA_REGISTRY_URL 필요");
    process.exit(1);
  }

  const versionId = values["version-id"];
  if (!versionId) {
    console.error("--version-id 필수");
    process.exit(1);
  }

  await register({
    registry: registryUrl,
    input: values.input!,
    versionId,
  });
}

// ── dry-run ──────────────────────────────────────────

async function runDryRun(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: "string" },
      change: { type: "string" },
      registry: { type: "string" },
    },
    strict: true,
  });

  if (!values.change) {
    console.error("--change <json> 필수. 예: --change '{\"pkg\":{\"capacity\":128}}'");
    process.exit(1);
  }

  let changes: ChangeScenario;
  try {
    changes = JSON.parse(values.change) as ChangeScenario;
  } catch {
    console.error("--change JSON 파싱 실패");
    process.exit(1);
  }

  const registryUrl = values.registry ?? process.env.QA_REGISTRY_URL;

  await dryRun({
    input: values.input,
    registry: registryUrl,
    changes,
  });
}

// ── codegen ──────────────────────────────────────────

async function runCodegen(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      format: { type: "string", default: "ts" },
      input: { type: "string", default: "./schemas" },
      output: { type: "string", default: "./generated" },
      package: { type: "string", default: "qa.apm.v1" },
      catalog: { type: "string" },
      "dkg-config": { type: "string" },
      "lock-version": { type: "string" },
      registry: { type: "string" },
      "catalog-id": { type: "string" },
      "test-migration": { type: "boolean" },
      prefix: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      samples: { type: "string" },
    },
    strict: true,
  });

  // --test-migration → 라운드트립 검증
  if (values["test-migration"]) {
    if (!values.prefix || !values.from || !values.to) {
      console.error("Usage: qa-sdk codegen --test-migration --prefix <id> --from <v1> --to <v2> [--samples 100]");
      return;
    }
    await runMigrationTest({
      loadedCatalog: loadedCatalog,
      catalog: values.catalog,
      prefix: values.prefix,
      from: values.from,
      to: values.to,
      samples: values.samples ? parseInt(values.samples) : undefined,
    });
    return;
  }

  // --registry → Registry에서 카탈로그 fetch → codegen
  if (values.registry) {
    await codegen({
      formats: ["ts"],
      input: values.input!,
      output: values.output!,
      registry: values.registry,
      catalogId: values["catalog-id"],
      dkgConfig: values["dkg-config"],
      lockVersion: values["lock-version"],
    });
    return;
  }

  // --catalog 경로 또는 loadedCatalog → Catalog 기반 codegen
  if (values.catalog || values["dkg-config"] || loadedCatalog) {
    await codegen({
      formats: ["ts"],
      input: values.input!,
      output: values.output!,
      catalog: values.catalog,
      loadedCatalog: loadedCatalog,
      dkgConfig: values["dkg-config"],
      lockVersion: values["lock-version"],
    });
    return;
  }

  const formats = values.format!.split(",").map((f) => {
    const trimmed = f.trim();
    if (trimmed !== "proto" && trimmed !== "ts") {
      console.error(`지원하지 않는 format: ${trimmed} (proto | ts)`);
      process.exit(1);
    }
    return trimmed as CodegenFormat;
  });

  await codegen({
    formats,
    input: values.input!,
    output: values.output!,
    packageName: values.package,
  });
}

// ── inspect ──────────────────────────────────────────

async function runInspect(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      registry: { type: "string" },
      "snapshot-id": { type: "string" },
      output: { type: "string", default: "./schemas" },
    },
    strict: true,
  });

  const registryUrl = values.registry ?? process.env.QA_REGISTRY_URL;
  if (!registryUrl) {
    console.error("--registry 또는 $QA_REGISTRY_URL 필요");
    process.exit(1);
  }

  await schemaPull({
    registry: registryUrl,
    output: values.output!,
    snapshotId: values["snapshot-id"],
  });
}

// ── spec 공통: --catalog / --specs 파싱 ─────────────

const SPEC_BASE_OPTIONS = {
  specs: { type: "string" as const },
  catalog: { type: "boolean" as const, default: false },
};

async function loadCatalogInput(): Promise<unknown | undefined> {
  try {
    const { DEMO_CATALOG } = await import("demo-snapshot");
    return DEMO_CATALOG;
  } catch {
    console.error("demo-snapshot 패키지를 로딩할 수 없습니다");
    process.exit(1);
  }
}

// ── spec list ───────────────────────────────────────

async function runSpecList(argv: string[]) {
  const { values } = parseArgs({ args: argv, options: { ...SPEC_BASE_OPTIONS }, strict: true });
  await specList({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
  });
}

// ── spec resolve ────────────────────────────────────

async function runSpecResolve(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { ...SPEC_BASE_OPTIONS, prefix: { type: "string" }, values: { type: "string" } },
    strict: true,
  });

  if (!values.prefix || !values.values) {
    console.error("--prefix <id> --values <json> 필수");
    console.error('예: qa-sdk spec resolve --catalog --prefix permission --values \'{"perm_svc":"40","role":"admin"}\'');
    process.exit(1);
  }

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(values.values) as Record<string, string>;
  } catch {
    console.error("--values JSON 파싱 실패");
    process.exit(1);
  }

  await specResolve({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    prefixId: values.prefix,
    values: parsed,
  });
}

// ── spec validate ───────────────────────────────────

async function runSpecValidate(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { ...SPEC_BASE_OPTIONS, schema: { type: "string" }, data: { type: "string" } },
    strict: true,
  });

  if (!values.schema || !values.data) {
    console.error("--schema <id> --data <json> 필수");
    process.exit(1);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(values.data) as Record<string, unknown>;
  } catch {
    console.error("--data JSON 파싱 실패");
    process.exit(1);
  }

  await specValidate({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    schemaId: values.schema,
    data: parsed,
  });
}

// ── spec trace ──────────────────────────────────────

async function runSpecTrace(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { ...SPEC_BASE_OPTIONS, id: { type: "string" } },
    strict: true,
  });

  if (!values.id) {
    console.error("--id <specId> 필수");
    console.error("예: qa-sdk spec trace --id FEAT-003");
    process.exit(1);
  }

  await specTrace({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    specId: values.id,
  });
}

// ── spec codegen ────────────────────────────────────

async function runSpecCodegen(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { ...SPEC_BASE_OPTIONS, output: { type: "string" }, format: { type: "string", default: "ts" } },
    strict: true,
  });

  await specCodegen({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    output: values.output,
    format: values.format as "ts" | "esm" | "cjs" | "proto" | "json-schema",
  });
}

// ── spec decode ─────────────────────────────────────

async function runSpecDecode(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { ...SPEC_BASE_OPTIONS, address: { type: "string" }, deep: { type: "boolean", default: false }, format: { type: "string" } },
    strict: true,
  });

  if (!values.address) {
    console.error('--address "prefix:version:address" 필수');
    console.error("예: qa-sdk spec decode --catalog --address permission:v1:3");
    console.error("    qa-sdk spec decode --catalog --address permission:v1:3 --deep");
    process.exit(1);
  }

  await specDecode({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    address: values.address,
    deep: values.deep,
    format: values.format === "json" ? "json" : "text",
  });
}

// ── DX: encode ──────────────────────────────────────

function runEncode(argv: string[]) {
  const prefix = argv[0];
  if (!prefix) { console.error("Usage: qa-sdk encode <prefix> --dim1 val1 --dim2 val2"); return; }

  const dims: Record<string, string | number> = {};
  for (let i = 1; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const val = argv[i + 1];
    if (key && val) dims[key] = val;
  }

  const json = argv.includes("--json");
  cliEncode(loadedCatalog!, { prefix, dims, json });
}

// ── DX: decode ──────────────────────────────────────

function runDecode(argv: string[]) {
  const address = argv[0];
  if (!address) { console.error('Usage: qa-sdk decode "prefix:version:address"'); return; }
  const deep = argv.includes("--deep");
  const json = argv.includes("--json");
  cliDecode(loadedCatalog!, { address, deep, json });
}

// ── DX: resolve ─────────────────────────────────────

function runResolve(argv: string[]) {
  const address = argv[0];
  if (!address) { console.error('Usage: qa-sdk resolve "prefix:version:address"'); return; }
  const json = argv.includes("--json");
  const toIdx = argv.indexOf("--to");
  const to = toIdx >= 0 ? argv[toIdx + 1] : undefined;
  cliResolve(loadedCatalog!, { address, to, json });
}

// ── DX: find-version ────────────────────────────────

function runFindVersion(argv: string[]) {
  const axis = argv[0];
  const entry = argv[1];
  if (!axis || !entry) { console.error("Usage: qa-sdk find-version <axis> <entry>"); return; }
  cliFindVersion(loadedCatalog!, { axis, entry });
}

// ── DX: impact ──────────────────────────────────────

async function runImpactCmd(argv: string[]) {
  const axisIdx = argv.indexOf("--axis");
  const prefixIdx = argv.indexOf("--prefix");
  // DkgConfig는 동적 로드 (demo-snapshot fallback)
  const { DEMO_DKG_CONFIG } = await import("demo-snapshot");
  const dkgConfig = DEMO_DKG_CONFIG;
  if (axisIdx >= 0) cliImpact(loadedCatalog!, dkgConfig, { axis: argv[axisIdx + 1] });
  else if (prefixIdx >= 0) cliImpact(loadedCatalog!, dkgConfig, { prefix: argv[prefixIdx + 1] });
  else console.error("Usage: qa-sdk impact --axis <id> or --prefix <id>");
}

// ── sync-obsidian ───────────────────────────────────

function runSyncObsidian(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      vault: { type: "string", default: "spec-prefix" },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
  });

  syncObsidian({
    vault: values.vault!,
    dryRun: values["dry-run"]!,
  });
}

// ── init ─────────────────────────────────────────────

async function runInit(argv: string[]) {
  const fromIdx = argv.indexOf("--from");
  await init({
    from: fromIdx >= 0 ? argv[fromIdx + 1] : undefined,
  });
}

// ── DKG helpers ─────────────────────────────────────

function parsePage(argv: string[]): { page?: number; limit?: number } {
  const pageIdx = argv.indexOf("--page");
  const limitIdx = argv.indexOf("--limit");
  return {
    page: pageIdx >= 0 ? parseInt(argv[pageIdx + 1]) : undefined,
    limit: limitIdx >= 0 ? parseInt(argv[limitIdx + 1]) : undefined,
  };
}

// ── Entry ────────────────────────────────────────────

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
