import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
import { cliDecision } from "../commands/decision/index.js";

export const DECISION_COMMAND_DESCRIPTORS = [
  { id: "decision.help", path: ["help"], handlerKey: "decision.help" },
  { id: "decision.sync", path: ["sync"], handlerKey: "decision.sync" },
  { id: "decision.analyze", path: ["analyze"], handlerKey: "decision.analyze" },
] as const satisfies readonly CommandDescriptor[];

export const DECISION_COMMAND_TREE =
  descriptorsToTree(DECISION_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const DECISION_COMMAND_SPECS =
  collectCommandUsageSpecs(["decision"], DECISION_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const DECISION_TOP_LEVEL_USAGE_LINES = [
  "qa-sdk decision sync [ref]       yaml ↔ markdown decision 양방향 동기화 (commit 생성)",
  "qa-sdk decision analyze [ref]    decision → FlowSchema 변환 + decision-flow 분석",
] as const;

export const DECISION_HANDLER_REGISTRY = new Proxy({} as Record<string, RestCommandHandler>, {
  get(_target, prop) {
    if (typeof prop !== "string" || !prop.startsWith("decision.")) return undefined;
    return async (rest: string[]) => {
      const subcommand = prop.slice("decision.".length);
      await cliDecision([...subcommand.split("."), ...rest]);
    };
  },
});
