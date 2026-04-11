import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { CommandHandler } from "cli-command";
import {
  projectNginxProxyConfig,
  type AuthorizationOntologyGraph,
  type NginxProxyConfigProjectionOptions,
} from "authorization-ontology";

function parseFlags(args: readonly string[]): { flags: Record<string, string> } {
  const flags: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith("--")) continue;

    const [key, inline] = arg.slice(2).split("=", 2);
    const next = args[index + 1];
    if (inline !== undefined) {
      flags[key] = inline;
    } else if (next && !next.startsWith("--")) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = "true";
    }
  }

  return { flags };
}

function defaultNginxConfigPath(): string {
  const fromRepoRoot = resolve(process.cwd(), "packages/infra-engine/nginx-zitadel.conf");
  if (existsSync(fromRepoRoot)) return fromRepoRoot;
  return resolve(process.cwd(), "nginx-zitadel.conf");
}

function toProjectionOptions(flags: Record<string, string>): NginxProxyConfigProjectionOptions {
  return {
    environment: flags["env"] ?? "local",
    proxyAuthority: flags["proxy-authority"] ?? "nginx:zitadel",
    proxyId: flags["proxy-id"] ?? "zitadel-nginx",
    host: flags["host"] ?? "localhost:8085",
    upstreamAuthority: flags["upstream-authority"],
    deployment: flags["deployment-id"]
      ? {
          authority: flags["deployment-authority"] ?? "git:infra-engine",
          id: flags["deployment-id"],
          kind: flags["deployment-kind"] ?? "git",
          revision: flags["revision"],
        }
      : undefined,
  };
}

export async function createAuthorizationGraphFromNginxConfig(
  filePath: string,
  options: NginxProxyConfigProjectionOptions,
): Promise<AuthorizationOntologyGraph> {
  const config = await readFile(filePath, "utf8");
  return projectNginxProxyConfig(config, options);
}

export const authzGraphHandler: CommandHandler = async (ctx) => {
  const { flags } = parseFlags(ctx.rawArgs);
  const nginxPath = resolve(flags["nginx"] ?? defaultNginxConfigPath());
  const graph = await createAuthorizationGraphFromNginxConfig(
    nginxPath,
    toProjectionOptions(flags),
  );

  if (flags["json"] === "true") {
    console.log(JSON.stringify(graph, null, 2));
    return;
  }

  console.log("=== Authorization Topology Graph ===");
  console.log(`  source: ${nginxPath}`);
  console.log(`  realms: ${graph.realms.length}`);
  console.log(`  nodes: ${graph.nodes.length}`);
  console.log(`  relations: ${graph.relations.length}`);
  console.log("");
  for (const node of graph.nodes) {
    console.log(`  ${node.kind.padEnd(18)} ${node.coord.anchor}`);
  }
};
