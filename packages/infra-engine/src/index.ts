// index.ts — public API
export * from "./core/types.js";
export { createPipeline } from "./core/pipeline.js";
export type * from "./adapters/adapter.js";
export { createGateAdapter } from "./adapters/gate.js";
export { createRegistryAdapter } from "./adapters/registry.js";
export { createInfraProfileAdapter } from "./adapters/infra-profile.js";
export { createServiceProfileAdapter } from "./adapters/service-profile.js";
export { createDiscoveryClient, type ServiceInfo, type DiscoveryClient } from "./discovery/client.js";
export {
  createDefinitionAdapter,
  type DefinitionAdapter,
  type ServiceDocsInfo,
  type ServiceTestInfo,
  type ServicePrefixInfo,
} from "./adapters/definition.js";
export {
  createEnhancedDiscoveryClient,
  type EnhancedDiscoveryClient,
  type EnhancedServiceInfo,
} from "./discovery/enhanced-client.js";
export { createSopsLoader, createPlainLoader } from "./config/sops-loader.js";
export { createConfigStage } from "./config/config-stage.js";
export { extractServiceEnv, resolveConnectionEnv } from "./config/env-bridge.js";
export { createVerifyStage } from "./verify/verify-stage.js";
export { createRegisterStage } from "./stages/register-stage.js";
export { createObserveStage } from "./stages/observe-stage.js";
export { createProvisionStage } from "./stages/provision-stage.js";
export { registerProvider, getProvider, listProviders } from "./providers/registry.js";
export { createLocalProvider, type LocalProviderOptions } from "./providers/local.js";
export { pulumiDeployFn } from "./providers/pulumi-deploy.js";
export {
  createFleetManager,
  type FleetManager,
  type FleetStatus,
  type FleetServiceStatus,
  type FleetDeployResult,
} from "./fleet/manager.js";
export { generateEnvFile, type EnvFileOptions } from "./export/env-file.js";
export { generateTypescriptModule } from "./export/typescript-module.js";
export { generateDockerComposeOverride } from "./export/docker-compose.js";
export { destroy } from "./commands/destroy.js";
export { envUp, envDown, envStatus, envReset, detectEnvironment } from "./commands/env-manager.js";
export { createSyncLoop, type SyncLoopOptions, type SyncCheckResult } from "./monitor/sync-loop.js";
export { createDashboardData, type DashboardData, type DashboardSummary, type ServiceDashboard } from "./monitor/dashboard.js";
export { createAutoRecovery, type AutoRecoveryOptions } from "./monitor/auto-recovery.js";
export { calculateSla, type SlaReport } from "./monitor/sla.js";
export { registerAllProviders } from "./providers/all.js";
export { createCloudflareProvider } from "./providers/cloudflare.js";
export { createRailwayProvider } from "./providers/railway.js";
export { createAwsProvider } from "./providers/aws.js";
export { createGcpProvider } from "./providers/gcp.js";
export { createVultrProvider } from "./providers/vultr.js";

import { createPipeline } from "./core/pipeline.js";
import { createConfigStage } from "./config/config-stage.js";
import { createSopsLoader } from "./config/sops-loader.js";
import type { SopsLoader } from "./config/sops-loader.js";
import { createVerifyStage } from "./verify/verify-stage.js";
import { createRegisterStage } from "./stages/register-stage.js";
import { createObserveStage } from "./stages/observe-stage.js";
import { createProvisionStage } from "./stages/provision-stage.js";
import { getProvider } from "./providers/registry.js";
import type { Adapters, DeployProvider } from "./adapters/adapter.js";
import type { DeployContext, DeployResult, ResolvedConfig } from "./core/types.js";

export interface DeployOptions {
  service: string;
  provider: string;
  env: string;
  region: string;
  configPath: string;
  triggeredBy?: "ci" | "manual";
  adapters: Adapters;
  configLoader?: SopsLoader; // 기본: createSopsLoader()
  deployFn: (
    provider: DeployProvider,
    config: ResolvedConfig,
    serviceId: string,
    stackName: string,
  ) => Promise<{ stackName: string; outputs: Record<string, string> }>;
}

export async function deploy(options: DeployOptions): Promise<DeployResult> {
  const loader = options.configLoader ?? createSopsLoader();
  const gateAdapter = options.adapters.gate;

  const pipeline = createPipeline([
    createConfigStage(loader),
    createProvisionStage(getProvider, options.deployFn),
    createRegisterStage(options.adapters.registry, options.adapters.serviceProfile, options.adapters.infraProfile),
    createVerifyStage(gateAdapter),
    createObserveStage(options.adapters.ingest, options.adapters.coordinate, options.adapters.infraProfile),
  ]);

  return pipeline.run({
    service: options.service,
    provider: options.provider as DeployContext["provider"],
    env: options.env,
    region: options.region,
    configPath: options.configPath,
    triggeredBy: options.triggeredBy ?? "manual",
  });
}
