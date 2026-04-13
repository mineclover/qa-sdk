import type { CliCommandNode } from "cli-command";
import { discoverHandler } from "./cmd-discover.js";
import { deployHandler } from "./cmd-deploy.js";
import { destroyHandler } from "./cmd-destroy.js";
import { exportHandler } from "./cmd-export.js";
import { statusHandler } from "./cmd-status.js";
import { historyHandler } from "./cmd-history.js";
import { auditHandler } from "./cmd-audit.js";
import { configShowHandler, configUseHandler, configSetHandler, configPresetsHandler } from "./cmd-config.js";
import { pfListHandler, pfCleanupHandler, pfRegisterHandler, pfRemoveHandler } from "./cmd-pf.js";
import { monitorStartHandler, monitorCheckHandler, monitorStatusHandler } from "./cmd-monitor.js";
import { dashboardSummaryHandler, dashboardServiceHandler, dashboardExportHandler } from "./cmd-dashboard.js";
import { envUpHandler, envDownHandler, envStatusHandler, envResetHandler } from "./cmd-env.js";
import { versionListHandler, versionShowHandler, versionRollbackHandler } from "./cmd-version.js";
import { secretsShowHandler, secretsInitHandler, secretsRotateHandler } from "./cmd-secrets.js";
import { enrichmentStartHandler, enrichmentSetupHandler } from "./cmd-enrichment.js";
import { authzGraphHandler } from "./cmd-authz.js";

/** infra-engine CLI 명령 트리 */
export const INFRA_COMMAND_TREE: CliCommandNode[] = [
  {
    segment: "discover",
    description: "서비스 디스커버리",
    handler: discoverHandler,
    options: [
      { flag: "--all", type: "boolean", description: "전체 서비스 URL" },
      { flag: "--list", type: "boolean", description: "서비스 목록" },
      { flag: "--deep", type: "boolean", description: "definition 통합 조회" },
      { flag: "--code", type: "boolean", description: "연결 코드 생성" },
    ],
  },
  {
    segment: "deploy",
    description: "서비스 배포",
    handler: deployHandler,
    args: [{ name: "service", required: true }, { name: "env" }, { name: "config" }],
    options: [
      { flag: "--dry-run", type: "boolean", description: "변경 사항 미리보기" },
      { flag: "--provider", type: "string", description: "프로바이더", choices: ["local", "cloudflare"] },
      { flag: "--all", type: "boolean", description: "전체 서비스 배포" },
      { flag: "--continue-on-error", type: "boolean", description: "실패 시 계속" },
      { flag: "--sync", type: "boolean", description: "배포 후 codegen + cascade 자동 실행" },
      { flag: "--artifact-registry", type: "string", description: "배포 산출물 registry JSON 기록" },
    ],
  },
  {
    segment: "destroy",
    description: "배포 삭제",
    handler: destroyHandler,
    args: [{ name: "service", required: true }, { name: "env" }],
    options: [{ flag: "--yes", type: "boolean", description: "확인 스킵" }],
  },
  {
    segment: "export",
    description: "연결 정보 export",
    handler: exportHandler,
    args: [{ name: "format" }, { name: "target" }, { name: "env" }],
    options: [
      { flag: "--all", type: "boolean", description: "전체 URL 포함" },
      { flag: "--out", type: "string", description: "출력 경로" },
    ],
  },
  {
    segment: "status",
    description: "Fleet 상태",
    handler: statusHandler,
    args: [{ name: "env" }],
  },
  {
    segment: "history",
    description: "배포 이력",
    handler: historyHandler,
    args: [{ name: "service", required: true }],
    options: [{ flag: "--json", type: "boolean", description: "JSON 형식 출력" }],
  },
  {
    segment: "audit",
    description: "registry 감사",
    handler: auditHandler,
  },
  {
    segment: "config",
    description: "인프라 설정 관리",
    children: [
      { segment: "show", description: "현재 설정", handler: configShowHandler },
      { segment: "use", description: "프로필 전환", handler: configUseHandler, args: [{ name: "profile", required: true }] },
      { segment: "set", description: "필드 변경", handler: configSetHandler, args: [{ name: "field", required: true }, { name: "value", required: true }] },
      { segment: "presets", description: "프리셋 목록", handler: configPresetsHandler },
    ],
  },
  {
    segment: "monitor",
    description: "헬스 모니터링",
    children: [
      { segment: "start", description: "sync-loop 시작", handler: monitorStartHandler, options: [{ flag: "--interval", type: "string", description: "체크 간격 (초)" }] },
      { segment: "check", description: "수동 1회 체크", handler: monitorCheckHandler },
      { segment: "status", description: "마지막 결과", handler: monitorStatusHandler },
    ],
  },
  {
    segment: "dashboard",
    description: "대시보드",
    children: [
      { segment: "summary", description: "전체 요약", handler: dashboardSummaryHandler },
      { segment: "service", description: "서비스 상세", handler: dashboardServiceHandler, args: [{ name: "serviceId", required: true }] },
      { segment: "export", description: "JSON export", handler: dashboardExportHandler, args: [{ name: "path" }] },
    ],
  },
  {
    segment: "env",
    description: "로컬 인프라 환경",
    children: [
      { segment: "up", description: "환경 시작", handler: envUpHandler },
      { segment: "down", description: "환경 종료", handler: envDownHandler },
      { segment: "status", description: "환경 상태", handler: envStatusHandler },
      { segment: "reset", description: "초기화", handler: envResetHandler },
    ],
  },
  {
    segment: "pf",
    description: "port-forward 관리",
    children: [
      { segment: "list", description: "활성 목록", handler: pfListHandler },
      {
        segment: "register",
        description: "로컬 서버 포트 수동 등록",
        handler: pfRegisterHandler,
        args: [{ name: "name", required: true }, { name: "port", required: true }],
      },
      { segment: "remove", description: "엔트리 제거", handler: pfRemoveHandler, args: [{ name: "name", required: true }] },
      { segment: "cleanup", description: "죽은 PID 정리", handler: pfCleanupHandler },
    ],
  },
  {
    segment: "version",
    description: "버전 관리",
    children: [
      { segment: "list", description: "배포 버전 목록", handler: versionListHandler, args: [{ name: "env" }] },
      { segment: "show", description: "서비스 버전 상세", handler: versionShowHandler, args: [{ name: "service", required: true }, { name: "env" }] },
      { segment: "rollback", description: "이전 버전으로 롤백 표시", handler: versionRollbackHandler, args: [{ name: "service", required: true }, { name: "env" }] },
    ],
  },
  {
    segment: "secrets",
    description: "시크릿 관리",
    children: [
      { segment: "show", description: "현재 시크릿 (마스킹)", handler: secretsShowHandler },
      { segment: "init", description: "시크릿 초기화", handler: secretsInitHandler },
      { segment: "rotate", description: "시크릿 로테이션", handler: secretsRotateHandler },
    ],
  },
  {
    segment: "enrichment",
    description: "permission enrichment 서버",
    children: [
      { segment: "start", description: "enrichment 서버 시작", handler: enrichmentStartHandler },
      { segment: "setup", description: "Zitadel Action + metadata 설정", handler: enrichmentSetupHandler },
    ],
  },
  {
    segment: "authz",
    description: "authorization ontology topology",
    children: [
      {
        segment: "graph",
        description: "Nginx/Auth proxy config → authorization graph",
        handler: authzGraphHandler,
        options: [
          { flag: "--nginx", type: "string", description: "Nginx config path" },
          { flag: "--env", type: "string", description: "environment label" },
          { flag: "--host", type: "string", description: "external host" },
          { flag: "--proxy-id", type: "string", description: "proxy enforcement id" },
          { flag: "--proxy-kind", type: "string", description: "proxy enforcement kind" },
          { flag: "--policy-map", type: "string", description: "route path → Cerbos policy JSON map" },
          { flag: "--policy-authority", type: "string", description: "default policy authority for string map values" },
          { flag: "--policy-kind", type: "string", description: "default policy kind for string map values" },
          { flag: "--json", type: "boolean", description: "JSON 출력" },
        ],
      },
    ],
  },
];
