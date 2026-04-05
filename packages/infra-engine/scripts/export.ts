#!/usr/bin/env pnpm exec tsx
/**
 * 서비스 연결 정보 export 도구
 *
 * 사용:
 *   pnpm exec tsx scripts/export.ts env <serviceId> [env]     — .env 파일 생성
 *   pnpm exec tsx scripts/export.ts ts [env]                  — TypeScript 모듈 생성
 *   pnpm exec tsx scripts/export.ts compose [env]             — docker-compose override 생성
 *   pnpm exec tsx scripts/export.ts status [env]              — 전체 서비스 상태
 */

import { createDiscoveryClient } from "../src/discovery/client.js";
import { createInfraProfileAdapter } from "../src/adapters/infra-profile.js";
import { createFleetManager } from "../src/fleet/manager.js";
import type { FleetServiceStatus } from "../src/fleet/manager.js";
import { generateEnvFile } from "../src/export/env-file.js";
import { generateTypescriptModule } from "../src/export/typescript-module.js";
import { generateDockerComposeOverride } from "../src/export/docker-compose.js";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";

const REGISTRY_URL = process.env.REGISTRY_URL ?? "http://localhost:3300";
const PROFILE_DIR = resolve(homedir(), ".qa-sdk");
const cmd = process.argv[2] ?? "status";
const arg1 = process.argv[3];
const arg2 = process.argv[4] ?? "dev";

async function main() {
  const client = createDiscoveryClient(REGISTRY_URL);
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const fleet = createFleetManager(client, infraProfile);

  switch (cmd) {
    case "status": {
      const env = arg1 ?? "dev";
      const status = await fleet.status(env);
      console.log(`\n=== Fleet Status (${env}) ===\n`);
      console.log(
        `  총: ${status.summary.total}  배포됨: ${status.summary.deployed}  healthy: ${status.summary.healthy}\n`,
      );

      // tier별 그룹핑
      const byTier = new Map<string, FleetServiceStatus[]>();
      for (const s of status.services) {
        const list = byTier.get(s.tier) ?? [];
        list.push(s);
        byTier.set(s.tier, list);
      }

      for (const [tier, svcs] of [...byTier.entries()].sort()) {
        console.log(`  [${tier}]`);
        for (const s of svcs) {
          const deployed = s.deployed ? "[deployed]" : "[pending]";
          const url = s.deployedUrl ?? s.registryUrl ?? "-";
          console.log(`    ${deployed} ${s.serviceId.padEnd(28)} ${url}`);
        }
      }
      break;
    }

    case "env": {
      if (!arg1) {
        console.error("사용: export.ts env <serviceId> [env]");
        process.exit(1);
      }
      const content = await generateEnvFile(client, {
        serviceId: arg1,
        env: arg2,
        includeAll: true,
      });
      const outPath = `.env.${arg1}.${arg2}`;
      await writeFile(outPath, content);
      console.log(`생성됨: ${outPath}`);
      console.log(content);
      break;
    }

    case "ts": {
      const env = arg1 ?? "dev";
      const content = await generateTypescriptModule(client, env);
      await mkdir("generated", { recursive: true });
      const outPath = `generated/service-connections.${env}.ts`;
      await writeFile(outPath, content);
      console.log(`생성됨: ${outPath} (${content.split("\n").length}줄)`);
      break;
    }

    case "compose": {
      const env = arg1 ?? "dev";
      const content = await generateDockerComposeOverride(client, env);
      await mkdir("generated", { recursive: true });
      const outPath = `generated/docker-compose.override.${env}.yml`;
      await writeFile(outPath, content);
      console.log(`생성됨: ${outPath}`);
      console.log(content);
      break;
    }

    default:
      console.error(`알 수 없는 명령: ${cmd}`);
      console.error("사용: export.ts [status|env|ts|compose] ...");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("에러:", err.message);
  process.exit(1);
});
