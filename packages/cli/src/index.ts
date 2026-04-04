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
import { gitConflicts, watchGitConflicts } from './commands/git-conflicts.js';
import { gitScan } from './commands/git-scan.js';
import { register } from './commands/register.js';
import {
  dkgReport,
  dkgAxes,
  dkgPrefixes,
  dkgDomains,
  dkgImpact,
  dkgOverlaps,
  dkgHistory,
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
} from './commands/dkg.js';
import { loadCatalog } from 'config-loader';
import type { Catalog } from '@qa-sdk/core';
import {
  cliEncode,
  cliDecode,
  cliResolve,
  cliFindVersion,
  cliDeriveRefs,
  cliImpact,
  cliListPrefixes,
  cliListAxes,
} from './commands/dx.js';
import { obsRead, obsSearch, obsAppend, obsBacklinks, obsList, obsStats } from './commands/obs.js';
import { dryRun, type ChangeScenario } from './commands/dry-run.js';
import { schemaPull } from './commands/schema-pull.js';
import { codegen, codegenDataObjects, runMigrationTest, type CodegenFormat } from './commands/codegen.js';
import {
  specList,
  specResolve,
  specValidate,
  specTrace,
  specDecode,
  specCodegen,
} from './commands/spec.js';
import type { CatalogInputLike, SchemaValidationInput } from './commands/spec.js';
import { init } from './commands/init.js';
import { syncObsidian } from './commands/sync-obsidian.js';
import {
  ingestHealth,
  ingestSend,
  ingestRecent,
  ingestTrace,
  ingestStatus,
  ingestServices,
  ingestMode,
  ingestInsights,
} from './commands/ingest.js';
import {
  gateCheck,
  gateClassify,
  gateHealth,
  queryResolve,
  queryRules,
  queryHealth,
} from './commands/service-query.js';
import {
  serviceList,
  serviceShow,
  serviceOwners,
  serviceEndpoints,
  serviceHealth,
  serviceHealthAll,
  serviceMode,
  serviceAppList,
  serviceAppShow,
  serviceCleanupPlan,
  serviceCleanupDraft,
  serviceCleanupActivate,
  serviceCleanupExecute,
} from './commands/service.js';
import { cliDef } from './commands/def.js';
import { prefixStamp, prefixDrift, prefixFind, prefixMigrate, prefixImpact } from './commands/prefix-stamp.js';
import {
  reviewMark,
  reviewStatus,
  reviewDashboard,
  reviewLog,
  reviewRequest,
  reviewRequests,
  reviewShowRequest,
  reviewBridgeRequest,
} from './commands/review.js';
import {
  testScan,
  testAssign,
  testScaffold,
  testStatus,
  testReport,
} from './commands/test.js';
import { cliQuality } from './commands/quality.js';
import { motionInspect, motionValidate } from './commands/motion.js';
import {
  motionApply,
  motionExport,
  motionImport,
  motionPreview,
  motionSceneCreate,
  motionSceneDelete,
  motionSceneList,
  motionSceneShow,
  motionWorkspaceCreate,
  motionWorkspaceDelete,
  motionWorkspaceList,
  motionWorkspaceShow,
} from './commands/motion-workspace.js';
import {
  flowList,
  flowStart,
  flowSelect,
  flowStatus,
  flowTrace,
  flowAnalyze,
  flowCompare,
  flowPolicyCandidates,
  flowPolicyApprove,
  flowPolicyReject,
  flowPolicyList,
  flowPolicyLearn,
  flowLookup,
  flowHistory,
  flowVerdict,
  flowJudge,
} from './commands/flow.js';

// ── Usage ────────────────────────────────────────────

export const USAGE = `
qa-sdk — DSL 접근 도구

Global Options:
  --catalog <path>       카탈로그 파일 (.ts/.js/.json). 기본: qa-sdk.config.ts 또는 DEMO_CATALOG

Usage:
  qa-sdk init [options]            새 카탈로그 프로젝트 또는 Vite 소비처 스캐폴딩
  qa-sdk scan git [options]          Git 메타데이터 수집 → SchemaSnapshot
  qa-sdk register [options]          SchemaSnapshot → Registry 등록
  qa-sdk dry-run [options]           변경 시뮬레이션 (DAG 전파, 변경 없음)
  qa-sdk codegen [options]           SchemaSnapshot → 타입 인터페이스 생성
  qa-sdk inspect [options]           Registry 상태 조회
  qa-sdk motion validate <file>      Motion composition/workspace 문서 검증
  qa-sdk motion inspect <file>       Motion composition/workspace 요약
  qa-sdk motion workspace list       Remote motion workspace 목록
  qa-sdk motion workspace show <id>  Remote motion workspace 상세
  qa-sdk motion workspace create <id>  Remote motion workspace 생성
  qa-sdk motion workspace delete <id>  Remote motion workspace 삭제
  qa-sdk motion scene list --workspace <id>  Remote motion scene 목록
  qa-sdk motion scene show --workspace <id> --scene <id>  Remote motion scene 상세
  qa-sdk motion scene create --workspace <id>  Remote motion scene 생성
  qa-sdk motion scene delete --workspace <id> --scene <id>  Remote motion scene 삭제
  qa-sdk motion export --workspace <id> --out <file>  Remote workspace → composition JSON
  qa-sdk motion import <file> --workspace <id>        composition JSON → remote workspace
  qa-sdk motion apply --workspace <id> --command <json>  Remote workspace command 적용
  qa-sdk motion preview [--workspace <id>]  Online workspace preview 실행
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
  qa-sdk dkg axes [--page N] [--group-by prefix|domain]  축 목록
  qa-sdk dkg prefixes [--page N]     prefix 목록
  qa-sdk dkg domains                 도메인 목록
  qa-sdk dkg flow-schemas [--page N] FlowSchemaNode 목록
  qa-sdk dkg flow-schema <id>        FlowSchema 프로파일
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

  qa-sdk flow list                              플로우 스키마 목록
  qa-sdk flow start <schema-id>                 플로우 시작
  qa-sdk flow select <branch-id>                현재 gate 선택
  qa-sdk flow status [instance-id]              실행 상태 조회
  qa-sdk flow trace <instance-id>               코어 경로 추적
  qa-sdk flow analyze <schema-id>               구조/영향 분석
  qa-sdk flow compare [options]                 쌍/분포/시간 비교
  qa-sdk flow policy learn <schema-id>          패턴 감지 + 후보 생성
  qa-sdk flow policy candidates                 정책 후보 목록
  qa-sdk flow policy approve <id>               후보 승인 + 정책 등록
  qa-sdk flow policy reject <id>                후보 거부
  qa-sdk flow policy list                       등록된 정책 목록
  qa-sdk flow lookup <keyword>                  키워드로 의사결정 이력 조회
  qa-sdk flow history [schema-id]               완료된 인스턴스 이력 (-n 20)
  qa-sdk flow verdict <instance-id>             판정 상태 + 성공 기준 조회
  qa-sdk flow judge <instance-id>              판정 기록 (성공/실패/보류)

  qa-sdk service list [--json]       서비스 목록 (tier/team/owned/url)
  qa-sdk service show <id>           서비스 상세 (owned + consumed prefixes)
  qa-sdk service health [--env dev]  전체 서비스 헬스체크 (registry 경유)
  qa-sdk service health-all [--json] 모든 서비스 직접 health check (registry 불필요)
  qa-sdk service owners [--json]     prefix → 소유 서비스 맵
  qa-sdk service endpoints [--filter-env dev|prod]  서비스 엔드포인트 목록
  qa-sdk service app list [--json]     Application 목록
  qa-sdk service app show <id>         Application 상세 (서비스 포함)
  qa-sdk service cleanup-plan <serviceId> [--manifest-version v] [--json]
  qa-sdk service cleanup-draft <serviceId> --new-version <v> [--manifest-version v] [--replace kind=version]
  qa-sdk service cleanup-activate <serviceId> --manifest-version <v>
  qa-sdk service cleanup-execute <serviceId> --new-version <v> [--manifest-version v] [--replace kind=version]

  qa-sdk ingest health [--env dev|prod|staging]  수집 서버 헬스체크
  qa-sdk ingest send [eventKey] [--dim prefix.axis=value]  테스트 이벤트 전송
  qa-sdk ingest recent [limit]       최근 수집 세션 목록
  qa-sdk ingest trace <traceId>      trace 상세 (records + verdicts)
  qa-sdk ingest status               수집 파이프라인 상태 요약
  qa-sdk ingest services             서비스 URL 맵 (registry 기반, → service list 권장)

  qa-sdk gate health                  gate-service 헬스체크
  qa-sdk gate check <prefix> [ver]   주소 상태 확인
  qa-sdk gate classify <prefix> <ver> <addr>  주소 분류

  qa-sdk query health                query-service 헬스체크
  qa-sdk query resolve --coord d=v   정책 해석
  qa-sdk query rules                 정책 규칙 목록

  qa-sdk review mark <file|glob...> --reviewer <name> [--model <ai>]  리뷰 완료 기록
  qa-sdk review status [--service <scope>] [--stale] [--unreviewed]  리뷰 상태 조회
  qa-sdk review dashboard            서비스별 리뷰 커버리지
  qa-sdk review log <file>           파일 리뷰 이력
  qa-sdk review request [file|glob...] --reviewer <name> --purpose <text>  AI 피드백 요청 생성
    [--dkg-target <nodeId>] [--decision-id <id>]
    [--decision-type <type> --title <text> --rationale <text>]
  qa-sdk review requests [--service <scope>] [--limit N]  피드백 요청 목록
  qa-sdk review show-request <id>    피드백 요청 상세
  qa-sdk review bridge-request <id> --target <nodeId>  피드백 요청을 DKG observation/decision에 연결

  qa-sdk test scan [--dir <path>] [--db <path>]   스펙 frontmatter tests: 선언 → declared
  qa-sdk test assign [--a-coord <c>] [--force] [--db <path>]  모듈화 체크 → B 좌표 부여
  qa-sdk test scaffold [--b-coord <c>] [--db <path>]         테스트 스텁 파일 생성
  qa-sdk test status [--db <path>]                 생명주기 현황
  qa-sdk test report [--db <path>]                 커버리지 매트릭스

  qa-sdk quality list [filters]      gate 문서 목록
  qa-sdk quality status [bundle-id]  quality bundle 상태 요약
  qa-sdk quality export [bundle-id] [--output=<path>]  quality bundle 상태 JSON export
  qa-sdk quality bundle <bundle-id>  gate 번들 문서 조회
  qa-sdk quality claims <bundle-id>  contract claim 감사표 조회
  qa-sdk quality show <gate-id>      gate 문서 상세
  qa-sdk quality run <gate-id>       gate 명령 실행
  qa-sdk quality next <gate-id>      다음 gate/doc 추천
  qa-sdk quality diagnose <gate-id>  최근 실패/검증 상태 진단

  qa-sdk catalog list                등록된 카탈로그 목록
  qa-sdk catalog info <id>           카탈로그 상세 정보

  qa-sdk sync-obsidian [options]     CATALOG → Obsidian 볼트 전체 동기화
  qa-sdk def sync [--db path]        docs → local definition SQLite 동기화
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

  git conflicts
    --root <path>          분석 대상 저장소 루트 (기본: .)
    --remote <name>        원격 이름 (기본: origin)
    --base <ref>           기준 브랜치/참조 (기본: upstream 또는 remote HEAD)
    --current <ref>        현재 브랜치 대신 비교할 ref (기본: HEAD)
    --max-commits <n>      source별 포함할 최근 커밋 수 (기본: 12)
    --skip-fetch           fetch 없이 로컬에 저장된 remote ref만 사용
    --skip-worktrees       다른 local worktree는 분석에서 제외
    --output <path>        JSON 리포트를 파일로 저장
    --watch                주기적으로 리포트를 다시 계산
    --interval-ms <n>      watch 주기 ms (기본: 5000)
    --json                 JSON으로 출력
    --limit <n>            사람이 읽는 출력 최대 개수 (기본: 10)

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

export async function main(argv = process.argv.slice(2)) {
  const args = argv;

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return;
  }

  // --catalog 글로벌 옵션 추출
  const catalogIdx = args.indexOf('--catalog');
  let catalogPath: string | undefined;
  const filteredArgs = [...args];
  if (catalogIdx >= 0 && catalogIdx + 1 < args.length) {
    catalogPath = args[catalogIdx + 1];
    filteredArgs.splice(catalogIdx, 2);
  }

  const sub = resolveSubcommand(filteredArgs);

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

  switch (sub.name) {
    case 'init':
      return runInit(sub.rest);
    case 'scan git':
      return runScanGit(sub.rest);
    case 'git conflicts':
      return runGitConflicts(sub.rest);
    case 'register':
      return runRegister(sub.rest);
    case 'dry-run':
      return runDryRun(sub.rest);
    case 'codegen':
      return runCodegen(sub.rest);
    case 'inspect':
      return runInspect(sub.rest);
    case 'motion validate':
      return motionValidate(sub.rest);
    case 'motion inspect':
      return motionInspect(sub.rest);
    case 'motion workspace list':
      return motionWorkspaceList(sub.rest);
    case 'motion workspace show':
      return motionWorkspaceShow(sub.rest);
    case 'motion workspace create':
      return motionWorkspaceCreate(sub.rest);
    case 'motion workspace delete':
      return motionWorkspaceDelete(sub.rest);
    case 'motion scene list':
      return motionSceneList(sub.rest);
    case 'motion scene show':
      return motionSceneShow(sub.rest);
    case 'motion scene create':
      return motionSceneCreate(sub.rest);
    case 'motion scene delete':
      return motionSceneDelete(sub.rest);
    case 'motion export':
      return motionExport(sub.rest);
    case 'motion import':
      return motionImport(sub.rest);
    case 'motion apply':
      return motionApply(sub.rest);
    case 'motion preview':
      return motionPreview(sub.rest);
    case 'spec list':
      return runSpecList(sub.rest);
    case 'spec resolve':
      return runSpecResolve(sub.rest);
    case 'spec validate':
      return runSpecValidate(sub.rest);
    case 'spec trace':
      return runSpecTrace(sub.rest);
    case 'spec decode':
      return runSpecDecode(sub.rest);
    case 'spec codegen':
      return runSpecCodegen(sub.rest);
    case 'spec drift': {
      const { cliSpecDrift } = await import('./commands/spec-drift.js');
      return cliSpecDrift(sub.rest);
    }

    // Obsidian 동기화
    case 'sync-obsidian':
      return runSyncObsidian(sub.rest);

    // Obsidian 조회/수정
    case 'obs read':
      if (sub.rest[0]) obsRead(sub.rest[0], sub.rest[sub.rest.indexOf('--vault') + 1]);
      else console.error('Usage: qa-sdk obs read <path>');
      return;
    case 'obs search':
      if (sub.rest[0]) obsSearch(sub.rest[0], sub.rest[sub.rest.indexOf('--vault') + 1]);
      else console.error('Usage: qa-sdk obs search <query>');
      return;
    case 'obs append': {
      const appendPath = sub.rest[0];
      const contentIdx = sub.rest.indexOf('--content');
      if (!appendPath || contentIdx < 0) {
        console.error('Usage: qa-sdk obs append <path> --content "..."');
        return;
      }
      obsAppend(appendPath, sub.rest[contentIdx + 1], sub.rest[sub.rest.indexOf('--vault') + 1]);
      return;
    }
    case 'obs backlinks':
      if (sub.rest[0]) obsBacklinks(sub.rest[0], sub.rest[sub.rest.indexOf('--vault') + 1]);
      else console.error('Usage: qa-sdk obs backlinks <name>');
      return;
    case 'obs list':
      obsList(sub.rest[0] ?? '', sub.rest[sub.rest.indexOf('--vault') + 1]);
      return;
    case 'obs stats':
      obsStats(sub.rest[sub.rest.indexOf('--vault') + 1]);
      return;

    // DX 명령어
    case 'encode':
      return runEncode(sub.rest);
    case 'decode':
      return runDecode(sub.rest);
    case 'resolve':
      return runResolve(sub.rest);
    case 'find-version':
      return runFindVersion(sub.rest);
    case 'list-prefixes':
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- DX_COMMANDS → needsCatalog → loadedCatalog 보장
      cliListPrefixes(loadedCatalog!, { json: sub.rest.includes('--json') });
      return;
    case 'list-axes':
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- DX_COMMANDS → needsCatalog → loadedCatalog 보장
      cliListAxes(loadedCatalog!, { json: sub.rest.includes('--json') });
      return;
    case 'derive-refs':
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- DX_COMMANDS → needsCatalog → loadedCatalog 보장
      cliDeriveRefs(loadedCatalog!, { check: true });
      return;
    case 'impact':
      return runImpactCmd(sub.rest);

    // DKG 명령어
    case 'dkg report':
      dkgReport();
      return;
    case 'dkg refresh':
      dkgRefresh();
      return;
    case 'dkg axes': {
      const groupIdx = sub.rest.indexOf('--group-by');
      const groupBy = groupIdx >= 0 ? sub.rest[groupIdx + 1] : undefined;
      dkgAxes({ ...parsePage(sub.rest), groupBy });
      return;
    }
    case 'dkg prefixes':
      dkgPrefixes(parsePage(sub.rest));
      return;
    case 'dkg domains':
      dkgDomains(parsePage(sub.rest));
      return;
    case 'dkg flow-schemas':
      dkgFlowSchemas(parsePage(sub.rest));
      return;
    case 'dkg flow-schema':
      if (sub.rest[0]) dkgFlowSchema(sub.rest[0]);
      else console.error('Usage: qa-sdk dkg flow-schema <id>');
      return;
    case 'dkg impact':
      if (sub.rest[0]) dkgImpact(sub.rest[0]);
      else console.error('Usage: qa-sdk dkg impact <axisId>');
      return;
    case 'dkg overlaps':
      dkgOverlaps();
      return;
    case 'dkg history':
      dkgHistory({ limit: parseInt(sub.rest[sub.rest.indexOf('--limit') + 1]) || 10 });
      return;
    case 'dkg skew':
      dkgSkew();
      return;
    case 'dkg coverage':
      dkgCoverage();
      return;
    case 'dkg skills':
      dkgSkills(sub.rest[0]);
      return;
    case 'dkg audit':
      dkgAudit();
      return;
    case 'dkg transitions':
      dkgTransitions(sub.rest[0]);
      return;
    case 'dkg transition': {
      const arg = sub.rest[0];
      if (arg === 'coverage' || arg === 'orphans' || arg === 'violations') {
        dkgTransitionAnalysis(arg);
      } else {
        dkgTransitions(arg);
      }
      return;
    }
    case 'dkg export':
      dkgExport({ output: sub.rest[sub.rest.indexOf('--output') + 1] });
      return;
    case 'dkg import':
      if (sub.rest[0]) dkgImport({ input: sub.rest[0] });
      else console.error('Usage: qa-sdk dkg import <path>');
      return;
    case 'dkg decisions export':
      dkgDecisionsExport({ output: sub.rest[sub.rest.indexOf('--output') + 1] });
      return;
    case 'dkg decisions import':
      if (sub.rest[0]) dkgDecisionsImport({ input: sub.rest[0] });
      else console.error('Usage: qa-sdk dkg decisions import <path>');
      return;
    case 'dkg decisions list': {
      const dlLimit = sub.rest.indexOf('--limit');
      const dlKind = sub.rest.indexOf('--kind');
      dkgDecisionsList({
        limit: dlLimit >= 0 ? parseInt(sub.rest[dlLimit + 1]) : undefined,
        kind: dlKind >= 0 ? sub.rest[dlKind + 1] : undefined,
      });
      return;
    }
    case 'dkg observations':
      dkgObservations(parsePage(sub.rest));
      return;
    case 'dkg decisions':
      dkgDecisions(parsePage(sub.rest));
      return;
    case 'dkg constraints':
      dkgConstraints(parsePage(sub.rest));
      return;
    case 'dkg service':
      dkgService(sub.rest[0]);
      return;
    case 'prefix stamp': {
      if (!loadedCatalog) { console.error('카탈로그 로딩 실패'); return; }
      const psServiceIdx = sub.rest.indexOf('--service');
      prefixStamp(loadedCatalog, {
        update: sub.rest.includes('--update'),
        dryRun: sub.rest.includes('--dry-run'),
        service: psServiceIdx >= 0 ? sub.rest[psServiceIdx + 1] : undefined,
        paths: sub.rest.filter(a => !a.startsWith('--') && (psServiceIdx < 0 || sub.rest.indexOf(a) !== psServiceIdx + 1)),
      });
      return;
    }
    case 'prefix drift':
      if (!loadedCatalog) { console.error('카탈로그 로딩 실패'); return; }
      prefixDrift(loadedCatalog, sub.rest.filter(a => !a.startsWith('--')));
      return;
    case 'prefix find': {
      if (!loadedCatalog) { console.error('카탈로그 로딩 실패'); return; }
      const pfDimIdx = sub.rest.indexOf('--dim');
      const pfVerIdx = sub.rest.indexOf('--version');
      prefixFind(loadedCatalog, sub.rest[0]?.startsWith('--') ? undefined : sub.rest[0], {
        dim: pfDimIdx >= 0 ? sub.rest[pfDimIdx + 1] : undefined,
        version: pfVerIdx >= 0 ? sub.rest[pfVerIdx + 1] : undefined,
        summary: sub.rest.includes('--summary'),
      });
      return;
    }
    case 'prefix migrate': {
      if (!loadedCatalog) { console.error('카탈로그 로딩 실패'); return; }
      const [pmPrefix, pmFrom, pmTo] = sub.rest.filter(a => !a.startsWith('--'));
      if (!pmPrefix || !pmFrom || !pmTo) {
        console.error('Usage: qa-sdk prefix migrate <prefixId> <fromVersion> <toVersion> [--dry-run]');
        return;
      }
      prefixMigrate(loadedCatalog, pmPrefix, pmFrom, pmTo, { dryRun: sub.rest.includes('--dry-run') });
      return;
    }
    case 'prefix impact':
      if (!loadedCatalog) { console.error('카탈로그 로딩 실패'); return; }
      if (!sub.rest[0]) { console.error('Usage: qa-sdk prefix impact <prefixId>'); return; }
      prefixImpact(loadedCatalog, sub.rest[0]);
      return;
    case 'dkg prefix':
      if (sub.rest[0]) dkgPrefix(sub.rest[0]);
      else console.error('Usage: qa-sdk dkg prefix <id>');
      return;
    case 'dkg dsl':
      dkgDsl(sub.rest[0]);
      return;
    case 'dkg tables':
      dkgTables();
      return;
    case 'dkg table':
      if (sub.rest[0]) dkgTable(sub.rest[0]);
      else console.error('Usage: qa-sdk dkg table <id>');
      return;
    case 'dkg scan-tables':
      dkgScanTables();
      return;
    case 'dkg overview':
      dkgOverview();
      return;
    case 'dkg claims':
      dkgClaims();
      return;
    case 'dkg timeline':
      dkgTimeline({ open: sub.rest.includes('--open') });
      return;
    case 'dkg resolve': {
      const resObsId = sub.rest[0];
      const resDecIdx = sub.rest.indexOf('--decision');
      const resOutIdx = sub.rest.indexOf('--outcome');
      const resNoteIdx = sub.rest.indexOf('--note');
      if (!resObsId || resDecIdx < 0 || resOutIdx < 0) {
        console.error(
          'Usage: qa-sdk dkg resolve <obsId> --decision <decId> --outcome accepted|deferred|rejected [--note ...]',
        );
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
    case 'dkg link': {
      const linkObsId = sub.rest[0];
      const linkDecIdx = sub.rest.indexOf('--decision');
      if (!linkObsId || linkDecIdx < 0) {
        console.error('Usage: qa-sdk dkg link <obsId> --decision <decId>');
        return;
      }
      dkgLink({ obsId: linkObsId, decisionId: sub.rest[linkDecIdx + 1] });
      return;
    }
    case 'dkg run': {
      const runSkillId = sub.rest[0];
      if (!runSkillId) {
        console.error('Usage: qa-sdk dkg run <skillId> [args...]');
        console.error('  qa-sdk dkg skills 로 목록 확인');
        return;
      }
      dkgRun(runSkillId, sub.rest.slice(1));
      return;
    }
    case 'dkg metrics':
      dkgMetrics();
      return;
    case 'dkg converge':
      dkgConverge({
        persist: sub.rest.includes('--persist'),
        verbose: sub.rest.includes('--verbose'),
      });
      return;
    case 'dkg spec add': {
      const saId = sub.rest[sub.rest.indexOf('--id') + 1];
      const saType = sub.rest[sub.rest.indexOf('--type') + 1];
      const saTitle = sub.rest[sub.rest.indexOf('--title') + 1];
      const saRatIdx = sub.rest.indexOf('--rationale');
      const saGovIdx = sub.rest.indexOf('--governs');
      if (!saId || !saType || !saTitle) {
        console.error(
          'Usage: qa-sdk dkg spec add --id <id> --type <type> --title "..." [--rationale "..."] [--governs <id,...>]',
        );
        return;
      }
      dkgSpecAdd({
        id: saId,
        type: saType,
        title: saTitle,
        rationale: saRatIdx >= 0 ? sub.rest[saRatIdx + 1] : undefined,
        governs: saGovIdx >= 0 ? sub.rest[saGovIdx + 1].split(',') : undefined,
      });
      return;
    }
    case 'dkg spec list':
      dkgSpecList();
      return;
    case 'dkg spec transition': {
      const stSpecId = sub.rest[0];
      const stLifecycle = sub.rest[1];
      if (!stSpecId || !stLifecycle) {
        console.error('Usage: qa-sdk dkg spec transition <specId> <draft|active|deprecated>');
        return;
      }
      dkgSpecTransition(stSpecId, stLifecycle);
      return;
    }
    case 'dkg reset': {
      const resetTarget = sub.rest[0] ?? 'all';
      dkgReset(resetTarget, { confirm: sub.rest.includes('--confirm') });
      return;
    }
    case 'dkg promote':
      dkgPromoteScan();
      return;
    case 'dkg add-entry': {
      const aeAxisId = sub.rest[0];
      const aeEntry = sub.rest[1];
      if (!aeAxisId || !aeEntry) {
        console.error(
          'Usage: qa-sdk dkg add-entry <axis> <entry> [--apply] [--expand-capacity] [--write-file <path>]',
        );
        return;
      }
      const aeWriteIdx = sub.rest.indexOf('--write-file');
      dkgAddEntry({
        axisId: aeAxisId,
        entry: aeEntry,
        apply: sub.rest.includes('--apply'),
        expandCapacity: sub.rest.includes('--expand-capacity'),
        writeFile: aeWriteIdx >= 0 ? sub.rest[aeWriteIdx + 1] : undefined,
      });
      return;
    }
    case 'dkg publish': {
      const pubRegIdx = sub.rest.indexOf('--registry');
      const pubVerIdx = sub.rest.indexOf('--version');
      await dkgPublish({
        registry: pubRegIdx >= 0 ? sub.rest[pubRegIdx + 1] : undefined,
        versionId: pubVerIdx >= 0 ? sub.rest[pubVerIdx + 1] : undefined,
      });
      return;
    }
    case 'dkg version': {
      const vAction = sub.rest[0] ?? 'list';
      const vPrefix = sub.rest[1] ?? '';
      const vVersionId = sub.rest[2] ?? '';
      const vRegIdx = sub.rest.indexOf('--registry');
      await dkgVersion(vAction, vPrefix, vVersionId, {
        registry: vRegIdx >= 0 ? sub.rest[vRegIdx + 1] : undefined,
      });
      return;
    }
    case 'dkg self-check':
      dkgSelfCheck({ apply: sub.rest.includes('--apply'), fast: sub.rest.includes('--fast') });
      return;
    case 'dkg patterns':
      dkgPatterns();
      return;
    case 'dkg pattern-stats':
      dkgPatternStats();
      return;
    case 'dkg discover-links':
      dkgDiscoverLinks();
      return;
    case 'dkg diagram': {
      const { dkgDiagram } = await import('./commands/dkg.js');
      await dkgDiagram(sub.rest);
      break;
    }
    case 'dkg trace':
      if (sub.rest[0]) dkgTrace(sub.rest[0]);
      else console.error('Usage: qa-sdk dkg trace <nodeId>');
      return;
    case 'dkg decide': {
      const targetIdx = sub.rest.indexOf('--target');
      const typeIdx = sub.rest.indexOf('--type');
      const titleIdx = sub.rest.indexOf('--title');
      const rationaleIdx = sub.rest.indexOf('--rationale');
      if (targetIdx < 0 || typeIdx < 0 || titleIdx < 0 || rationaleIdx < 0) {
        console.error(
          'Usage: qa-sdk dkg decide --target <id> --type <type> --title "..." --rationale "..." [--alternatives "alt1|alt2"] [--confidence 0.8] [--spec <specId>] [--legacy] [--force]',
        );
        console.error('  types: capacity, new-axis, new-prefix, dim-add, merge, deprecate');
        return;
      }
      const specIdx = sub.rest.indexOf('--spec');
      const alternativesIdx = sub.rest.indexOf('--alternatives');
      const confidenceIdx = sub.rest.indexOf('--confidence');
      const confidence =
        confidenceIdx >= 0 ? Number.parseFloat(sub.rest[confidenceIdx + 1] ?? '') : undefined;
      const hasValidConfidence = confidence !== undefined && Number.isFinite(confidence);
      if (confidenceIdx >= 0 && (!hasValidConfidence || confidence < 0 || confidence > 1)) {
        console.error('  --confidence는 0~1 숫자여야 합니다.');
        return;
      }
      if (alternativesIdx >= 0 && !sub.rest[alternativesIdx + 1]) {
        console.error('  --alternatives는 "alt1|alt2" 형식으로 전달하세요.');
        return;
      }
      await dkgDecide({
        target: sub.rest[targetIdx + 1],
        type: sub.rest[typeIdx + 1],
        title: sub.rest[titleIdx + 1],
        rationale: sub.rest[rationaleIdx + 1],
        alternatives:
          alternativesIdx >= 0
            ? sub.rest[alternativesIdx + 1]
                .split('|')
                .map((value) => value.trim())
                .filter(Boolean)
            : undefined,
        confidence,
        spec: specIdx >= 0 ? sub.rest[specIdx + 1] : undefined,
        legacy: sub.rest.includes('--legacy'),
        force: sub.rest.includes('--force'),
      });
      return;
    }
    case 'dkg observe': {
      const obsTargetIdx = sub.rest.indexOf('--target');
      const findingIdx = sub.rest.indexOf('--finding');
      if (obsTargetIdx < 0 || findingIdx < 0) {
        console.error('Usage: qa-sdk dkg observe --target <id> --finding "..."');
        return;
      }
      const suggIdx = sub.rest.indexOf('--suggestion');
      dkgObserve({
        target: sub.rest[obsTargetIdx + 1],
        finding: sub.rest[findingIdx + 1],
        suggestion: suggIdx >= 0 ? sub.rest[suggIdx + 1] : undefined,
      });
      return;
    }
    case 'dkg claim': {
      const claimTarget = sub.rest[0];
      const byIdx = sub.rest.indexOf('--by');
      if (!claimTarget || byIdx < 0) {
        console.error('Usage: qa-sdk dkg claim <id> --by <worker> [--reason "..."]');
        return;
      }
      const reasonIdx = sub.rest.indexOf('--reason');
      dkgClaim({
        target: claimTarget,
        by: sub.rest[byIdx + 1],
        reason: reasonIdx >= 0 ? sub.rest[reasonIdx + 1] : undefined,
      });
      return;
    }
    case 'dkg release':
      if (sub.rest[0]) dkgRelease(sub.rest[0]);
      else console.error('Usage: qa-sdk dkg release <id>');
      return;

    // Service 명령어
    case 'service list':
      await serviceList(sub.rest);
      return;
    case 'service show':
      await serviceShow(sub.rest);
      return;
    case 'service health':
      await serviceHealth(sub.rest);
      return;
    case 'service health-all':
      await serviceHealthAll(sub.rest);
      return;
    case 'service mode':
      await serviceMode(sub.rest);
      return;
    case 'service owners':
      await serviceOwners(sub.rest);
      return;
    case 'service cleanup-plan':
      await serviceCleanupPlan(sub.rest);
      return;
    case 'service cleanup-draft':
      await serviceCleanupDraft(sub.rest);
      return;
    case 'service cleanup-activate':
      await serviceCleanupActivate(sub.rest);
      return;
    case 'service cleanup-execute':
      await serviceCleanupExecute(sub.rest);
      return;
    case 'service app list':
      serviceAppList(sub.rest);
      return;
    case 'service app show':
      serviceAppShow(sub.rest);
      return;
    case 'service endpoints':
      await serviceEndpoints(sub.rest);
      return;

    // Ingest 명령어
    case 'ingest health':
      await ingestHealth(sub.rest);
      return;
    case 'ingest send':
      await ingestSend(sub.rest);
      return;
    case 'ingest recent':
      await ingestRecent(sub.rest);
      return;
    case 'ingest trace':
      await ingestTrace(sub.rest);
      return;
    case 'ingest status':
      await ingestStatus(sub.rest);
      return;
    case 'ingest services':
      await ingestServices(sub.rest);
      return;
    case 'ingest mode':
      await ingestMode(sub.rest);
      return;
    case 'ingest insights':
      await ingestInsights(sub.rest);
      return;

    // Gate 명령어
    case 'gate health':
      await gateHealth(sub.rest);
      return;
    case 'gate check':
      await gateCheck(sub.rest);
      return;
    case 'gate classify':
      await gateClassify(sub.rest);
      return;

    // Query 명령어
    case 'query health':
      await queryHealth(sub.rest);
      return;
    case 'query resolve':
      await queryResolve(sub.rest);
      return;
    case 'query rules':
      await queryRules(sub.rest);
      return;

    // Definition Catalog 명령어
    case 'def scan':
      await cliDef(['scan', ...sub.rest]);
      return;
    case 'def scan-audit':
      await cliDef(['scan-audit', ...sub.rest]);
      return;
    case 'def topdown':
      await cliDef(['topdown', ...sub.rest]);
      return;
    case 'def bottomup':
      await cliDef(['bottomup', ...sub.rest]);
      return;
    case 'def context':
      await cliDef(['context', ...sub.rest]);
      return;
    case 'def boundary':
      await cliDef(['boundary', ...sub.rest]);
      return;
    case 'def boundary-context':
      await cliDef(['boundary-context', ...sub.rest]);
      return;
    case 'def audit':
      await cliDef(['audit', ...sub.rest]);
      return;
    case 'def validate':
      await cliDef(['validate', ...sub.rest]);
      return;
    case 'def stats':
      await cliDef(['stats', ...sub.rest]);
      return;
    case 'def sync':
      await cliDef(['sync', ...sub.rest]);
      return;
    case 'def read':
      await cliDef(['read', ...sub.rest]);
      return;
    case 'def list':
      await cliDef(['list', ...sub.rest]);
      return;
    case 'def get':
      await cliDef(['get', ...sub.rest]);
      return;
    case 'def body':
      await cliDef(['body', ...sub.rest]);
      return;
    case 'def children':
      await cliDef(['children', ...sub.rest]);
      return;
    case 'def parent':
      await cliDef(['parent', ...sub.rest]);
      return;
    case 'def incoming':
      await cliDef(['incoming', ...sub.rest]);
      return;
    case 'def search':
      await cliDef(['search', ...sub.rest]);
      return;
    case 'def concepts':
      await cliDef(['concepts', ...sub.rest]);
      return;
    case 'def impact':
      await cliDef(['impact', ...sub.rest]);
      return;
    case 'def check':
      await cliDef(['check', ...sub.rest]);
      return;
    case 'def audit-db':
      await cliDef(['audit-db', ...sub.rest]);
      return;
    case 'def overview':
      await cliDef(['overview', ...sub.rest]);
      return;
    case 'def link-rules':
      await cliDef(['link-rules']);
      return;
    case 'def find-by-file':
      await cliDef(['find-by-file', ...sub.rest]);
      return;
    case 'def guide':
      await cliDef(['guide', ...sub.rest]);
      return;
    case 'def help':
      await cliDef(['help', ...sub.rest]);
      return;
    case 'def state':
      await cliDef(['state', ...sub.rest]);
      return;
    case 'def':
      await cliDef(sub.rest);
      return;

    // Quality Gate 명령어
    case 'quality list':
      await cliQuality(['list', ...sub.rest]);
      return;
    case 'quality status':
      await cliQuality(['status', ...sub.rest]);
      return;
    case 'quality export':
      await cliQuality(['export', ...sub.rest]);
      return;
    case 'quality bundle':
      await cliQuality(['bundle', ...sub.rest]);
      return;
    case 'quality claims':
      await cliQuality(['claims', ...sub.rest]);
      return;
    case 'quality show':
      await cliQuality(['show', ...sub.rest]);
      return;
    case 'quality run':
      await cliQuality(['run', ...sub.rest]);
      return;
    case 'quality next':
      await cliQuality(['next', ...sub.rest]);
      return;
    case 'quality diagnose':
      await cliQuality(['diagnose', ...sub.rest]);
      return;
    case 'quality':
      await cliQuality(sub.rest);
      return;

    // Catalog 명령어
    case 'catalog list': {
      const reg = getCatalogRegistry();
      const catalogs = reg.listCatalogs();
      if (catalogs.length === 0) {
        console.log('  등록된 카탈로그 없음');
      } else {
        console.log(`\n══ Catalogs (${catalogs.length}) ══\n`);
        for (const c of catalogs) {
          console.log(`  ${c.id.padEnd(15)} ${c.name.padEnd(20)} prefixes=${c.prefixCount}`);
        }
      }
      return;
    }
    case 'catalog info': {
      const infoId = sub.rest[0];
      if (!infoId) {
        console.error('Usage: qa-sdk catalog info <id>');
        return;
      }
      const reg = getCatalogRegistry();
      if (!reg.has(infoId)) {
        console.error(
          `카탈로그 '${infoId}' 없음. 사용 가능: ${reg
            .listCatalogs()
            .map((c) => c.id)
            .join(', ')}`,
        );
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

    // Decision Flow
    case 'flow list':
      flowList();
      return;
    case 'flow start':
      flowStart(sub.rest);
      return;
    case 'flow select':
      flowSelect(sub.rest);
      return;
    case 'flow status':
      flowStatus(sub.rest);
      return;
    case 'flow trace':
      flowTrace(sub.rest);
      return;
    case 'flow analyze':
      flowAnalyze(sub.rest);
      return;
    case 'flow compare':
      flowCompare(sub.rest);
      return;
    case 'flow policy candidates':
      flowPolicyCandidates(sub.rest);
      return;
    case 'flow policy approve':
      flowPolicyApprove(sub.rest);
      return;
    case 'flow policy reject':
      flowPolicyReject(sub.rest);
      return;
    case 'flow policy list':
      flowPolicyList();
      return;
    case 'flow policy learn':
      flowPolicyLearn(sub.rest);
      return;
    case 'flow lookup':
      flowLookup(sub.rest);
      return;
    case 'flow history':
      flowHistory(sub.rest);
      return;
    case 'flow verdict':
      flowVerdict(sub.rest);
      return;
    case 'flow judge':
      flowJudge(sub.rest);
      return;

    // ── review ───────────────────────────────────────
    case 'review mark':
      reviewMark(sub.rest);
      return;
    case 'review status':
      reviewStatus(sub.rest);
      return;
    case 'review dashboard':
      reviewDashboard(sub.rest);
      return;
    case 'review log':
      reviewLog(sub.rest);
      return;
    case 'review request':
      await reviewRequest(sub.rest);
      return;
    case 'review requests':
      reviewRequests(sub.rest);
      return;
    case 'review show-request':
      reviewShowRequest(sub.rest);
      return;
    case 'review bridge-request':
      reviewBridgeRequest(sub.rest);
      return;

    // Test 하네스 명령어
    case 'test scan': {
      const { values } = parseArgs({
        args: sub.rest,
        options: { dir: { type: 'string' }, db: { type: 'string' } },
        strict: false,
      });
      testScan({ dir: values['dir'] as string | undefined, db: values['db'] as string | undefined });
      return;
    }
    case 'test assign': {
      const { values } = parseArgs({
        args: sub.rest,
        options: {
          'a-coord': { type: 'string' },
          force: { type: 'boolean' },
          db: { type: 'string' },
        },
        strict: false,
      });
      testAssign({ aCoord: values['a-coord'] as string | undefined, force: values['force'] as boolean | undefined, db: values['db'] as string | undefined });
      return;
    }
    case 'test scaffold': {
      const { values } = parseArgs({
        args: sub.rest,
        options: { 'b-coord': { type: 'string' }, mirror: { type: 'string' }, db: { type: 'string' } },
        strict: false,
      });
      testScaffold({ bCoord: values['b-coord'] as string | undefined, mirror: values['mirror'] as string | undefined, db: values['db'] as string | undefined });
      return;
    }
    case 'test status': {
      const { values } = parseArgs({
        args: sub.rest,
        options: { db: { type: 'string' } },
        strict: false,
      });
      testStatus({ db: values['db'] as string | undefined });
      return;
    }
    case 'test report': {
      const { values } = parseArgs({
        args: sub.rest,
        options: { db: { type: 'string' } },
        strict: false,
      });
      testReport({ db: values['db'] as string | undefined });
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

export function resolveSubcommand(args: string[]): Subcommand {
  // 3단어: "dkg decisions export" 등
  const threeWord = [
    'motion workspace list',
    'motion workspace show',
    'motion workspace create',
    'motion workspace delete',
    'motion scene list',
    'motion scene show',
    'motion scene create',
    'motion scene delete',
    'dkg decisions export',
    'dkg decisions import',
    'dkg decisions list',
    'dkg spec add',
    'dkg spec list',
    'dkg spec transition',
    'flow policy candidates',
    'flow policy approve',
    'flow policy reject',
    'flow policy list',
    'flow policy learn',
    'service app list',
    'service app show',
  ];
  if (args.length >= 3) {
    const candidate = `${args[0]} ${args[1]} ${args[2]}`;
    if (threeWord.includes(candidate)) {
      return { name: candidate, rest: args.slice(3) };
    }
  }
  // 2단어: "scan git", "spec list", "spec resolve", "spec validate"
  const twoWord = [
    'motion validate',
    'motion inspect',
    'motion export',
    'motion import',
    'motion apply',
    'motion preview',
    'scan git',
    'git conflicts',
    'spec list',
    'spec resolve',
    'spec validate',
    'spec trace',
    'spec decode',
    'spec codegen',
    'spec drift',
    'dkg report',
    'dkg refresh',
    'dkg axes',
    'dkg prefixes',
    'dkg domains',
    'dkg impact',
    'dkg overlaps',
    'dkg history',
    'dkg skew',
    'dkg coverage',
    'dkg skills',
    'dkg export',
    'dkg import',
    'dkg flow-schemas',
    'dkg flow-schema',
    'dkg service',
    'dkg prefix',
    'dkg dsl',
    'dkg overview',
    'dkg trace',
    'dkg decide',
    'dkg observe',
    'dkg claim',
    'dkg release',
    'dkg claims',
    'dkg resolve',
    'dkg link',
    'dkg timeline',
    'dkg run',
    'dkg metrics',
    'dkg converge',
    'dkg self-check',
    'dkg promote',
    'dkg reset',
    'dkg add-entry',
    'dkg publish',
    'dkg version',
    'dkg patterns',
    'dkg pattern-stats',
    'dkg diagram',
    'dkg tables',
    'dkg table',
    'dkg scan-tables',
    'dkg transitions',
    'dkg transition',
    'dkg audit',
    'dkg discover-links',
    'dkg observations',
    'dkg decisions',
    'dkg constraints',
    'service list', 'service health-all', 'service mode',
    'service show',
    'service health',
    'service owners',
    'service endpoints',
    'service cleanup-plan',
    'service cleanup-draft',
    'service cleanup-activate',
    'service cleanup-execute',
    'ingest health',
    'ingest send',
    'ingest recent',
    'ingest trace',
    'ingest status',
    'ingest services',
    'ingest mode',
    'ingest insights',
    'gate health',
    'gate check',
    'gate classify',
    'query health',
    'query resolve',
    'query rules',
    'def scan',
    'def scan-audit',
    'def topdown',
    'def bottomup',
    'def context',
    'def boundary',
    'def boundary-context',
    'def audit',
    'def validate',
    'def stats',
    'def sync',
    'def read',
    'def list',
    'def get',
    'def body',
    'def children',
    'def parent',
    'def incoming',
    'def search',
    'def concepts',
    'def impact',
    'def check',
    'def audit-db',
    'def overview',
    'def link-rules',
    'def find-by-file',
    'def guide',
    'def state',
    'quality list',
    'quality status',
    'quality export',
    'quality bundle',
    'quality claims',
    'quality show',
    'quality run',
    'quality next',
    'quality diagnose',
    'review mark',
    'review status',
    'review dashboard',
    'review log',
    'review request',
    'review requests',
    'review show-request',
    'review bridge-request',
    'prefix stamp',
    'prefix drift',
    'prefix find',
    'prefix migrate',
    'prefix impact',
    'catalog list',
    'catalog info',
    'obs read',
    'obs search',
    'obs append',
    'obs backlinks',
    'obs list',
    'obs stats',
    'flow list',
    'flow start',
    'flow select',
    'flow status',
    'flow trace',
    'flow analyze',
    'flow compare',
    'flow lookup',
    'flow history',
    'flow verdict',
    'flow judge',
    'test scan',
    'test assign',
    'test scaffold',
    'test status',
    'test report',
  ];
  if (args.length >= 2) {
    const candidate = `${args[0]} ${args[1]}`;
    if (twoWord.includes(candidate)) {
      return { name: candidate, rest: args.slice(2) };
    }
  }
  // 1단어 커맨드
  const oneWord = [
    'init',
    'register',
    'dry-run',
    'codegen',
    'inspect',
    'encode',
    'decode',
    'resolve',
    'find-version',
    'list-prefixes',
    'list-axes',
    'derive-refs',
    'impact',
    'sync-obsidian',
    'quality',
  ];
  if (oneWord.includes(args[0])) {
    return { name: args[0], rest: args.slice(1) };
  }
  return { name: args.join(' '), rest: [] };
}

// ── scan git ─────────────────────────────────────────

async function runScanGit(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
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
}

// ── git conflicts ────────────────────────────────────

async function runGitConflicts(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
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

  const parsedLimit = Number(values.limit ?? '10');
  if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
    throw new Error('--limit는 1 이상의 숫자여야 함');
  }
  const parsedMaxCommits = Number(values['max-commits'] ?? '12');
  if (!Number.isFinite(parsedMaxCommits) || parsedMaxCommits < 1) {
    throw new Error('--max-commits는 1 이상의 숫자여야 함');
  }
  const parsedIntervalMs = Number(values['interval-ms'] ?? '5000');
  if (!Number.isFinite(parsedIntervalMs) || parsedIntervalMs < 500) {
    throw new Error('--interval-ms는 500 이상의 숫자여야 함');
  }

  const commandOptions = {
    root: values.root ?? '.',
    executionCwd: process.cwd(),
    remote: values.remote ?? 'origin',
    base: values.base,
    current: values.current,
    maxCommitHistory: parsedMaxCommits,
    json: values.json ?? false,
    output: values.output,
    limit: parsedLimit,
    skipFetch: values['skip-fetch'] ?? false,
    skipWorktrees: values['skip-worktrees'] ?? false,
    watch: values.watch ?? false,
    intervalMs: parsedIntervalMs,
  };

  if (values.watch) {
    await watchGitConflicts(commandOptions);
    return;
  }

  await gitConflicts(commandOptions);
}

// ── register ─────────────────────────────────────────

async function runRegister(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      registry: { type: 'string' },
      input: { type: 'string', default: './schemas' },
      'version-id': { type: 'string' },
    },
    strict: true,
  });

  const registryUrl = values.registry ?? process.env.QA_REGISTRY_URL;
  if (!registryUrl) {
    console.error('--registry 또는 $QA_REGISTRY_URL 필요');
    process.exit(1);
  }

  const versionId = values['version-id'];
  if (!versionId) {
    console.error('--version-id 필수');
    process.exit(1);
  }

  await register({
    registry: registryUrl,
    input: values.input ?? './schemas',
    versionId,
  });
}

// ── dry-run ──────────────────────────────────────────

async function runDryRun(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string' },
      change: { type: 'string' },
      registry: { type: 'string' },
    },
    strict: true,
  });

  if (!values.change) {
    console.error('--change <json> 필수. 예: --change \'{"pkg":{"capacity":128}}\'');
    process.exit(1);
  }

  let changes: ChangeScenario;
  try {
    changes = JSON.parse(values.change) as ChangeScenario;
  } catch {
    console.error('--change JSON 파싱 실패');
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
      format: { type: 'string', default: 'ts' },
      input: { type: 'string', default: './schemas' },
      output: { type: 'string', default: './generated' },
      package: { type: 'string', default: 'qa.apm.v1' },
      catalog: { type: 'string' },
      'dkg-config': { type: 'string' },
      'lock-version': { type: 'string' },
      registry: { type: 'string' },
      'catalog-id': { type: 'string' },
      'data-objects': { type: 'string' },
      'test-migration': { type: 'boolean' },
      prefix: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      samples: { type: 'string' },
    },
    strict: true,
  });

  // --data-objects → DataObjectBinding JSON → Typed SDK 생성
  if (values['data-objects']) {
    await codegenDataObjects({
      bindingsPath: values['data-objects'],
      output: values.output ?? './generated',
    });
    return;
  }

  // --test-migration → 라운드트립 검증
  if (values['test-migration']) {
    if (!values.prefix || !values.from || !values.to) {
      console.error(
        'Usage: qa-sdk codegen --test-migration --prefix <id> --from <v1> --to <v2> [--samples 100]',
      );
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
      formats: ['ts'],
      input: values.input ?? './schemas',
      output: values.output ?? './generated',
      registry: values.registry,
      catalogId: values['catalog-id'],
      dkgConfig: values['dkg-config'],
      lockVersion: values['lock-version'],
    });
    return;
  }

  // --catalog 경로 또는 loadedCatalog → Catalog 기반 codegen
  if (values.catalog || values['dkg-config'] || loadedCatalog) {
    await codegen({
      formats: ['ts'],
      input: values.input ?? './schemas',
      output: values.output ?? './generated',
      catalog: values.catalog,
      loadedCatalog: loadedCatalog,
      dkgConfig: values['dkg-config'],
      lockVersion: values['lock-version'],
    });
    return;
  }

  const formats = (values.format ?? 'ts').split(',').map((f) => {
    const trimmed = f.trim();
    if (trimmed !== 'proto' && trimmed !== 'ts') {
      console.error(`지원하지 않는 format: ${trimmed} (proto | ts)`);
      process.exit(1);
    }
    return trimmed as CodegenFormat;
  });

  await codegen({
    formats,
    input: values.input ?? './schemas',
    output: values.output ?? './generated',
    packageName: values.package,
  });
}

// ── inspect ──────────────────────────────────────────

async function runInspect(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      registry: { type: 'string' },
      'snapshot-id': { type: 'string' },
      output: { type: 'string', default: './schemas' },
    },
    strict: true,
  });

  const registryUrl = values.registry ?? process.env.QA_REGISTRY_URL;
  if (!registryUrl) {
    console.error('--registry 또는 $QA_REGISTRY_URL 필요');
    process.exit(1);
  }

  await schemaPull({
    registry: registryUrl,
    output: values.output ?? './schemas',
    snapshotId: values['snapshot-id'],
  });
}

// ── spec 공통: --catalog / --specs 파싱 ─────────────

const SPEC_BASE_OPTIONS = {
  specs: { type: 'string' as const },
  catalog: { type: 'boolean' as const, default: false },
};

function isSchemaValidationInput(value: unknown): value is SchemaValidationInput {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

async function loadCatalogInput(): Promise<CatalogInputLike | undefined> {
  try {
    const { DEMO_CATALOG } = await import('demo-snapshot');
    return DEMO_CATALOG;
  } catch {
    console.error('demo-snapshot 패키지를 로딩할 수 없습니다');
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
    options: { ...SPEC_BASE_OPTIONS, prefix: { type: 'string' }, values: { type: 'string' } },
    strict: true,
  });

  if (!values.prefix || !values.values) {
    console.error('--prefix <id> --values <json> 필수');
    console.error(
      '예: qa-sdk spec resolve --catalog --prefix permission --values \'{"perm_svc":"40","role":"admin"}\'',
    );
    process.exit(1);
  }

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(values.values) as Record<string, string>;
  } catch {
    console.error('--values JSON 파싱 실패');
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
    options: { ...SPEC_BASE_OPTIONS, schema: { type: 'string' }, data: { type: 'string' } },
    strict: true,
  });

  if (!values.schema || !values.data) {
    console.error('--schema <id> --data <json> 필수');
    process.exit(1);
  }

  let parsed: SchemaValidationInput;
  try {
    const raw = JSON.parse(values.data) as unknown;
    if (!isSchemaValidationInput(raw)) throw new Error('invalid');
    parsed = raw;
  } catch {
    console.error('--data JSON 파싱 실패');
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
    options: { ...SPEC_BASE_OPTIONS, id: { type: 'string' } },
    strict: true,
  });

  if (!values.id) {
    console.error('--id <specId> 필수');
    console.error('예: qa-sdk spec trace --id FEAT-003');
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
    options: {
      ...SPEC_BASE_OPTIONS,
      output: { type: 'string' },
      format: { type: 'string', default: 'ts' },
    },
    strict: true,
  });

  await specCodegen({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    output: values.output,
    format: values.format as 'ts' | 'esm' | 'cjs' | 'proto' | 'json-schema',
  });
}

// ── spec decode ─────────────────────────────────────

async function runSpecDecode(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...SPEC_BASE_OPTIONS,
      address: { type: 'string' },
      deep: { type: 'boolean', default: false },
      format: { type: 'string' },
    },
    strict: true,
  });

  if (!values.address) {
    console.error('--address "prefix:version:address" 필수');
    console.error('예: qa-sdk spec decode --catalog --address permission:v1:3');
    console.error('    qa-sdk spec decode --catalog --address permission:v1:3 --deep');
    process.exit(1);
  }

  await specDecode({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    address: values.address,
    deep: values.deep,
    format: values.format === 'json' ? 'json' : 'text',
  });
}

// ── DX: encode ──────────────────────────────────────

function runEncode(argv: string[]) {
  const prefix = argv[0];
  if (!prefix) {
    console.error('Usage: qa-sdk encode <prefix> --dim1 val1 --dim2 val2');
    return;
  }

  const dims: Record<string, string | number> = {};
  for (let i = 1; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    const val = argv[i + 1];
    if (key && val) dims[key] = val;
  }

  const json = argv.includes('--json');
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- DX_COMMANDS → needsCatalog → loadedCatalog 보장
  cliEncode(loadedCatalog!, { prefix, dims, json });
}

// ── DX: decode ──────────────────────────────────────

function runDecode(argv: string[]) {
  const address = argv[0];
  if (!address) {
    console.error('Usage: qa-sdk decode "prefix:version:address"');
    return;
  }
  const deep = argv.includes('--deep');
  const json = argv.includes('--json');
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- DX_COMMANDS → needsCatalog → loadedCatalog 보장
  cliDecode(loadedCatalog!, { address, deep, json });
}

// ── DX: resolve ─────────────────────────────────────

function runResolve(argv: string[]) {
  const address = argv[0];
  if (!address) {
    console.error('Usage: qa-sdk resolve "prefix:version:address"');
    return;
  }
  const json = argv.includes('--json');
  const toIdx = argv.indexOf('--to');
  const to = toIdx >= 0 ? argv[toIdx + 1] : undefined;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- DX_COMMANDS → needsCatalog → loadedCatalog 보장
  cliResolve(loadedCatalog!, { address, to, json });
}

// ── DX: find-version ────────────────────────────────

function runFindVersion(argv: string[]) {
  const axis = argv[0];
  const entry = argv[1];
  if (!axis || !entry) {
    console.error('Usage: qa-sdk find-version <axis> <entry>');
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- DX_COMMANDS → needsCatalog → loadedCatalog 보장
  cliFindVersion(loadedCatalog!, { axis, entry });
}

// ── DX: impact ──────────────────────────────────────

async function runImpactCmd(argv: string[]) {
  const axisIdx = argv.indexOf('--axis');
  const prefixIdx = argv.indexOf('--prefix');
  // DkgConfig는 동적 로드 (demo-snapshot fallback)
  const { DEMO_DKG_CONFIG } = await import('demo-snapshot');
  const dkgConfig = DEMO_DKG_CONFIG;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- DX_COMMANDS → needsCatalog → loadedCatalog 보장
  if (axisIdx >= 0) cliImpact(loadedCatalog!, dkgConfig, { axis: argv[axisIdx + 1] });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- DX_COMMANDS → needsCatalog → loadedCatalog 보장
  else if (prefixIdx >= 0) cliImpact(loadedCatalog!, dkgConfig, { prefix: argv[prefixIdx + 1] });
  else console.error('Usage: qa-sdk impact --axis <id> or --prefix <id>');
}

// ── sync-obsidian ───────────────────────────────────

function runSyncObsidian(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      vault: { type: 'string', default: 'spec-prefix' },
      'dry-run': { type: 'boolean', default: false },
    },
    strict: true,
  });

  syncObsidian({
    vault: values.vault ?? 'spec-prefix',
    dryRun: values['dry-run'] ?? false,
  });
}

// ── init ─────────────────────────────────────────────

async function runInit(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      from: { type: 'string' },
      'vite-consumer': { type: 'string' },
      'service-name': { type: 'string' },
      'owner-id': { type: 'string' },
      'build-env': { type: 'string' },
      force: { type: 'boolean', default: false },
    },
    strict: true,
  });
  await init({
    from: values.from,
    viteConsumer: values['vite-consumer'],
    serviceName: values['service-name'],
    ownerId: values['owner-id'],
    buildEnv: values['build-env'],
    force: values.force ?? false,
  });
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
