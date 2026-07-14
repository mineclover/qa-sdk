// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// fleet/manager.ts — 중앙 배포 관리 (Fleet Manager)
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DiscoveryClient, ServiceInfo } from '../discovery/client.js';
import type { InfraProfileAdapter } from '../adapters/adapter.js';

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
  /** 부모 서비스의 부속으로 배포된 경우, 부모 serviceId */
  deployedWith?: string;
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

export interface FleetRunOptions {
  dryRun?: boolean;
  continueOnError?: boolean;
  provider?: 'local' | 'cloudflare';
  sync?: boolean;
}

export interface FleetManager {
  /** 환경별 전체 서비스 상태 조회 */
  status(env: string): Promise<FleetStatus>;

  /** 환경별 배포 가능한 서비스 목록 */
  listDeployable(env: string): Promise<ServiceInfo[]>;

  /** 환경에 모든 서비스 배포 (순차) */
  deployAll(env: string, options?: FleetRunOptions): Promise<FleetDeployResult>;

  /** 특정 tier의 서비스만 배포 */
  deployByTier(env: string, tier: string, options?: FleetRunOptions): Promise<FleetDeployResult>;
}

export interface FleetManagerOptions {
  deployExecutor?: (serviceId: string, env: string, options?: FleetRunOptions) => Promise<void>;
}

export function createFleetManager(
  discovery: DiscoveryClient,
  infraProfile: InfraProfileAdapter,
  managerOptions?: FleetManagerOptions,
): FleetManager {
  function buildOfflineServices(
    env: string,
    deployments: Record<string, { serviceId: string; env: string; endpoint: string }>,
  ): ServiceInfo[] {
    return Object.values(deployments)
      .filter((deployment) => deployment.env === env)
      .map((deployment) => ({
        serviceId: deployment.serviceId,
        name: deployment.serviceId,
        url: deployment.endpoint,
        tier: 'unknown',
        team: 'infra-profile',
        ownedPrefixes: [],
        consumedPrefixes: [],
        urls: { [env]: deployment.endpoint },
      }));
  }

  async function buildServiceStatuses(env: string): Promise<FleetServiceStatus[]> {
    const deployments = await infraProfile.getAllDeployments();
    let services: ServiceInfo[];
    let urls: Record<string, string>;

    try {
      [services, urls] = await Promise.all([discovery.listServices(), discovery.resolveAll(env)]);
    } catch {
      services = buildOfflineServices(env, deployments);
      urls = Object.fromEntries(services.map((svc) => [svc.serviceId, svc.url]));
    }

    // 1차: 각 서비스의 고유 상태 수집
    const statuses: FleetServiceStatus[] = [];

    for (const svc of services) {
      const registryUrl = urls[svc.serviceId] ?? svc.url ?? '';
      const deployment = deployments[svc.serviceId];
      const deployedUrl = deployment?.endpoint;
      const deployed = deployment != null;

      // 헬스체크: 배포된 서비스 또는 registry URL이 있는 서비스에 시도
      let healthy: boolean | undefined;
      let running: boolean | undefined;

      if (deployed && deployedUrl) {
        try {
          const res = await fetch(`${deployedUrl}${deployment.healthPath ?? '/health'}`, {
            signal: AbortSignal.timeout(2_000),
          });
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

    // 2차: deployedWith 관계로 부모 서비스 상태 전파
    const statusMap = new Map(statuses.map((s) => [s.serviceId, s]));
    for (let i = 0; i < services.length; i++) {
      const svc = services[i];
      const status = statuses[i];
      if (!status.deployed && !status.running && svc.deployedWith) {
        const parent = statusMap.get(svc.deployedWith);
        if (parent && (parent.deployed || parent.running)) {
          status.deployed = parent.deployed;
          status.running = parent.running;
          status.healthy = parent.healthy;
          status.deployedWith = svc.deployedWith;
        }
      }
    }

    return statuses;
  }

  function summarize(services: FleetServiceStatus[]): FleetStatus['summary'] {
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

  function buildDryRunResult(env: string, services: ServiceInfo[]): FleetDeployResult {
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

  async function defaultDeployExecutor(
    serviceId: string,
    env: string,
    options?: FleetRunOptions,
  ): Promise<void> {
    const packageRoot = existsSync(resolve(process.cwd(), 'scripts/infra.ts'))
      ? process.cwd()
      : resolve(process.cwd(), 'packages/infra-engine');
    const args = ['--import', 'tsx', './scripts/infra.ts', 'deploy', serviceId, env];
    if (options?.provider) {
      args.push('--provider', options.provider);
    }
    if (options?.sync) {
      args.push('--sync');
    }
    if (options?.dryRun) {
      args.push('--dry-run');
    }

    const { execa } = await import('execa');
    await execa('node', args, {
      cwd: packageRoot,
      env: process.env,
      stdio: 'inherit',
    });
  }

  async function runDeploy(
    env: string,
    services: ServiceInfo[],
    options?: FleetRunOptions,
  ): Promise<FleetDeployResult> {
    if (options?.dryRun !== false) {
      return buildDryRunResult(env, services);
    }

    const deployRunner = managerOptions?.deployExecutor ?? defaultDeployExecutor;

    const results: FleetDeployResult['results'] = [];

    for (const svc of services) {
      const start = Date.now();
      try {
        await deployRunner(svc.serviceId, env, options);
        results.push({
          serviceId: svc.serviceId,
          success: true,
          duration: Date.now() - start,
        });
      } catch (err) {
        results.push({
          serviceId: svc.serviceId,
          success: false,
          duration: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        });
        if (!options?.continueOnError) {
          break;
        }
      }
    }

    const success = results.filter((result) => result.success).length;
    const failed = results.filter((result) => !result.success).length;
    const totalDuration = results.reduce((sum, result) => sum + result.duration, 0);

    return {
      env,
      results,
      summary: {
        total: results.length,
        success,
        failed,
        totalDuration,
      },
    };
  }

  return {
    async status(env) {
      const services = await buildServiceStatuses(env);
      return { env, services, summary: summarize(services) };
    },

    async listDeployable(env) {
      try {
        const services = await discovery.listServices();
        const urls = await discovery.resolveAll(env);
        // URL이 있고 독립 배포 단위인 서비스만 배포 가능
        return services.filter((svc) => !svc.deployedWith && (urls[svc.serviceId] ?? svc.url));
      } catch {
        const deployments = await infraProfile.getAllDeployments();
        return buildOfflineServices(env, deployments);
      }
    },

    async deployAll(env, options) {
      const deployable = await this.listDeployable(env);
      return runDeploy(env, deployable, options);
    },

    async deployByTier(env, tier, options) {
      const deployable = await this.listDeployable(env);
      const filtered = deployable.filter((svc) => svc.tier === tier);
      return runDeploy(env, filtered, options);
    },
  };
}
