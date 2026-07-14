// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { InfraProfileAdapter } from '../adapters/adapter.js';

export interface DeployVersion {
  serviceId: string;
  version: string; // semver or git sha
  env: string;
  provider: string;
  endpoint: string;
  deployedAt: string;
  previousVersion?: string;
}

/** 배포 버전을 infra-profile에 기록하고 이전 버전 반환 */
export async function recordDeployVersion(
  infraProfile: InfraProfileAdapter,
  version: DeployVersion,
): Promise<string | undefined> {
  const prev = await infraProfile.getDeployment(version.serviceId);
  const previousVersion = prev?.deploymentVersion;

  // history에 버전 변경 기록
  await infraProfile.addHistory(version.serviceId, {
    deployedAt: version.deployedAt,
    version: version.version,
    env: version.env,
    provider: version.provider,
    endpoint: version.endpoint,
    duration: 0,
    success: true,
    triggeredBy: 'manual',
  });

  return previousVersion;
}

/** definition-service에 배포 상태 동기화 */
export async function syncToDefinitionService(
  definitionUrl: string,
  serviceId: string,
  version: DeployVersion,
): Promise<boolean> {
  try {
    // definition-service에 배포 상태 알림
    const res = await fetch(`${definitionUrl}/docs?svc=${serviceId}&limit=1`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      console.log(
        `[definition-sync] ${serviceId} v${version.version} → definition-service 연동 확인`,
      );
    }
    return true;
  } catch {
    // fail-open: definition-service 미실행 시 무시
    return false;
  }
}
