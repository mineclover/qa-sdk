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
  { id: "query.health", path: ["health"], usage: "qa-sdk query health                query-service 헬스체크", handlerKey: "query.health" },
  { id: "query.resolve", path: ["resolve"], usage: "qa-sdk query resolve --coord d=v   정책 해석", handlerKey: "query.resolve" },
  { id: "query.rules", path: ["rules"], usage: "qa-sdk query rules                 정책 규칙 목록", handlerKey: "query.rules" },
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
