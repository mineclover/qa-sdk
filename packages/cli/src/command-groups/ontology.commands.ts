import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
import { cliOntology } from "../commands/ontology.js";

export const ONTOLOGY_COMMAND_DESCRIPTORS = [
  { id: "ontology.help", path: ["help"], usage: "qa-sdk ontology help                              operational-ontology 도움말", handlerKey: "ontology.help" },
  { id: "ontology.status", path: ["status"], usage: "qa-sdk ontology status [--scope <scope> | --snapshot <id>] [--store <file>] [--json] [--table]", handlerKey: "ontology.status" },
  { id: "ontology.prompt.extract", path: ["prompt", "extract"], usage: "qa-sdk ontology prompt extract <doc-id> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--json]", handlerKey: "ontology.prompt.extract" },
  { id: "ontology.prompt.extract-file", path: ["prompt", "extract-file"], usage: "qa-sdk ontology prompt extract-file <code-path[:symbol]> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--json]", handlerKey: "ontology.prompt.extract-file" },
  { id: "ontology.prompt.extract-permission", path: ["prompt", "extract-permission"], usage: "qa-sdk ontology prompt extract-permission <permission-ref> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--json]", handlerKey: "ontology.prompt.extract-permission" },
  { id: "ontology.prompt.extract-artifact", path: ["prompt", "extract-artifact"], usage: "qa-sdk ontology prompt extract-artifact <artifact-ref> [--artifact-type <type>] [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--json]", handlerKey: "ontology.prompt.extract-artifact" },
  { id: "ontology.snapshot.ingest", path: ["snapshot", "ingest"], usage: "qa-sdk ontology snapshot ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]", handlerKey: "ontology.snapshot.ingest" },
  { id: "ontology.snapshot.list", path: ["snapshot", "list"], usage: "qa-sdk ontology snapshot list [--store <file>] [--scope <scope>] [--json]", handlerKey: "ontology.snapshot.list" },
  { id: "ontology.snapshot.show", path: ["snapshot", "show"], usage: "qa-sdk ontology snapshot show <snapshot-id> [--store <file>] [--json]", handlerKey: "ontology.snapshot.show" },
  { id: "ontology.snapshot.diff", path: ["snapshot", "diff"], usage: "qa-sdk ontology snapshot diff <from-snapshot-id> <to-snapshot-id> [--store <file>] [--json]", handlerKey: "ontology.snapshot.diff" },
  { id: "ontology.snapshot.diff-latest", path: ["snapshot", "diff-latest"], usage: "qa-sdk ontology snapshot diff-latest --scope <scope> [--store <file>] [--json]", handlerKey: "ontology.snapshot.diff-latest" },
  { id: "ontology.corridor.list", path: ["corridor", "list"], usage: "qa-sdk ontology corridor list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]", handlerKey: "ontology.corridor.list" },
  { id: "ontology.corridor.show", path: ["corridor", "show"], usage: "qa-sdk ontology corridor show <corridor-id> --snapshot <snapshot-id> [--store <file>] [--json]", handlerKey: "ontology.corridor.show" },
  { id: "ontology.corridor.show-latest", path: ["corridor", "show-latest"], usage: "qa-sdk ontology corridor show-latest <corridor-id> --scope <scope> [--store <file>] [--json]", handlerKey: "ontology.corridor.show-latest" },
  { id: "ontology.corridor.diff", path: ["corridor", "diff"], usage: "qa-sdk ontology corridor diff <corridor-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]", handlerKey: "ontology.corridor.diff" },
  { id: "ontology.corridor.diff-latest", path: ["corridor", "diff-latest"], usage: "qa-sdk ontology corridor diff-latest <corridor-id> --scope <scope> [--store <file>] [--json]", handlerKey: "ontology.corridor.diff-latest" },
  { id: "ontology.checkpoint.list", path: ["checkpoint", "list"], usage: "qa-sdk ontology checkpoint list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]", handlerKey: "ontology.checkpoint.list" },
  { id: "ontology.checkpoint.show", path: ["checkpoint", "show"], usage: "qa-sdk ontology checkpoint show <root-checkpoint-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]", handlerKey: "ontology.checkpoint.show" },
  { id: "ontology.checkpoint.diff", path: ["checkpoint", "diff"], usage: "qa-sdk ontology checkpoint diff <root-checkpoint-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]", handlerKey: "ontology.checkpoint.diff" },
  { id: "ontology.checkpoint.diff-latest", path: ["checkpoint", "diff-latest"], usage: "qa-sdk ontology checkpoint diff-latest <root-checkpoint-id> --scope <scope> [--store <file>] [--json]", handlerKey: "ontology.checkpoint.diff-latest" },
  { id: "ontology.junction.list", path: ["junction", "list"], usage: "qa-sdk ontology junction list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]", handlerKey: "ontology.junction.list" },
  { id: "ontology.junction.show", path: ["junction", "show"], usage: "qa-sdk ontology junction show <junction-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]", handlerKey: "ontology.junction.show" },
  { id: "ontology.junction.diff", path: ["junction", "diff"], usage: "qa-sdk ontology junction diff <junction-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]", handlerKey: "ontology.junction.diff" },
  { id: "ontology.junction.diff-latest", path: ["junction", "diff-latest"], usage: "qa-sdk ontology junction diff-latest <junction-id> --scope <scope> [--store <file>] [--json]", handlerKey: "ontology.junction.diff-latest" },
  { id: "ontology.route.list", path: ["route", "list"], usage: "qa-sdk ontology route list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]", handlerKey: "ontology.route.list" },
  { id: "ontology.route.show", path: ["route", "show"], usage: "qa-sdk ontology route show <branch-node-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]", handlerKey: "ontology.route.show" },
  { id: "ontology.route.diff", path: ["route", "diff"], usage: "qa-sdk ontology route diff <branch-node-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]", handlerKey: "ontology.route.diff" },
  { id: "ontology.route.diff-latest", path: ["route", "diff-latest"], usage: "qa-sdk ontology route diff-latest <branch-node-id> --scope <scope> [--store <file>] [--json]", handlerKey: "ontology.route.diff-latest" },
  { id: "ontology.traversal.list", path: ["traversal", "list"], usage: "qa-sdk ontology traversal list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]", handlerKey: "ontology.traversal.list" },
  { id: "ontology.traversal.show", path: ["traversal", "show"], usage: "qa-sdk ontology traversal show <traversal-key> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]", handlerKey: "ontology.traversal.show" },
  { id: "ontology.traversal.diff", path: ["traversal", "diff"], usage: "qa-sdk ontology traversal diff <traversal-key> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]", handlerKey: "ontology.traversal.diff" },
  { id: "ontology.traversal.diff-latest", path: ["traversal", "diff-latest"], usage: "qa-sdk ontology traversal diff-latest <traversal-key> --scope <scope> [--store <file>] [--json]", handlerKey: "ontology.traversal.diff-latest" },
  { id: "ontology.event.ingest", path: ["event", "ingest"], usage: "qa-sdk ontology event ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]", handlerKey: "ontology.event.ingest" },
  { id: "ontology.pipe.ingest", path: ["pipe", "ingest"], usage: "qa-sdk ontology pipe ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]", handlerKey: "ontology.pipe.ingest" },
] as const satisfies readonly CommandDescriptor[];

export const ONTOLOGY_COMMAND_TREE =
  descriptorsToTree(ONTOLOGY_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const ONTOLOGY_COMMAND_SPECS =
  collectCommandUsageSpecs(["ontology"], ONTOLOGY_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const ONTOLOGY_HANDLER_REGISTRY = new Proxy({} as Record<string, RestCommandHandler>, {
  get(_target, prop) {
    if (typeof prop !== "string" || !prop.startsWith("ontology.")) return undefined;
    return async (rest: string[]) => {
      const subcommand = prop.slice("ontology.".length);
      await cliOntology([subcommand, ...rest]);
    };
  },
});
