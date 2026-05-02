// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { resolve } from "node:path";
import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
import { injectFacetExports } from "../commands/facet-inject.js";
import { facetScan } from "../commands/facet-scan.js";

export const FACET_COMMAND_DESCRIPTORS = [
  { id: "facet.scan", path: ["scan"], usage: "qa-sdk facet scan [--service <id>] [--output <path>] [--no-deps]", handlerKey: "facet.scan" },
  { id: "facet.inject", path: ["inject"], usage: "qa-sdk facet inject [dir]", handlerKey: "facet.inject" },
] as const satisfies readonly CommandDescriptor[];

export const FACET_COMMAND_TREE =
  descriptorsToTree(FACET_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const FACET_COMMAND_SPECS =
  collectCommandUsageSpecs(["facet"], FACET_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const FACET_HANDLER_REGISTRY = {
  "facet.scan": async (rest: string[]) => {
    const serviceIdx = rest.indexOf("--service");
    const serviceId = serviceIdx >= 0 ? rest[serviceIdx + 1] : undefined;
    const outputIdx = rest.indexOf("--output");
    const output = outputIdx >= 0 ? rest[outputIdx + 1] : undefined;
    const noDeps = rest.includes("--no-deps");
    const root = serviceId ? resolve("packages", serviceId) : process.cwd();
    facetScan(root, { output, deps: !noDeps });
  },
  "facet.inject": async (rest: string[]) => {
    const dir = rest[0] ?? process.cwd();
    const count = injectFacetExports(dir);
    console.log(`export 주입: ${count}건`);
  },
} satisfies Readonly<Record<string, RestCommandHandler>>;
