// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
import {
  ingestHealth,
  ingestInsights,
  ingestMode,
  ingestRecent,
  ingestSend,
  ingestServices,
  ingestStatus,
  ingestTrace,
} from "../commands/ingest.js";

export const INGEST_COMMAND_DESCRIPTORS = [
  {
    id: "ingest.health",
    path: ["health"],
    usage: "qa-sdk ingest health [options]",
    description: "수집 서버 헬스체크",
    options: [
      { flag: "--env", valueHint: "dev|prod|staging", type: "string", description: "환경 프로필" },
      { flag: "--ingest", valueHint: "<url>", type: "string", description: "Ingest 서버 URL 오버라이드" },
    ],
    handlerKey: "ingest.health",
  },
  {
    id: "ingest.send",
    path: ["send"],
    usage: "qa-sdk ingest send [eventKey] [options]",
    description: "테스트 이벤트 전송",
    args: [
      { name: "eventKey", description: "이벤트 키 (기본: test.ping)" },
    ],
    options: [
      { flag: "--dim", valueHint: "key=value", type: "string", description: "차원 값 지정 (예: --dim user.id=123)" },
      { flag: "--ingest", valueHint: "<url>", type: "string", description: "Ingest 서버 URL 오버라이드" },
    ],
    handlerKey: "ingest.send",
  },
  {
    id: "ingest.recent",
    path: ["recent"],
    usage: "qa-sdk ingest recent [limit] [options]",
    description: "최근 수집 세션 목록",
    args: [
      { name: "limit", description: "조회 개수 (기본: 10)" },
    ],
    options: [
      { flag: "--ingest", valueHint: "<url>", type: "string", description: "Ingest 서버 URL 오버라이드" },
    ],
    handlerKey: "ingest.recent",
  },
  {
    id: "ingest.trace",
    path: ["trace"],
    usage: "qa-sdk ingest trace <traceId> [options]",
    description: "trace 상세 (records + verdicts)",
    args: [
      { name: "traceId", required: true, description: "Trace ID" },
    ],
    options: [
      { flag: "--ingest", valueHint: "<url>", type: "string", description: "Ingest 서버 URL 오버라이드" },
    ],
    handlerKey: "ingest.trace",
  },
  {
    id: "ingest.status",
    path: ["status"],
    usage: "qa-sdk ingest status [options]",
    description: "수집 파이프라인 상태 요약",
    options: [
      { flag: "--ingest", valueHint: "<url>", type: "string", description: "Ingest 서버 URL 오버라이드" },
    ],
    handlerKey: "ingest.status",
  },
  {
    id: "ingest.services",
    path: ["services"],
    usage: "qa-sdk ingest services [options]",
    description: "서비스 URL 맵 (registry 기반)",
    options: [
      { flag: "--registry", valueHint: "<url>", type: "string", description: "Registry 서버 URL 오버라이드" },
      { flag: "--env", valueHint: "dev|prod|staging", type: "string", description: "환경 프로필" },
    ],
    handlerKey: "ingest.services",
  },
  {
    id: "ingest.mode",
    path: ["mode"],
    usage: "qa-sdk ingest mode [local|dev|staging|prod] [--set key=value]",
    description: "환경 모드 전환 (local|dev|staging|prod)",
    args: [
      { name: "mode", description: "전환할 모드" },
    ],
    options: [
      { flag: "--set", valueHint: "key=value", type: "string", description: "개별 설정 수정" },
    ],
    handlerKey: "ingest.mode",
  },
  {
    id: "ingest.insights",
    path: ["insights"],
    usage: "qa-sdk ingest insights [--limit N]",
    description: "인사이트 데이터 조회",
    options: [
      { flag: "--limit", valueHint: "<n>", type: "string", description: "조회 제한" },
      { flag: "--ingest", valueHint: "<url>", type: "string", description: "Ingest 서버 URL 오버라이드" },
    ],
    handlerKey: "ingest.insights",
  },
] as const satisfies readonly CommandDescriptor[];

export const INGEST_COMMAND_TREE =
  descriptorsToTree(INGEST_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const INGEST_COMMAND_SPECS =
  collectCommandUsageSpecs(["ingest"], INGEST_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const INGEST_HANDLER_REGISTRY = {
  "ingest.health": ingestHealth,
  "ingest.send": ingestSend,
  "ingest.recent": ingestRecent,
  "ingest.trace": ingestTrace,
  "ingest.status": ingestStatus,
  "ingest.services": ingestServices,
  "ingest.mode": ingestMode,
  "ingest.insights": ingestInsights,
} satisfies Readonly<Record<string, RestCommandHandler>>;
