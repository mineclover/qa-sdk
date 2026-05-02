// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { resolve } from "node:path";
import type { EnvDiscoveryClient } from "./types.js";
import {
  writeDockerComposeExport,
  writeEnvExport,
  writeTypescriptExport,
  type PgDomain,
} from "./export-files.js";

export interface SupplyExportCommandInput {
  discovery: EnvDiscoveryClient;
  command: "env" | "ts" | "compose";
  arg1?: string;
  arg2?: string;
  rawArgs: readonly string[];
  exportOut?: string;
  defaultConfigDir?: string;
  defaultEnvDockerPath?: string;
}

function parsePgDomain(rawArgs: readonly string[]): PgDomain | undefined {
  const validDomains: readonly PgDomain[] = [
    "auth",
    "audit",
    "ingest",
    "decision",
    "definition",
    "admin",
  ];
  const index = rawArgs.indexOf("--pg-domain");
  const raw = index !== -1 ? rawArgs[index + 1] : undefined;
  if (index !== -1 && !raw) {
    throw new Error("--pg-domain 다음에 도메인 (auth/audit/ingest/decision/definition/admin) 필요");
  }
  if (raw && !validDomains.includes(raw as PgDomain)) {
    throw new Error(`--pg-domain 값이 잘못됨: ${raw}. 허용: ${validDomains.join("/")}`);
  }
  return raw as PgDomain | undefined;
}

function parseOptionalArg(rawArgs: readonly string[], name: string): string | undefined {
  const index = rawArgs.indexOf(name);
  return index !== -1 ? rawArgs[index + 1] : undefined;
}

export async function runSupplyExportCommand(
  input: SupplyExportCommandInput,
): Promise<void> {
  switch (input.command) {
    case "env": {
      if (!input.arg1) {
        throw new Error("사용: export.ts env <serviceId> [env] [--all] [--pg-domain <domain>] [--pg-host <host>]");
      }
      const serviceId = input.arg1;
      const env = input.arg2 ?? "dev";
      const includeAll = input.rawArgs.includes("--all");
      const pgDomain = parsePgDomain(input.rawArgs);
      const pgHost = parseOptionalArg(input.rawArgs, "--pg-host");
      const configPath = input.defaultConfigDir
        ? resolve(input.defaultConfigDir, `${env}.json`)
        : undefined;

      const result = await writeEnvExport(input.discovery, {
        serviceId,
        env,
        includeAll,
        pgDomain,
        pgHost,
        configPath,
        outPath: input.exportOut ?? `.env.${serviceId}.${env}`,
        envDockerPath: pgDomain ? input.defaultEnvDockerPath : undefined,
      });
      console.log(`생성됨: ${result.outPath}`);
      console.log(result.content);
      return;
    }

    case "ts": {
      const env = input.arg1 ?? "dev";
      const result = await writeTypescriptExport(input.discovery, {
        env,
        outPath: input.exportOut ?? `generated/service-connections.${env}.ts`,
      });
      console.log(`생성됨: ${result.outPath} (${result.content.split("\n").length}줄)`);
      return;
    }

    case "compose": {
      const env = input.arg1 ?? "dev";
      const result = await writeDockerComposeExport(input.discovery, {
        env,
        outPath: input.exportOut ?? `generated/docker-compose.override.${env}.yml`,
      });
      console.log(`생성됨: ${result.outPath}`);
      console.log(result.content);
      return;
    }
  }
}
