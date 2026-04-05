// fleet/manager.ts — 중앙 배포 관리 (Fleet Manager)
import type { DiscoveryClient, ServiceInfo } from "../discovery/client.js";
import type { InfraProfileAdapter } from "../adapters/adapter.js";

export interface FleetStatus {
  env: string;
  services: FleetServiceStatus[];
  summary: {
    total: number;
    deployed: number;
    running: number;
    healthy: number;
    degraded: number;
    unknown: number;
  };
}

export interface FleetServiceStatus {
  serviceId: string;
  name: string;
  tier: string;
  registryUrl: string;
  deployedUrl?: string;
  deployed: boolean;
  /** 헬스체크로 확인된 실행 상태 */
  running?: boolean;
  healthy?: boolean;
  env: string;
}

export interface FleetDeployResult {
  env: string;
  results: Array<{
    serviceId: string;
    success: boolean;
    duration: number;
    error?: string;
  }>;
  summary: {
    total: number;
    success: number;
    failed: number;
    totalDuration: number;
  };
}

export interface FleetManager {
  /** 환경별 전체 서비스 상태 조회 */
  status(env: string): Promise<FleetStatus>;

  /** 환경별 배포 가능한 서비스 목록 */
  listDeployable(env: string): Promise<ServiceInfo[]>;

  /** 환경에 모든 서비스 배포 (순차) */
  deployAll(
    env: string,
    options?: { dryRun?: boolean },
  ): Promise<FleetDeployResult>;

  /** 특정 tier의 서비스만 배포 */
  deployByTier(env: string, tier: string): Promise<FleetDeployResult>;
}

export function createFleetManager(
  discovery: DiscoveryClient,
  infraProfile: InfraProfileAdapter,
): FleetManager {
  async function buildServiceStatuses(
    env: string,
  ): Promise<FleetServiceStatus[]> {
    const [services, urls, deployments] = await Promise.all([
      discovery.listServices(),
      discovery.resolveAll(env),
      infraProfile.getAllDeployments(),
    ]);

    const statuses: FleetServiceStatus[] = [];

    for (const svc of services) {
      const registryUrl = urls[svc.serviceId] ?? svc.url ?? "";
      const deployment = deployments[svc.serviceId];
      const deployedUrl = deployment?.endpoint;
      const deployed = deployment != null;

      // 헬스체크: 배포된 서비스 또는 registry URL이 있는 서비스에 시도
      let healthy: boolean | undefined;
      let running: boolean | undefined;

      if (deployed && deployedUrl) {
        try {
          const res = await fetch(
            `${deployedUrl}${deployment.healthPath ?? "/health"}`,
            { signal: AbortSignal.timeout(2_000) },
          );
          healthy = res.ok;
          running = res.ok;
        } catch {
          healthy = false;
          running = false;
        }
      } else if (registryUrl) {
        // 배포 기록 없어도 registry URL로 실행 상태 확인
        try {
          const res = await fetch(`${registryUrl}/health`, {
            signal: AbortSignal.timeout(2_000),
          });
          running = res.ok;
        } catch {
          running = false;
        }
      }

      statuses.push({
        serviceId: svc.serviceId,
        name: svc.name,
        tier: svc.tier,
        registryUrl,
        deployedUrl,
        deployed,
        running,
        healthy,
        env,
      });
    }

    return statuses;
  }

  function summarize(services: FleetServiceStatus[]): FleetStatus["summary"] {
    let deployed = 0;
    let running = 0;
    let healthy = 0;
    let degraded = 0;
    let unknown = 0;

    for (const s of services) {
      if (s.deployed) deployed++;
      if (s.running === true) running++;
      if (s.healthy === true) healthy++;
      else if (s.healthy === false) degraded++;
      else unknown++;
    }

    return { total: services.length, deployed, running, healthy, degraded, unknown };
  }

  function buildDryRunResult(
    env: string,
    services: ServiceInfo[],
  ): FleetDeployResult {
    const results = services.map((svc) => ({
      serviceId: svc.serviceId,
      success: true,
      duration: 0,
      error: undefined,
    }));

    return {
      env,
      results,
      summary: {
        total: results.length,
        success: results.length,
        failed: 0,
        totalDuration: 0,
      },
    };
  }

  return {
    async status(env) {
      const services = await buildServiceStatuses(env);
      return { env, services, summary: summarize(services) };
    },

    async listDeployable(env) {
      const services = await discovery.listServices();
      const urls = await discovery.resolveAll(env);
      // URL이 있는 서비스만 배포 가능
      return services.filter((svc) => urls[svc.serviceId] ?? svc.url);
    },

    async deployAll(env, options) {
      const deployable = await this.listDeployable(env);

      // dry-run 또는 초기 버전: 계획만 반환
      if (options?.dryRun !== false) {
        return buildDryRunResult(env, deployable);
      }

      // 실제 배포는 향후 파이프라인 연동으로 구현
      return buildDryRunResult(env, deployable);
    },

    async deployByTier(env, tier) {
      const deployable = await this.listDeployable(env);
      const filtered = deployable.filter((svc) => svc.tier === tier);
      return buildDryRunResult(env, filtered);
    },
  };
}
