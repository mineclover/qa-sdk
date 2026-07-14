#!/usr/bin/env pnpm exec tsx
/**
 * 서비스 디스커버리 테스트
 *
 * 실행: cd packages/infra-engine && pnpm exec tsx scripts/discover.ts [serviceId] [env]
 * 예시: pnpm exec tsx scripts/discover.ts ingest-server dev
 *       pnpm exec tsx scripts/discover.ts --all dev
 *       pnpm exec tsx scripts/discover.ts --code ingest-server,gate-service dev
 *       pnpm exec tsx scripts/discover.ts --deep ingest-server dev
 */

import { createDiscoveryClient } from '../src/discovery/client.js';
import { createDefinitionAdapter } from '../src/adapters/definition.js';
import { createEnhancedDiscoveryClient } from '../src/discovery/enhanced-client.js';
import { createInfraProfileAdapter } from '../src/adapters/infra-profile.js';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const REGISTRY_URL = process.env.REGISTRY_URL ?? 'http://localhost:3300';
const DEFINITION_URL = process.env.DEFINITION_URL ?? 'http://localhost:3700';
const PROFILE_DIR = resolve(homedir(), '.qa-sdk');

// 인자 파싱
const args = process.argv.slice(2);
const deepIndex = args.indexOf('--deep');
const isDeep = deepIndex !== -1;
if (isDeep) args.splice(deepIndex, 1);

const arg1 = args[0] ?? '--all';
const env = args[1] ?? 'dev';

async function main() {
  const client = createDiscoveryClient(REGISTRY_URL);
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);

  if (arg1 === '--all') {
    console.log(`\n=== 전체 서비스 URL (env: ${env}) ===\n`);
    let urls: Record<string, string>;
    try {
      urls = await client.resolveAll(env);
    } catch {
      const deployments = await infraProfile.getAllDeployments();
      urls = Object.fromEntries(
        Object.values(deployments)
          .filter((deployment) => deployment.env === env)
          .map((deployment) => [deployment.serviceId, deployment.endpoint]),
      );
      console.log('[offline] registry 미실행 — infra-profile 기준 endpoint 출력');
    }

    if (Object.keys(urls).length === 0) {
      console.log('(표시할 서비스 없음)');
      return;
    }
    const maxLen = Math.max(...Object.keys(urls).map((k) => k.length));
    for (const [id, url] of Object.entries(urls).sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`  ${id.padEnd(maxLen)}  ${url}`);
    }
    console.log(`\n총 ${Object.keys(urls).length}개 서비스`);
    return;
  }

  if (arg1 === '--code') {
    const serviceIds = (args[1] ?? '').split(',').filter(Boolean);
    const codeEnv = args[2] ?? 'dev';
    if (serviceIds.length === 0) {
      console.error('사용법: --code service1,service2 [env]');
      process.exit(1);
    }
    console.log(await client.generateConnectCodeAll(serviceIds, codeEnv));
    return;
  }

  if (arg1 === '--list') {
    console.log(`\n=== 서비스 목록 ===\n`);
    let services: Array<{ serviceId: string; name: string; tier: string }>;
    try {
      services = await client.listServices();
    } catch {
      const deployments = await infraProfile.getAllDeployments();
      services = Object.values(deployments).map((deployment) => ({
        serviceId: deployment.serviceId,
        name: deployment.serviceId,
        tier: `local-state/${deployment.provider}`,
      }));
      console.log('[offline] registry 미실행 — infra-profile 기준 목록 출력');
    }

    if (services.length === 0) {
      console.log('(표시할 서비스 없음)');
      return;
    }
    for (const svc of services) {
      console.log(`  ${svc.serviceId.padEnd(25)} ${svc.name.padEnd(15)} tier=${svc.tier}`);
    }
    console.log(`\n총 ${services.length}개`);
    return;
  }

  // --deep 모드: definition-service 데이터 통합
  if (isDeep) {
    const defAdapter = createDefinitionAdapter(DEFINITION_URL);
    const enhanced = createEnhancedDiscoveryClient(client, defAdapter);
    const svc = await enhanced.resolveEnhanced(arg1, env);

    if (!svc) {
      console.error(`서비스 "${arg1}"를 찾을 수 없습니다`);
      process.exit(1);
    }

    console.log(`\n=== ${svc.name} (${svc.serviceId}) ===`);
    const deepFallback = svc.urlFallback ? `  ⚠ ${env} URL 미등록 — 기본 URL 사용 중` : '';
    console.log(`  URL:      ${svc.url}${deepFallback}`);
    console.log(`  Tier:     ${svc.tier}`);
    console.log(`  Team:     ${svc.team}`);

    // 문서 정보
    if (svc.docs) {
      const d = svc.docs;
      const lcSummary = Object.entries(d.byLifecycle)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      const lySummary = Object.entries(d.byLayer)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

      console.log(`\n  --- 문서 ---`);
      console.log(`  총 ${d.totalDocs}건 (${lcSummary})`);
      console.log(`  계층: ${lySummary}`);
    } else {
      console.log(`\n  --- 문서 ---`);
      console.log(`  (definition-service 조회 불가)`);
    }

    // 테스트 정보
    if (svc.testHealth) {
      const t = svc.testHealth;
      const healthIcon =
        t.healthy === 'pass' ? '✅ pass' : t.healthy === 'fail' ? '❌ fail' : '⬜ 데이터 없음';
      console.log(`\n  --- 테스트 ---`);
      console.log(`  총 ${t.totalTests}건, pass rate: ${t.passRate}%, healthy: ${healthIcon}`);
    } else {
      console.log(`\n  --- 테스트 ---`);
      console.log(`  (definition-service 조회 불가)`);
    }

    // 소유 Prefix 상세
    console.log(`\n  --- 소유 Prefix ---`);
    if (svc.ownedPrefixDetails && svc.ownedPrefixDetails.length > 0) {
      const maxPrefixLen = Math.max(...svc.ownedPrefixDetails.map((p) => p.prefixId.length));
      for (const p of svc.ownedPrefixDetails) {
        const labelsStr = p.labels.length > 0 ? ` [${p.labels.join(', ')}]` : '';
        console.log(
          `  ${p.prefixId.padEnd(maxPrefixLen + 2)} ${p.name} (${p.category}${labelsStr})`,
        );
      }
    } else if (svc.ownedPrefixes.length > 0) {
      // definition-service에서 상세를 못 가져왔지만 prefix 목록은 있는 경우
      for (const id of svc.ownedPrefixes) {
        console.log(`  ${id}`);
      }
    } else {
      console.log(`  (없음)`);
    }

    // 환경별 URL
    if (svc.urls && Object.keys(svc.urls).length > 0) {
      console.log(`\n  --- 환경별 URL ---`);
      for (const [e, u] of Object.entries(svc.urls)) {
        console.log(`  ${e}:${' '.repeat(Math.max(1, 10 - e.length))}${u}`);
      }
    }

    return;
  }

  // 단일 서비스 조회 (기본)
  const svc = await client.resolve(arg1, env);
  if (!svc) {
    const deployment = await infraProfile.getDeployment(arg1);
    if (!deployment || deployment.env !== env) {
      console.error(`서비스 "${arg1}"를 찾을 수 없습니다`);
      process.exit(1);
    }

    console.log(`\n=== ${deployment.serviceId} (${deployment.serviceId}) ===`);
    console.log('  Source:   infra-profile (registry 미연결)');
    console.log(`  URL:      ${deployment.endpoint}`);
    console.log(`  Provider: ${deployment.provider}`);
    console.log(`  Env:      ${deployment.env}`);
    console.log(`  Region:   ${deployment.region}`);
    console.log(`  Health:   ${deployment.healthPath}`);
    return;
  }

  console.log(`\n=== ${svc.name} (${svc.serviceId}) ===`);
  const fallbackWarn = svc.urlFallback ? `  ⚠ ${env} URL 미등록 — 기본 URL 사용 중` : '';
  console.log(`  URL:      ${svc.url}${fallbackWarn}`);
  console.log(`  Tier:     ${svc.tier}`);
  console.log(`  Team:     ${svc.team}`);
  console.log(`  Owned:    ${svc.ownedPrefixes.join(', ') || '(없음)'}`);
  console.log(`  Consumed: ${svc.consumedPrefixes.join(', ') || '(없음)'}`);
  if (svc.urls) {
    console.log(`  URLs:`);
    for (const [e, u] of Object.entries(svc.urls)) {
      console.log(`    ${e}: ${u}`);
    }
  }
}

main().catch((err: Error) => {
  console.error('에러:', err.message);
  process.exit(1);
});
