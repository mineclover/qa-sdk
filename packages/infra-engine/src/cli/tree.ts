import type { CliCommandNode } from "cli-command";
import { discoverHandler } from "./cmd-discover.js";
import { deployHandler } from "./cmd-deploy.js";
import { destroyHandler } from "./cmd-destroy.js";
import { exportHandler } from "./cmd-export.js";
import { statusHandler } from "./cmd-status.js";
import { historyHandler } from "./cmd-history.js";
import { auditHandler } from "./cmd-audit.js";
import { configShowHandler, configUseHandler, configSetHandler, configPresetsHandler } from "./cmd-config.js";
import { pfListHandler, pfCleanupHandler } from "./cmd-pf.js";
import { monitorStartHandler, monitorCheckHandler, monitorStatusHandler } from "./cmd-monitor.js";
import { dashboardSummaryHandler, dashboardServiceHandler, dashboardExportHandler } from "./cmd-dashboard.js";
import { envUpHandler, envDownHandler, envStatusHandler, envResetHandler } from "./cmd-env.js";

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
      { segment: "cleanup", description: "죽은 PID 정리", handler: pfCleanupHandler },
    ],
  },
];
