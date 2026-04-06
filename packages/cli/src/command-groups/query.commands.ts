import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
} from "../command-spec.js";
import { queryHealth, queryResolve, queryRules } from "../commands/service-query.js";

type RestCommandHandler = (rest: string[]) => Promise<void> | void;

export const QUERY_COMMAND_DESCRIPTORS = [
  {
    id: "query.health",
    path: ["health"],
    usage: "qa-sdk query health [options]",
    description: "query-service 헬스체크",
    options: [
      { flag: "--query", valueHint: "<url>", type: "string", description: "Query 서버 URL 오버라이드" },
    ],
    handlerKey: "query.health",
  },
  {
    id: "query.resolve",
    path: ["resolve"],
    usage: "qa-sdk query resolve --coord <d=v> [options]",
    description: "정책 해석",
    options: [
      { flag: "--coord", valueHint: "key=value", type: "string", description: "질의할 좌표 (여러 번 지정 가능)" },
      { flag: "--query", valueHint: "<url>", type: "string", description: "Query 서버 URL 오버라이드" },
    ],
    handlerKey: "query.resolve",
  },
  {
    id: "query.rules",
    path: ["rules"],
    usage: "qa-sdk query rules [options]",
    description: "정책 규칙 목록",
    options: [
      { flag: "--query", valueHint: "<url>", type: "string", description: "Query 서버 URL 오버라이드" },
    ],
    handlerKey: "query.rules",
  },
] as const satisfies readonly CommandDescriptor[];

export const QUERY_COMMAND_TREE =
  descriptorsToTree(QUERY_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const QUERY_COMMAND_SPECS =
  collectCommandUsageSpecs(["query"], QUERY_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const QUERY_HANDLER_REGISTRY = {
  "query.health": queryHealth,
  "query.resolve": queryResolve,
  "query.rules": queryRules,
} satisfies Readonly<Record<string, RestCommandHandler>>;
