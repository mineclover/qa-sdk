#!/usr/bin/env node
// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { resolve } from "node:path";
import { runSupplyExportCommand } from "./export-command.js";
import { createEnvRegistryDiscoveryClient } from "./discovery-client.js";

function printHelp(): void {
  console.log(`infra-env

사용:
  infra-env env <serviceId> [env] [--all] [--pg-domain <domain>] [--pg-host <host>] [--out <path>]
  infra-env ts [env] [--out <path>]
  infra-env compose [env] [--out <path>]

옵션:
  --registry-url <url>  registry-service base URL (기본: REGISTRY_URL 또는 http://localhost:3300)
  --catalog <id>        catalog id (기본: demo)
  --out <path>          출력 경로 override
`);
}

function readOption(rawArgs: readonly string[], name: string): string | undefined {
  const index = rawArgs.indexOf(name);
  return index !== -1 ? rawArgs[index + 1] : undefined;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const command = rawArgs[0];
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command !== "env" && command !== "ts" && command !== "compose") {
    console.error(`알 수 없는 명령: ${command}`);
    printHelp();
    process.exit(1);
  }

  const registryUrl = readOption(rawArgs, "--registry-url")
    ?? process.env.REGISTRY_URL
    ?? "http://localhost:3300";
  const catalogId = readOption(rawArgs, "--catalog") ?? "demo";
  const outPath = readOption(rawArgs, "--out");
  const discovery = createEnvRegistryDiscoveryClient(registryUrl, catalogId);

  await runSupplyExportCommand({
    discovery,
    command,
    arg1: rawArgs[1],
    arg2: rawArgs[2],
    rawArgs,
    exportOut: outPath,
    defaultConfigDir: resolve(process.cwd(), "packages/infra-engine/config"),
    defaultEnvDockerPath: resolve(process.cwd(), "packages/infra-engine/.env.docker"),
  });
}

main().catch((err) => {
  console.error("에러:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
