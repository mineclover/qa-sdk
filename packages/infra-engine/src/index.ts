// index.ts — public API
export * from "./core/types.js";
export { createPipeline } from "./core/pipeline.js";
export type * from "./adapters/adapter.js";
export { createGateAdapter } from "./adapters/gate.js";
export { createInfraProfileAdapter } from "./adapters/infra-profile.js";
export { createServiceProfileAdapter } from "./adapters/service-profile.js";
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
