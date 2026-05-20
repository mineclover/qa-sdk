import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
import { cliTaxonomy } from "../commands/taxonomy.js";

export const TAXONOMY_COMMAND_DESCRIPTORS = [
  { id: "tax.help", path: ["help"], handlerKey: "tax.help" },
  { id: "tax.validate", path: ["validate"], handlerKey: "tax.validate" },
] as const satisfies readonly CommandDescriptor[];

export const TAXONOMY_COMMAND_TREE =
  descriptorsToTree(TAXONOMY_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const TAXONOMY_COMMAND_SPECS =
  collectCommandUsageSpecs(["tax"], TAXONOMY_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const TAXONOMY_TOP_LEVEL_USAGE_LINES = [
  "qa-sdk tax help                   도움말",
  "qa-sdk tax validate <file>         yaml 텍소노미 검증",
] as const;

export const TAXONOMY_HANDLER_REGISTRY = new Proxy({} as Record<string, RestCommandHandler>, {
  get(_target, prop) {
    if (typeof prop !== "string" || !prop.startsWith("tax.")) return undefined;
    return async (rest: string[]) => {
      const subcommand = prop.slice(4);
      await cliTaxonomy([...subcommand.split("."), ...rest]);
    };
  },
});
