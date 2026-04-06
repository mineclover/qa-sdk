import { parseArgs } from "node:util";
import {
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
} from "../command-spec.js";
import { gitConflicts, watchGitConflicts } from "../commands/git-conflicts.js";

type RestCommandHandler = (rest: string[]) => Promise<void> | void;

export const GIT_COMMAND_DESCRIPTORS = [
  { id: "git.conflicts", path: ["conflicts"], usage: "qa-sdk git conflicts [options]      Git 충돌/발산 리포트", handlerKey: "git.conflicts" },
] as const satisfies readonly CommandDescriptor[];

export const GIT_COMMAND_TREE =
  descriptorsToTree(GIT_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const GIT_HANDLER_REGISTRY = {
  "git.conflicts": async (rest: string[]) => {
    const { values } = parseArgs({
      args: rest,
      options: {
        root: { type: "string", default: "." },
        remote: { type: "string", default: "origin" },
        base: { type: "string" },
        current: { type: "string" },
        "max-commits": { type: "string", default: "12" },
        json: { type: "boolean", default: false },
        output: { type: "string" },
        watch: { type: "boolean", default: false },
        "interval-ms": { type: "string", default: "5000" },
        limit: { type: "string", default: "10" },
        "skip-fetch": { type: "boolean", default: false },
        "skip-worktrees": { type: "boolean", default: false },
      },
      strict: true,
    });

    const args = {
      root: values.root ?? ".",
      remote: values.remote ?? "origin",
      base: values.base,
      current: values.current,
      maxCommits: parseInt(values["max-commits"] ?? "12", 10),
      json: values.json ?? false,
      output: values.output,
      watch: values.watch ?? false,
      intervalMs: parseInt(values["interval-ms"] ?? "5000", 10),
      limit: parseInt(values.limit ?? "10", 10),
      skipFetch: values["skip-fetch"] ?? false,
      skipWorktrees: values["skip-worktrees"] ?? false,
    };

    if (args.watch) {
      await watchGitConflicts(args);
      return;
    }

    await gitConflicts(args);
  },
} satisfies Readonly<Record<string, RestCommandHandler>>;
