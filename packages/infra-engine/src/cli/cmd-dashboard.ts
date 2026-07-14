// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from 'cli-command';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { createInfraProfileAdapter } from '../adapters/infra-profile.js';
import { PROFILE_DIR } from './context.js';
import { assertNoTraversal } from '../lib/validation.js';

/** dashboard summary — 전체 요약 */
export const dashboardSummaryHandler: CommandHandler = async (_ctx) => {
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const { createDashboardData } = await import('../monitor/dashboard.js');
  const dashboard = createDashboardData(infraProfile);
  const s = await dashboard.getSummary();
  const fleetRuns = await dashboard.getFleetRuns();
  console.log(`\n=== Dashboard Summary ===`);
  console.log(`  시각:       ${s.timestamp}`);
  console.log(`  배포:       ${s.deployed}건`);
  console.log(`  모니터:     ${s.monitored}건`);
  console.log(`  Fleet Runs: ${fleetRuns.length}건`);
  console.log(
    `  상태:       ${Object.entries(s.byStatus)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ')}`,
  );
  console.log(
    `  프로바이더: ${
      Object.entries(s.byProvider)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ') || '-'
    }`,
  );
  console.log(
    `  환경:       ${
      Object.entries(s.byEnv)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ') || '-'
    }`,
  );
};

/** dashboard service <id> — 서비스 상세 */
export const dashboardServiceHandler: CommandHandler = async (ctx) => {
  const svcId = ctx.args.serviceId;
  if (!svcId) {
    console.error('사용: infra dashboard service <serviceId>');
    process.exit(1);
  }
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const { createDashboardData } = await import('../monitor/dashboard.js');
  const dashboard = createDashboardData(infraProfile);
  const d = await dashboard.getServiceDashboard(svcId);
  console.log(`\n=== ${svcId} Dashboard ===`);
  if (d.deployment) {
    console.log(`  배포: ${d.deployment.provider}/${d.deployment.env} -> ${d.deployment.endpoint}`);
    console.log(`  배포일: ${d.deployment.deployedAt}`);
  } else {
    console.log('  배포: 없음');
  }
  if (d.monitor) {
    console.log(`  모니터: ${d.monitor.status} (마지막: ${d.monitor.lastChecked})`);
  }
  console.log(`  이력: ${d.history.length}건`);
  if (d.uptime) {
    console.log(`  uptime: ${d.uptime.percentage}% (since ${d.uptime.since})`);
  }
};

/** dashboard export [path] — JSON export */
export const dashboardExportHandler: CommandHandler = async (ctx) => {
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const { createDashboardData } = await import('../monitor/dashboard.js');
  const dashboard = createDashboardData(infraProfile);
  const json = await dashboard.exportJson();
  const outPath = ctx.args.path ?? 'generated/dashboard.json';
  assertNoTraversal(outPath);
  await mkdir(resolve(outPath, '..'), { recursive: true });
  await writeFile(outPath, json);
  console.log(`생성됨: ${outPath}`);
};
