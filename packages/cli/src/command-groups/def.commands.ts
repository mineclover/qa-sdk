import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
import { cliDef } from "../commands/def.js";

export const DEF_COMMAND_DESCRIPTORS = [
  { id: "def.help", path: ["help"], handlerKey: "def.help" },
  { id: "def.scan", path: ["scan"], handlerKey: "def.sync" },
  { id: "def.scan-audit", path: ["scan-audit"], handlerKey: "def.scan-audit" },
  { id: "def.code-link-gaps", path: ["code-link-gaps"], handlerKey: "def.code-link-gaps" },
  { id: "def.topdown", path: ["topdown"], handlerKey: "def.topdown" },
  { id: "def.bottomup", path: ["bottomup"], handlerKey: "def.bottomup" },
  { id: "def.context", path: ["context"], handlerKey: "def.context" },
  { id: "def.boundary", path: ["boundary"], handlerKey: "def.boundary" },
  { id: "def.boundary-context", path: ["boundary-context"], handlerKey: "def.boundary-context" },
  { id: "def.audit", path: ["audit"], handlerKey: "def.audit" },
  { id: "def.validate", path: ["validate"], handlerKey: "def.validate" },
  { id: "def.stats", path: ["stats"], handlerKey: "def.stats" },
  { id: "def.sync", path: ["sync"], handlerKey: "def.sync" },
  { id: "def.read", path: ["read"], handlerKey: "def.body" },
  { id: "def.list", path: ["list"], handlerKey: "def.list" },
  { id: "def.get", path: ["get"], handlerKey: "def.get" },
  { id: "def.body", path: ["body"], handlerKey: "def.body" },
  { id: "def.children", path: ["children"], handlerKey: "def.children" },
  { id: "def.parent", path: ["parent"], handlerKey: "def.parent" },
  { id: "def.incoming", path: ["incoming"], handlerKey: "def.incoming" },
  { id: "def.outgoing", path: ["outgoing"], handlerKey: "def.outgoing" },
  { id: "def.search", path: ["search"], handlerKey: "def.search" },
  { id: "def.concepts", path: ["concepts"], handlerKey: "def.concepts" },
  { id: "def.impact", path: ["impact"], handlerKey: "def.impact" },
  { id: "def.check", path: ["check"], handlerKey: "def.check" },
  { id: "def.audit-db", path: ["audit-db"], handlerKey: "def.audit-db" },
  { id: "def.overview", path: ["overview"], handlerKey: "def.overview" },
  { id: "def.link-rules", path: ["link-rules"], handlerKey: "def.link-rules" },
  { id: "def.find-by-file", path: ["find-by-file"], handlerKey: "def.find-by-file" },
  { id: "def.guide", path: ["guide"], handlerKey: "def.guide" },
  { id: "def.state", path: ["state"], handlerKey: "def.state" },
] as const satisfies readonly CommandDescriptor[];

export const DEF_COMMAND_TREE =
  descriptorsToTree(DEF_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const DEF_COMMAND_SPECS =
  collectCommandUsageSpecs(["def"], DEF_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const DEF_TOP_LEVEL_USAGE_LINES = [
  "qa-sdk def help                   도움말",
  "qa-sdk def sync [--db path]        docs → local definition SQLite 동기화",
] as const;

/**
 * def handlers simply delegate to cliDef which has its own router.
 * We use a Proxy to avoid repetitive manual mapping while maintaining the registry pattern.
 */
export const DEF_HANDLER_REGISTRY = new Proxy({} as Record<string, RestCommandHandler>, {
  get(_target, prop) {
    if (typeof prop !== "string" || !prop.startsWith("def.")) return undefined;
    return async (rest: string[]) => {
      const subcommand = prop.slice(4); // remove 'def.'
      await cliDef([subcommand, ...rest]);
    };
  },
});
