import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
import { cliDocs } from "../commands/docs.js";
import {
  DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH,
  DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT,
  MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH,
  MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT,
} from "../lib/docs-control-plane/index.js";

export const DOCS_COMMAND_DESCRIPTORS = [
  {
    id: "docs.help",
    path: ["help"],
    usage: "qa-sdk docs help                  docs control-plane help",
    handlerKey: "docs.help",
  },
  {
    id: "docs.status",
    path: ["status"],
    usage: "qa-sdk docs status [doc-id|path] [--json]",
    handlerKey: "docs.status",
    options: [
      { flag: "--json", type: "boolean", description: "emit structured JSON" },
      { flag: "--root", valueHint: "<dir>", type: "string", description: "repository root override" },
    ],
  },
  {
    id: "docs.collect",
    path: ["collect"],
    usage: "qa-sdk docs collect <doc-id|path> [--graph] [--axis <csv>] [--direction out|in|both] [--depth <n>] [--limit <n>] [--preset <name>] [--json]",
    handlerKey: "docs.collect",
    options: [
      { flag: "--graph", type: "boolean", description: "use graph traversal; defaults to the family preset" },
      { flag: "--axis", valueHint: "<csv>", type: "string", description: "traversal axes, repeatable or comma-separated" },
      { flag: "--direction", valueHint: "out|in|both", type: "string", description: "traversal direction" },
      { flag: "--depth", valueHint: "<n>", type: "string", description: `non-negative traversal depth (default ${DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH}, max ${MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH})` },
      { flag: "--limit", valueHint: "<n>", type: "string", description: `maximum returned nodes (default ${DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT}, max ${MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT})` },
      { flag: "--preset", valueHint: "<name>", type: "string", description: "traversal preset" },
      { flag: "--json", type: "boolean", description: "emit structured JSON" },
      { flag: "--root", valueHint: "<dir>", type: "string", description: "repository root override" },
    ],
  },
  {
    id: "docs.graph",
    path: ["graph"],
    usage: "qa-sdk docs graph <target> [--axis <csv>] [--direction out|in|both] [--depth <n>] [--limit <n>] [--preset <name>] [--json]",
    handlerKey: "docs.graph",
    options: [
      { flag: "--axis", valueHint: "<csv>", type: "string", description: "traversal axes, repeatable or comma-separated" },
      { flag: "--direction", valueHint: "out|in|both", type: "string", description: "traversal direction" },
      { flag: "--depth", valueHint: "<n>", type: "string", description: `non-negative traversal depth (default ${DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH}, max ${MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH})` },
      { flag: "--limit", valueHint: "<n>", type: "string", description: `maximum returned nodes (default ${DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT}, max ${MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT})` },
      { flag: "--preset", valueHint: "<name>", type: "string", description: "traversal preset" },
      { flag: "--json", type: "boolean", description: "emit structured JSON" },
      { flag: "--root", valueHint: "<dir>", type: "string", description: "repository root override" },
    ],
  },
  {
    id: "docs.search",
    path: ["search"],
    usage: "qa-sdk docs search <query> [--kind <kind>] [--metadata key=value] [--json]",
    handlerKey: "docs.search",
    options: [
      { flag: "--kind", valueHint: "<kind>", type: "string", description: "document kind filter, repeatable or comma-separated" },
      { flag: "--metadata", valueHint: "key=value", type: "string", description: "metadata exact-match filter, repeatable or comma-separated" },
      { flag: "--json", type: "boolean", description: "emit structured JSON" },
      { flag: "--root", valueHint: "<dir>", type: "string", description: "repository root override" },
    ],
  },
  {
    id: "docs.drift",
    path: ["drift"],
    usage: "qa-sdk docs drift [--prd <file>] [--json]",
    handlerKey: "docs.drift",
    options: [
      { flag: "--prd", valueHint: "<file>", type: "string", description: "scope drift checks to a PRD markdown/JSON family" },
      { flag: "--json", type: "boolean", description: "emit structured JSON" },
      { flag: "--root", valueHint: "<dir>", type: "string", description: "repository root override" },
    ],
  },
  {
    id: "docs.prd.context",
    path: ["prd", "context"],
    usage: "qa-sdk docs prd context <topic|doc-id> [--json]",
    handlerKey: "docs.prd.context",
    options: [
      { flag: "--json", type: "boolean", description: "emit structured JSON" },
      { flag: "--root", valueHint: "<dir>", type: "string", description: "repository root override" },
    ],
  },
  {
    id: "docs.prd.scaffold",
    path: ["prd", "scaffold"],
    usage: "qa-sdk docs prd scaffold <topic|doc-id> --output <file> [--json]",
    handlerKey: "docs.prd.scaffold",
    options: [
      { flag: "--output", valueHint: "<file>", type: "string", description: "markdown scaffold output path" },
      { flag: "--json", type: "boolean", description: "emit structured JSON" },
      { flag: "--root", valueHint: "<dir>", type: "string", description: "repository root override" },
    ],
  },
  {
    id: "docs.prd.to-ralph-json",
    path: ["prd", "to-ralph-json"],
    usage: "qa-sdk docs prd to-ralph-json <prd.md> --output <prd.json> [--json]",
    handlerKey: "docs.prd.to-ralph-json",
    options: [
      { flag: "--output", valueHint: "<prd.json>", type: "string", description: "ralph-compatible PRD JSON output path" },
      { flag: "--json", type: "boolean", description: "emit structured JSON" },
      { flag: "--root", valueHint: "<dir>", type: "string", description: "repository root override" },
    ],
  },
  {
    id: "docs.prd.sync-completion",
    path: ["prd", "sync-completion"],
    usage: "qa-sdk docs prd sync-completion --prd <prd.json> --dry-run [--json]",
    handlerKey: "docs.prd.sync-completion",
    options: [
      { flag: "--prd", valueHint: "<prd.json>", type: "string", description: "completed ralph PRD JSON path" },
      { flag: "--dry-run", type: "boolean", description: "preview docs update plan without writing files" },
      { flag: "--json", type: "boolean", description: "emit structured JSON" },
      { flag: "--root", valueHint: "<dir>", type: "string", description: "repository root override" },
    ],
  },
  {
    id: "docs.transform.metadata",
    path: ["transform", "metadata"],
    usage: "qa-sdk docs transform metadata --rule <json-file|inline-json> [--dry-run]",
    handlerKey: "docs.transform.metadata",
    options: [
      { flag: "--rule", valueHint: "<json-file|inline-json>", type: "string", description: "metadata transform rule" },
      { flag: "--dry-run", type: "boolean", description: "preview only; default behavior" },
      { flag: "--apply", type: "boolean", description: "unsupported in this PRD; returns structured error" },
      { flag: "--json", type: "boolean", description: "emit structured JSON" },
      { flag: "--root", valueHint: "<dir>", type: "string", description: "repository root override" },
    ],
  },
] as const satisfies readonly CommandDescriptor[];

export const DOCS_COMMAND_TREE =
  descriptorsToTree(DOCS_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const DOCS_COMMAND_SPECS =
  collectCommandUsageSpecs(["docs"], DOCS_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const DOCS_HANDLER_REGISTRY = new Proxy({} as Record<string, RestCommandHandler>, {
  get(_target, prop) {
    if (typeof prop !== "string" || !prop.startsWith("docs.")) return undefined;
    return async (rest: string[]) => {
      const subcommand = prop.slice(5).split(".");
      await cliDocs([...subcommand, ...rest]);
    };
  },
});
