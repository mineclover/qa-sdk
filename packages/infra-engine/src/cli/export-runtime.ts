// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import { createDiscoveryClient } from '../discovery/client.js';
import { createInfraProfileAdapter } from '../adapters/infra-profile.js';
import { createDefinitionAdapter } from '../adapters/definition.js';
import { createFleetManager } from '../fleet/manager.js';
import type { FleetServiceStatus } from '../fleet/manager.js';
import { PROFILE_DIR, REGISTRY_URL, DEFINITION_URL } from './context.js';

export async function printFleetStatus(env: string): Promise<void> {
  const client = createDiscoveryClient(REGISTRY_URL);
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const fleet = createFleetManager(client, infraProfile);
  const status = await fleet.status(env);

  console.log(`\n=== Fleet Status (${env}) ===\n`);
  console.log(
    `  총: ${status.summary.total}  배포됨: ${status.summary.deployed}  실행중: ${status.summary.running}\n`,
  );

  const byTier = new Map<string, FleetServiceStatus[]>();
  for (const service of status.services) {
    const list = byTier.get(service.tier) ?? [];
    list.push(service);
    byTier.set(service.tier, list);
  }

  for (const [tier, services] of [...byTier.entries()].toSorted()) {
    console.log(`  [${tier}]`);
    for (const service of services) {
      const icon = service.deployed ? '✅' : service.running ? '🟢' : '⬜';
      const label = service.deployed ? 'deployed' : service.running ? 'running ' : 'pending ';
      const url = service.deployedUrl ?? service.registryUrl ?? '-';
      const suffix = service.deployedWith ? `  (via ${service.deployedWith})` : '';
      console.log(`    ${icon} ${label} ${service.serviceId.padEnd(26)} ${url}${suffix}`);
    }
  }
}

export async function printServiceDocs(serviceId?: string): Promise<void> {
  const client = createDiscoveryClient(REGISTRY_URL);
  const defAdapter = createDefinitionAdapter(DEFINITION_URL);

  if (serviceId) {
    const docs = await defAdapter.getServiceDocs(serviceId);
    const lifecycleSummary = Object.entries(docs.byLifecycle)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    const layerSummary = Object.entries(docs.byLayer)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    console.log(`\n=== ${serviceId} 문서 요약 ===\n`);
    console.log(`  총 ${docs.totalDocs}건`);
    console.log(`  lifecycle: ${lifecycleSummary || '(없음)'}`);
    console.log(`  layer:     ${layerSummary || '(없음)'}`);

    if (docs.docs.length > 0) {
      console.log(`\n  문서 목록:`);
      const maxIdLen = Math.max(...docs.docs.map((doc) => doc.docId.length));
      for (const doc of docs.docs) {
        console.log(
          `    ${doc.docId.padEnd(maxIdLen + 2)} [${doc.lifecycle}] ${doc.title} (${doc.layer}/${doc.scope})`,
        );
      }
    }
    return;
  }

  const services = await client.listServices();
  console.log(`\n=== 서비스별 문서 요약 ===\n`);
  for (const service of services) {
    try {
      const docs = await defAdapter.getServiceDocs(service.serviceId);
      const lifecycleSummary = Object.entries(docs.byLifecycle)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      console.log(
        `  ${service.serviceId.padEnd(28)} ${String(docs.totalDocs).padStart(3)}건  ${lifecycleSummary}`,
      );
    } catch {
      console.log(`  ${service.serviceId.padEnd(28)} (조회 불가)`);
    }
  }
}
