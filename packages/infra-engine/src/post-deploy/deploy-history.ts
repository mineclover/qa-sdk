// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { DeployHistoryEntry } from "../core/types.js";

export interface FleetRunContext {
  runId?: string;
  mode?: string;
  scope?: string;
  configPath?: string;
}

export interface BuildDeployHistoryEntryInput {
  deployedAt: string;
  version: string;
  env: string;
  provider: string;
  endpoint: string;
  duration: number;
  success: boolean;
  triggeredBy: "ci" | "manual";
  configPath?: string;
  artifactId?: string;
  error?: string;
}

export function readFleetRunContextFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): FleetRunContext {
  return {
    runId: env.QA_FLEET_RUN_ID,
    mode: env.QA_FLEET_MODE,
    scope: env.QA_FLEET_SCOPE,
    configPath: env.QA_FLEET_CONFIG_PATH,
  };
}

export function buildDeployHistoryEntry(
  input: BuildDeployHistoryEntryInput,
  fleet: FleetRunContext = readFleetRunContextFromEnv(),
): DeployHistoryEntry {
  return {
    deployedAt: input.deployedAt,
    version: input.version,
    env: input.env,
    provider: input.provider,
    endpoint: input.endpoint,
    duration: input.duration,
    success: input.success,
    triggeredBy: input.triggeredBy,
    mode: fleet.runId ? "fleet-service" : "single",
    runId: fleet.runId,
    scope: fleet.scope,
    configPath: fleet.configPath ?? input.configPath,
    artifactId: input.artifactId,
    error: input.error,
  };
}
