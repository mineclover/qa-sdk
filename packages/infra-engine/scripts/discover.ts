#!/usr/bin/env pnpm exec tsx
/**
 * 서비스 디스커버리 테스트
 *
 * 실행: cd packages/infra-engine && pnpm exec tsx scripts/discover.ts [serviceId] [env]
 * 예시: pnpm exec tsx scripts/discover.ts ingest-server dev
 *       pnpm exec tsx scripts/discover.ts --all dev
 *       pnpm exec tsx scripts/discover.ts --code ingest-server,gate-service dev
 */

import { createDiscoveryClient } from "../src/discovery/client.js";

const REGISTRY_URL = process.env.REGISTRY_URL ?? "http://localhost:3300";
const arg1 = process.argv[2] ?? "--all";
const env = process.argv[3] ?? "dev";

async function main() {
  const client = createDiscoveryClient(REGISTRY_URL);

  if (arg1 === "--all") {
    console.log(`\n=== 전체 서비스 URL (env: ${env}) ===\n`);
    const urls = await client.resolveAll(env);
    const maxLen = Math.max(...Object.keys(urls).map((k) => k.length));
    for (const [id, url] of Object.entries(urls).sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`  ${id.padEnd(maxLen)}  ${url}`);
    }
    console.log(`\n총 ${Object.keys(urls).length}개 서비스`);
    return;
  }

  if (arg1 === "--code") {
    const serviceIds = (process.argv[3] ?? "").split(",").filter(Boolean);
    const codeEnv = process.argv[4] ?? "dev";
    if (serviceIds.length === 0) {
      console.error("사용법: --code service1,service2 [env]");
      process.exit(1);
    }
    console.log(await client.generateConnectCodeAll(serviceIds, codeEnv));
    return;
  }

  if (arg1 === "--list") {
    console.log(`\n=== 서비스 목록 ===\n`);
    const services = await client.listServices();
    for (const svc of services) {
      console.log(`  ${svc.serviceId.padEnd(25)} ${svc.name.padEnd(15)} tier=${svc.tier}`);
    }
    console.log(`\n총 ${services.length}개`);
    return;
  }

  // 단일 서비스 조회
  const svc = await client.resolve(arg1, env);
  if (!svc) {
    console.error(`서비스 "${arg1}"를 찾을 수 없습니다`);
    process.exit(1);
  }

  console.log(`\n=== ${svc.name} (${svc.serviceId}) ===`);
  console.log(`  URL:      ${svc.url}`);
  console.log(`  Tier:     ${svc.tier}`);
  console.log(`  Team:     ${svc.team}`);
  console.log(`  Owned:    ${svc.ownedPrefixes.join(", ") || "(없음)"}`);
  console.log(`  Consumed: ${svc.consumedPrefixes.join(", ") || "(없음)"}`);
  if (svc.urls) {
    console.log(`  URLs:`);
    for (const [e, u] of Object.entries(svc.urls)) {
      console.log(`    ${e}: ${u}`);
    }
  }
}

main().catch((err: Error) => {
  console.error("에러:", err.message);
  process.exit(1);
});
