import { parseArgs } from "node:util";
import {
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
} from "../command-spec.js";
import { gitScan } from "../commands/git-scan.js";

type RestCommandHandler = (rest: string[]) => Promise<void> | void;

export const SCAN_COMMAND_DESCRIPTORS = [
  { id: "scan.git", path: ["git"], usage: "qa-sdk scan git [options]          Git 메타데이터 수집 → SchemaSnapshot", handlerKey: "scan.git" },
] as const satisfies readonly CommandDescriptor[];

export const SCAN_COMMAND_TREE =
  descriptorsToTree(SCAN_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const SCAN_HANDLER_REGISTRY = {
  "scan.git": async (rest: string[]) => {
    const { values } = parseArgs({
      args: rest,
      options: {
        root: { type: "string", default: "." },
        output: { type: "string", default: "./schemas" },
        id: { type: "string" },
      },
      strict: true,
    });
    await gitScan({
      root: values.root ?? ".",
      output: values.output ?? "./schemas",
      id: values.id,
    });
  },
} satisfies Readonly<Record<string, RestCommandHandler>>;
