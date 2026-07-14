// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { ResolvedConfig } from '../core/types.js';

export interface CascadeTarget {
  serviceId: string;
  reason: string; // "depends_on ingest-server" 등
}

/** config에서 deployedServiceId에 의존하는 서비스 찾기 */
export function findCascadeTargets(
  config: ResolvedConfig,
  deployedServiceId: string,
): CascadeTarget[] {
  const targets: CascadeTarget[] = [];

  for (const [svcId, svcConfig] of Object.entries(config.services)) {
    if (svcId === deployedServiceId) continue;
    const deps = svcConfig.depends_on;
    if (deps?.includes(deployedServiceId)) {
      targets.push({ serviceId: svcId, reason: `depends_on ${deployedServiceId}` });
    }
  }

  return targets;
}

/** cascade 재배포 실행 (dry-run 지원) */
export async function executeCascade(
  targets: CascadeTarget[],
  env: string,
  options?: { dryRun?: boolean },
): Promise<void> {
  if (targets.length === 0) {
    console.log('[cascade] 의존 서비스 없음');
    return;
  }

  console.log(`[cascade] ${targets.length}개 의존 서비스 감지:`);
  for (const t of targets) {
    console.log(`  → ${t.serviceId} (${t.reason})`);
  }

  if (options?.dryRun) {
    console.log('[cascade] dry-run — 재배포 건너뜀');
    return;
  }

  // 실제 재배포는 호출자가 infra deploy를 다시 실행
  console.log('[cascade] 재배포하려면:');
  for (const t of targets) {
    console.log(`  infra deploy ${t.serviceId} ${env}`);
  }
}
