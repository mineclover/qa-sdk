import type { Catalog } from "@qa-sdk/core";
import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
import {
  prefixDrift,
  prefixFind,
  prefixImpact,
  prefixMigrate,
  prefixStamp,
} from "../commands/prefix-stamp.js";

export const PREFIX_COMMAND_DESCRIPTORS = [
  { id: "prefix.stamp", path: ["stamp"], usage: "qa-sdk prefix stamp [paths...] [--update] [--dry-run]", handlerKey: "prefix.stamp" },
  { id: "prefix.drift", path: ["drift"], usage: "qa-sdk prefix drift [paths...]", handlerKey: "prefix.drift" },
  { id: "prefix.find", path: ["find"], usage: "qa-sdk prefix find [prefixId] [--dim <name>] [--version <id>] [--summary]", handlerKey: "prefix.find" },
  { id: "prefix.migrate", path: ["migrate"], usage: "qa-sdk prefix migrate <prefixId> <fromVersion> <toVersion> [--dry-run]", handlerKey: "prefix.migrate" },
  { id: "prefix.impact", path: ["impact"], usage: "qa-sdk prefix impact <prefixId>", handlerKey: "prefix.impact" },
] as const satisfies readonly CommandDescriptor[];

export const PREFIX_COMMAND_TREE =
  descriptorsToTree(PREFIX_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const PREFIX_COMMAND_SPECS =
  collectCommandUsageSpecs(["prefix"], PREFIX_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export function createPrefixHandlerRegistry(
  loadedCatalog: Catalog,
): Readonly<Record<string, RestCommandHandler>> {
  return {
    "prefix.stamp": (rest: string[]) => {
      const psServiceIdx = rest.indexOf("--service");
      prefixStamp(loadedCatalog, {
        update: rest.includes("--update"),
        dryRun: rest.includes("--dry-run"),
        service: psServiceIdx >= 0 ? rest[psServiceIdx + 1] : undefined,
        paths: rest.filter((arg) => !arg.startsWith("--") && (psServiceIdx < 0 || rest.indexOf(arg) !== psServiceIdx + 1)),
      });
    },
    "prefix.drift": (rest: string[]) => {
      prefixDrift(loadedCatalog, rest.filter((arg) => !arg.startsWith("--")));
    },
    "prefix.find": (rest: string[]) => {
      const pfDimIdx = rest.indexOf("--dim");
      const pfVerIdx = rest.indexOf("--version");
      prefixFind(loadedCatalog, rest[0]?.startsWith("--") ? undefined : rest[0], {
        dim: pfDimIdx >= 0 ? rest[pfDimIdx + 1] : undefined,
        version: pfVerIdx >= 0 ? rest[pfVerIdx + 1] : undefined,
        summary: rest.includes("--summary"),
      });
    },
    "prefix.migrate": (rest: string[]) => {
      const [prefixId, fromVersion, toVersion] = rest.filter((arg) => !arg.startsWith("--"));
      if (!prefixId || !fromVersion || !toVersion) {
        console.error("Usage: qa-sdk prefix migrate <prefixId> <fromVersion> <toVersion> [--dry-run]");
        return;
      }
      prefixMigrate(loadedCatalog, prefixId, fromVersion, toVersion, { dryRun: rest.includes("--dry-run") });
    },
    "prefix.impact": (rest: string[]) => {
      if (!rest[0]) {
        console.error("Usage: qa-sdk prefix impact <prefixId>");
        return;
      }
      prefixImpact(loadedCatalog, rest[0]);
    },
  };
}
