// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from 'cli-command';
import type { CommandContext } from 'cli-command';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { PROFILE_DIR, REGISTRY_URL, INGEST_URL } from './context.js';
import { validateId, assertPathContainment } from '../lib/validation.js';
import type { DiscoveryClient, ServiceInfo } from '../discovery/client.js';
import {
  buildDeployHistoryEntry,
  readFleetRunContextFromEnv,
} from '../post-deploy/deploy-history.js';
import { runPostDeployCodegen } from 'infra-env-kit';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configDir = resolve(__dirname, '../../config');
const packageRoot = resolve(__dirname, '../..');
const FLEET_CONTEXT = readFleetRunContextFromEnv();

function createScopedDiscoveryClient(
  base: DiscoveryClient,
  allowedServiceIds: Set<string> | undefined,
  fallbackConfig?: { connections?: Record<string, { endpoint?: string }> },
): DiscoveryClient {
  function filterServices<T extends { serviceId: string }>(services: T[]): T[] {
    if (!allowedServiceIds) return services;
    return services.filter((service) => allowedServiceIds.has(service.serviceId));
  }

  function buildFallbackServices(): ServiceInfo[] {
    if (!allowedServiceIds) return [];
    return [...allowedServiceIds].map((serviceId) => ({
      serviceId,
      name: serviceId,
      url: fallbackConfig?.connections?.[serviceId]?.endpoint ?? '',
      tier: 'unknown',
      team: 'config',
      ownedPrefixes: [],
      consumedPrefixes: [],
      urls: fallbackConfig?.connections?.[serviceId]?.endpoint
        ? { dev: fallbackConfig.connections[serviceId]!.endpoint! }
        : undefined,
    }));
  }

  return {
    async resolve(serviceId, env) {
      if (allowedServiceIds && !allowedServiceIds.has(serviceId)) return null;
      try {
        return await base.resolve(serviceId, env);
      } catch {
        const endpoint = fallbackConfig?.connections?.[serviceId]?.endpoint;
        if (!endpoint) return null;
        return {
          serviceId,
          name: serviceId,
          url: endpoint,
          tier: 'unknown',
          team: 'config',
          ownedPrefixes: [],
          consumedPrefixes: [],
          urls: { [env ?? 'dev']: endpoint },
        };
      }
    },
    async resolveAll(env) {
      try {
        const urls = await base.resolveAll(env);
        if (!allowedServiceIds) return urls;
        return Object.fromEntries(
          Object.entries(urls).filter(([serviceId]) => allowedServiceIds.has(serviceId)),
        );
      } catch {
        if (!allowedServiceIds) throw new Error('registry unavailable');
        return Object.fromEntries(
          [...allowedServiceIds]
            .map((serviceId) => [serviceId, fallbackConfig?.connections?.[serviceId]?.endpoint])
            .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        );
      }
    },
    async listServices() {
      try {
        return filterServices(await base.listServices());
      } catch {
        return buildFallbackServices();
      }
    },
    async generateConnectCode(serviceId, env) {
      return base.generateConnectCode(serviceId, env);
    },
    async generateConnectCodeAll(serviceIds, env) {
      return base.generateConnectCodeAll(serviceIds, env);
    },
  };
}

/** deploy --all: fleet 일괄 배포 */
async function deployAll(ctx: CommandContext): Promise<void> {
  const env = ctx.args.service ?? 'dev'; // --all 모드에서 첫 위치 인자가 env
  validateId(env, 'env');
  const tier = typeof ctx.options.tier === 'string' ? ctx.options.tier : undefined;
  const servicesFilter =
    typeof ctx.options.services === 'string'
      ? new Set(
          ctx.options.services
            .split(',')
            .map((service) => service.trim())
            .filter(Boolean),
        )
      : undefined;
  const continueOnError = !!ctx.options.continueOnError;
  const dryRun = !!ctx.options.dryRun;
  const sync = !!ctx.options.sync;
  const provider =
    ctx.options.provider === 'cloudflare' || ctx.options.provider === 'local'
      ? ctx.options.provider
      : undefined;
  const artifactRegistry =
    typeof ctx.options.artifactRegistry === 'string' ? ctx.options.artifactRegistry : undefined;
  const configFile = provider === 'cloudflare' ? 'cloudflare-prod.json' : `${env}.json`;
  const configPath = resolve(configDir, configFile);
  assertPathContainment(configPath, configDir);
  let config: {
    services: Record<string, unknown>;
    connections?: Record<string, { endpoint?: string }>;
  };
  try {
    config = JSON.parse(await readFile(configPath, 'utf-8'));
  } catch {
    console.error(`설정 파일을 찾을 수 없습니다: ${configPath}`);
    process.exit(1);
    return;
  }
  const allowedServiceIds = new Set(
    Object.keys(config.services).filter(
      (serviceId) => !servicesFilter || servicesFilter.has(serviceId),
    ),
  );
  const fleetRunId = `fleet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fleetMode = tier ? 'tier' : 'all';
  const fleetScope = servicesFilter ? [...allowedServiceIds].join(',') : (tier ?? 'all');
  const fleetHistoryKey = `fleet:${env}${tier ? `:tier:${tier}` : ':all'}${provider ? `:provider:${provider}` : ''}`;

  const { createDiscoveryClient } = await import('../discovery/client.js');
  const { createInfraProfileAdapter } = await import('../adapters/infra-profile.js');
  const { createFleetManager } = await import('../fleet/manager.js');

  const baseDiscovery = createDiscoveryClient(REGISTRY_URL);
  const discovery = createScopedDiscoveryClient(baseDiscovery, allowedServiceIds, config);
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);

  const fleet = createFleetManager(discovery, infraProfile, {
    deployExecutor: async (serviceId, runEnv, options) => {
      console.log(`\n--- ${serviceId} ---`);
      const args = ['--import', 'tsx', './scripts/infra.ts', 'deploy', serviceId, runEnv];
      if (options?.provider) {
        args.push('--provider', options.provider);
      }
      if (options?.sync) {
        args.push('--sync');
      }
      if (options?.dryRun) {
        args.push('--dry-run');
      }
      if (artifactRegistry) {
        args.push('--artifact-registry', artifactRegistry);
      }

      const { execa } = await import('execa');
      await execa('node', args, {
        cwd: packageRoot,
        env: {
          ...process.env,
          QA_FLEET_RUN_ID: fleetRunId,
          QA_FLEET_MODE: fleetMode,
          QA_FLEET_SCOPE: fleetScope,
          QA_FLEET_CONFIG_PATH: configPath,
        },
        stdio: 'inherit',
      });
    },
  });

  const deployable = await fleet.listDeployable(env);
  const scopedDeployable = tier
    ? deployable.filter((service) => service.tier === tier)
    : deployable;

  console.log(
    `\n=== Fleet Deploy (${env}) — ${scopedDeployable.length}개 서비스${tier ? `, tier=${tier}` : ''}${servicesFilter ? `, services=${[...allowedServiceIds].join(',')}` : ''} ===\n`,
  );

  const result = tier
    ? await fleet.deployByTier(env, tier, { dryRun, continueOnError, provider, sync })
    : await fleet.deployAll(env, { dryRun, continueOnError, provider, sync });

  // 요약
  console.log(`\n=== Fleet Deploy 결과 ===`);
  console.log(
    `  성공: ${result.summary.success}  실패: ${result.summary.failed}  총 소요: ${result.summary.totalDuration}ms`,
  );
  for (const r of result.results) {
    const icon = r.success ? '[OK]' : '[FAIL]';
    console.log(
      `  ${icon} ${r.serviceId.padEnd(25)} ${r.duration}ms${r.error ? ` — ${r.error.slice(0, 50)}` : ''}`,
    );
  }

  if (!dryRun) {
    const fleetDeployedAt = new Date().toISOString();
    let fleetArtifactId: string | undefined;

    if (artifactRegistry) {
      try {
        const { writeFleetDeploymentArtifactRegistryRecord } =
          await import('../post-deploy/artifact-registry.js');
        const record = await writeFleetDeploymentArtifactRegistryRecord({
          artifactRegistry,
          env,
          configPath,
          result,
          runId: fleetRunId,
          mode: fleetMode,
          scope: fleetScope,
          options: {
            dryRun,
            continueOnError,
            provider,
            sync,
          },
          createdAt: fleetDeployedAt,
        });
        fleetArtifactId = record.artifactId;
        console.log(`[artifact-registry] ${record.artifactId} -> ${artifactRegistry}`);
      } catch (err) {
        console.warn(`[artifact-registry] fleet 기록 실패: ${err}`);
      }
    }

    await infraProfile.addHistory(fleetHistoryKey, {
      deployedAt: fleetDeployedAt,
      version: fleetRunId,
      env,
      provider: provider ?? 'fleet',
      endpoint: '',
      duration: result.summary.totalDuration,
      success: result.summary.failed === 0,
      triggeredBy: 'manual',
      mode: 'fleet-summary',
      runId: fleetRunId,
      scope: fleetScope,
      configPath,
      artifactId: fleetArtifactId,
      error:
        result.summary.failed > 0
          ? result.results
              .filter((entry) => !entry.success)
              .map((entry) => `${entry.serviceId}:${entry.error ?? 'failed'}`)
              .join('; ')
          : undefined,
    });
  }

  process.exit(result.summary.failed > 0 ? 1 : 0);
}

/** deploy --provider cloudflare: Cloudflare Workers 배포 */
async function deployCloudflare(ctx: CommandContext): Promise<void> {
  const service = ctx.args.service!;
  const env = ctx.args.env ?? 'prod';
  const configArg = ctx.args.config;
  const configFile = configArg?.endsWith('.json') ? configArg : 'cloudflare-prod.json';
  const configPath = resolve(configDir, configFile);
  const dryRun = !!ctx.options.dryRun;
  const artifactRegistry =
    typeof ctx.options.artifactRegistry === 'string' ? ctx.options.artifactRegistry : undefined;

  const { createPipeline } = await import('../core/pipeline.js');
  const { createConfigStage } = await import('../config/config-stage.js');
  const { createPlainLoader } = await import('../config/sops-loader.js');
  const { createProvisionStage } = await import('../stages/provision-stage.js');
  const { createRegisterStage } = await import('../stages/register-stage.js');
  const { createVerifyStage } = await import('../verify/verify-stage.js');
  const { createObserveStage } = await import('../stages/observe-stage.js');
  const { createGateAdapter } = await import('../adapters/gate.js');
  const { createInfraProfileAdapter } = await import('../adapters/infra-profile.js');
  const { createServiceProfileAdapter } = await import('../adapters/service-profile.js');
  const { createCloudflareProvider, wranglerDeployFn } = await import('../providers/cloudflare.js');
  const { registerProvider, getProvider } = await import('../providers/registry.js');
  const { createRegistryAdapter } = await import('../adapters/registry.js');

  console.log(`\n=== Cloudflare 배포 ===`);
  console.log(`서비스: ${service}`);
  console.log(`환경:   ${env}`);
  console.log(`설정:   ${configPath}${dryRun ? ' (dry-run)' : ''}\n`);

  registerProvider(createCloudflareProvider());
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const serviceProfile = createServiceProfileAdapter(PROFILE_DIR);
  const gate = createGateAdapter();

  // registry 연동
  let registry: any;
  try {
    const res = await fetch(`${REGISTRY_URL}/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      registry = createRegistryAdapter(REGISTRY_URL);
      console.log('[registry] 실서비스 연결');
    } else throw new Error();
  } catch {
    registry = {
      syncDeployment: async (p: any) => {
        console.log(`[registry-mock] sync: ${p.serviceId}`);
        return { synced: true };
      },
    };
  }

  // IngestAdapter — ingest-server 실행 시 실연동, 미실행 시 mock fallback
  let ingestAdapter: any;
  try {
    const ingestRes = await fetch(new URL('/health/live', INGEST_URL), {
      signal: AbortSignal.timeout(2000),
    });
    if (ingestRes.ok) {
      const { createIngestAdapter } = await import('../adapters/ingest.js');
      ingestAdapter = createIngestAdapter({ baseUrl: INGEST_URL });
      console.log(`[ingest] 실서비스 연결됨 (${INGEST_URL})`);
    } else throw new Error();
  } catch {
    console.log('[ingest] 미실행 — mock 모드');
    ingestAdapter = {
      emit: async (key: string) => {
        console.log(`[ingest-mock] emit: ${key}`);
        return { ok: true };
      },
    };
  }

  const { createCoordinateAdapter } = await import('../adapters/coordinate.js');
  const { DEMO_CATALOG } = await import('demo-snapshot');
  const coordinateAdapter = createCoordinateAdapter(DEMO_CATALOG);

  const skipVerify = !!ctx.options.skipVerify;
  const stages = dryRun
    ? [createConfigStage(createPlainLoader())]
    : [
        createConfigStage(createPlainLoader()),
        createProvisionStage(getProvider, wranglerDeployFn),
        createRegisterStage(registry, serviceProfile, infraProfile),
        ...(skipVerify
          ? []
          : [createVerifyStage(gate, { maxRetries: 3, retryDelay: 5000, serviceProfile })]),
        createObserveStage(ingestAdapter, coordinateAdapter, infraProfile),
      ];

  const pipeline = createPipeline(stages);
  const result = await pipeline.run({
    service,
    provider: 'cloudflare' as any,
    env,
    region: 'global',
    configPath,
    triggeredBy: 'manual',
  });

  console.log(`\n=== 배포 결과 ===`);
  console.log(`성공:     ${result.success}`);
  console.log(`엔드포인트: ${result.endpoint}`);
  console.log(`소요시간: ${result.duration}ms`);
  for (const s of result.stageResults) {
    console.log(`  ${s.stage}: ${s.status} (${s.duration}ms)${s.error ? ` — ${s.error}` : ''}`);
  }

  if (result.success) {
    let artifactId: string | undefined;
    const deployedAt = new Date().toISOString();

    // Post-deploy: 버전 기록
    try {
      const { createVersionStore } = await import('../post-deploy/version-manager.js');
      const versionStore = createVersionStore();
      const vEntry = await versionStore.setVersion(
        service,
        env,
        result.endpoint ?? 'unknown',
        result.endpoint ?? '',
        'cloudflare',
      );
      if (vEntry.previousVersion) {
        console.log(`[version] ${vEntry.previousVersion} -> ${vEntry.currentVersion}`);
      } else {
        console.log(`[version] ${vEntry.currentVersion} (초기 배포)`);
      }
    } catch (err) {
      console.warn(`[version] 기록 실패: ${err}`);
    }

    // endpoint 피드백: 배포에서 얻은 endpoint를 config에 반영
    if (result.endpoint) {
      try {
        const { readFile, writeFile } = await import('node:fs/promises');
        const raw = await readFile(configPath, 'utf-8');
        const config = JSON.parse(raw);
        const current = config.connections?.[service]?.endpoint;
        if (!current || current !== result.endpoint) {
          config.connections = config.connections ?? {};
          config.connections[service] = config.connections[service] ?? {};
          config.connections[service].endpoint = result.endpoint;
          await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
          console.log(
            `[endpoint-feedback] ${service}: ${result.endpoint}${current ? ` (이전: ${current})` : ' (신규)'}`,
          );
        }
      } catch (err) {
        console.warn(`[endpoint-feedback] 실패: ${err}`);
      }
    }

    if (artifactRegistry) {
      try {
        const { writeDeploymentOutputArtifactRegistryRecord } =
          await import('../post-deploy/artifact-registry.js');
        const record = await writeDeploymentOutputArtifactRegistryRecord({
          artifactRegistry,
          service,
          env,
          provider: 'cloudflare',
          configPath,
          result,
          fleetRunId: FLEET_CONTEXT.runId,
          fleetMode: FLEET_CONTEXT.mode,
          fleetScope: FLEET_CONTEXT.scope,
        });
        if (record) {
          artifactId = record.artifactId;
          console.log(`[artifact-registry] ${record.artifactId} -> ${artifactRegistry}`);
        }
      } catch (err) {
        console.warn(`[artifact-registry] 기록 실패: ${err}`);
      }
    }

    await infraProfile.addHistory(
      service,
      buildDeployHistoryEntry(
        {
          deployedAt,
          version: result.endpoint ?? 'unknown',
          env,
          provider: 'cloudflare',
          endpoint: result.endpoint ?? '',
          duration: result.duration,
          success: true,
          triggeredBy: 'manual',
          configPath,
          artifactId,
        },
        FLEET_CONTEXT,
      ),
    );

    // --sync 플래그: codegen + cascade 감지
    if (ctx.options.sync) {
      try {
        const { createDiscoveryClient } = await import('../discovery/client.js');
        const client = createDiscoveryClient(REGISTRY_URL);
        const codegenResult = await runPostDeployCodegen(client, service, env);
        console.log(`[codegen] TS: ${codegenResult.tsPath}`);
        console.log(`[codegen] env: ${codegenResult.envPaths.length}건`);
      } catch (err) {
        console.warn(`[codegen] 실패 — ${err}`);
      }

      try {
        const { findCascadeTargets, executeCascade } = await import('../post-deploy/cascade.js');
        const { createPlainLoader: createLoader } = await import('../config/sops-loader.js');
        const loader = createLoader();
        const config = (await loader.decrypt(configPath)) as any;
        const targets = findCascadeTargets(config, service);
        await executeCascade(targets, env, { dryRun: true });
      } catch (err) {
        console.warn(`[cascade] 실패: ${err}`);
      }
    }
  }

  process.exit(result.success ? 0 : 1);
}

/** deploy (단일 서비스, local K3s) — scripts/deploy-local.ts에 위임 */
async function deployLocal(ctx: CommandContext): Promise<void> {
  process.argv = [process.argv[0], 'deploy-local.ts', ...ctx.rawArgs];
  await import('../../scripts/deploy-local.js');
}

/** deploy 명령 — 모드별 분기 */
export const deployHandler: CommandHandler = async (ctx) => {
  if (ctx.options.all) {
    await deployAll(ctx);
  } else if (ctx.options.provider === 'cloudflare') {
    await deployCloudflare(ctx);
  } else {
    await deployLocal(ctx);
  }
};
