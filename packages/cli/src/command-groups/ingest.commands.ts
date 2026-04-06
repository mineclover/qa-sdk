import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
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

type RestCommandHandler = (rest: string[]) => Promise<void> | void;

export const INGEST_COMMAND_DESCRIPTORS = [
  { id: "ingest.health", path: ["health"], usage: "qa-sdk ingest health [--env dev|prod|staging]  수집 서버 헬스체크", handlerKey: "ingest.health" },
  { id: "ingest.send", path: ["send"], usage: "qa-sdk ingest send [eventKey] [--dim prefix.axis=value]  테스트 이벤트 전송", handlerKey: "ingest.send" },
  { id: "ingest.recent", path: ["recent"], usage: "qa-sdk ingest recent [limit]       최근 수집 세션 목록", handlerKey: "ingest.recent" },
  { id: "ingest.trace", path: ["trace"], usage: "qa-sdk ingest trace <traceId>      trace 상세 (records + verdicts)", handlerKey: "ingest.trace" },
  { id: "ingest.status", path: ["status"], usage: "qa-sdk ingest status               수집 파이프라인 상태 요약", handlerKey: "ingest.status" },
  { id: "ingest.services", path: ["services"], usage: "qa-sdk ingest services             서비스 URL 맵 (registry 기반, → service list 권장)", handlerKey: "ingest.services" },
  { id: "ingest.mode", path: ["mode"], usage: "qa-sdk ingest mode [local|dev|staging|prod] [--set key=value]", handlerKey: "ingest.mode" },
  { id: "ingest.insights", path: ["insights"], usage: "qa-sdk ingest insights [--limit N]", handlerKey: "ingest.insights" },
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
