// core/types.ts — qa-sdk 무의존 범용 타입

export type ProviderId = "cloudflare" | "aws" | "gcp" | "railway" | "vultr" | "local";

export interface DeployContext {
  readonly service: string;
  readonly provider: ProviderId;
  readonly env: string;
  readonly region: string;
  readonly configPath: string;
  readonly triggeredBy: "ci" | "manual";

  config?: ResolvedConfig;
  provision?: ProvisionResult;
  registration?: RegistrationResult;
  verification?: VerifyResult;
  observation?: ObserveResult;
}

export interface ResolvedConfig {
  global: GlobalConfig;
  services: Record<string, ServiceConfig>;
  connections: Record<string, ConnectionConfig>;
  monitoring?: MonitoringConfig;
}

export interface GlobalConfig {
  region: string;
  [key: string]: unknown;
}

export interface ServiceConfig {
  port: number;
  depends_on?: string[];
  gates?: GateDefinition[];
  [key: string]: unknown;
}

export interface ConnectionConfig {
  endpoint: string;
  health_path?: string;
  [key: string]: unknown;
}

export interface MonitoringConfig {
  interval: number;
  webhooks?: WebhookConfig[];
}

export interface WebhookConfig {
  url: string;
  events: string[];
}

export interface GateDefinition {
  name: string;
  type: "custom";
  check: string;
  expect_status: number;
  required: boolean;
}

export interface ProvisionResult {
  stackName: string;
  outputs: Record<string, string>;
  provider: string;
  region: string;
  duration: number;
}

export interface RegistrationResult {
  synced: boolean;
  manifestImpact?: string;
  profileUpdated: boolean;
  infraProfileUpdated: boolean;
  connectionChecks: ConnectionCheck[];
}

export interface ConnectionCheck {
  target: string;
  reachable: boolean;
  latency?: number;
}

export interface VerifyResult {
  healthStatus: "healthy" | "degraded" | "failed";
  gateVerdict: GateVerdict;
  checks: GateCheckResult[];
  retryCount: number;
  totalDuration: number;
}

export interface GateCheckResult {
  gate: string;
  verdict: "pass" | "warn" | "fail";
  detail: string;
  latency?: number;
}

export type GateVerdict = "pass" | "warn" | "fail";

export interface ObserveResult {
  eventEmitted: boolean;
  monitorRegistered: boolean;
  warnings: string[];
}

export interface DeployResult {
  success: boolean;
  endpoint?: string;
  healthStatus: "healthy" | "degraded" | "failed";
  gateVerdict: GateVerdict;
  duration: number;
  stageResults: StageResult[];
}

export interface StageResult {
  stage: string;
  status: "success" | "failed" | "skipped" | "rolled_back";
  duration: number;
  error?: string;
}

export interface Stage {
  readonly name: string;
  execute(ctx: DeployContext): Promise<DeployContext>;
  rollback?(ctx: DeployContext): Promise<void>;
}

export interface DeployPipeline {
  readonly stages: readonly Stage[];
  run(input: DeployContext): Promise<DeployResult>;
}

export interface InfraDeploymentEntry {
  serviceId: string;
  provider: string;
  env: string;
  region: string;
  endpoint: string;
  healthPath: string;
  stackName: string;
  deploymentVersion: string;
  deployedAt: string;
  triggeredBy: "ci" | "manual";
  metadata: Record<string, string>;
}

export interface MonitorTarget {
  serviceId: string;
  endpoint: string;
  healthPath: string;
  provider: string;
  env: string;
  region: string;
  namespace: string;
  interval: number;
  lastChecked?: string;
  lastStatus?: SyncStatus;
}

export type SyncStatus = "Synced" | "OutOfSync" | "Degraded" | "Unknown";
