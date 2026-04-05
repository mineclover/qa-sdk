// adapters/adapter.ts — 6개 포트 인터페이스 + DeployProvider
import type {
  GateCheckResult,
  GateVerdict,
  InfraDeploymentEntry,
  MonitorTarget,
  ResolvedConfig,
} from "../core/types.js";

// --- 1. RegistryAdapter ---
export interface DeploymentSyncParams {
  serviceId: string;
  deploymentVersion: string;
  runtime: {
    namespace: string;
    name: string;
    env: string;
    region: string;
  };
  provider: string;
  project: string;
  stack: string;
  resourceKey: string;
  url?: string;
  urn?: string;
  outputs?: Record<string, unknown>;
  catalogId?: string;
}

export interface DeploymentSyncResult {
  synced: boolean;
  manifestImpact?: string;
}

export interface RegistryAdapter {
  syncDeployment(params: DeploymentSyncParams): Promise<DeploymentSyncResult>;
}

// --- 2. ServiceProfileAdapter ---
export interface ServiceProfileAdapter {
  get(serviceId: string): Promise<string | null>;
  set(serviceId: string, url: string): Promise<void>;
  restore(serviceId: string): Promise<void>;
}

// --- 3. InfraProfileAdapter ---
export interface InfraProfileAdapter {
  setDeployment(serviceId: string, entry: InfraDeploymentEntry): Promise<void>;
  getDeployment(serviceId: string): Promise<InfraDeploymentEntry | null>;
  getAllDeployments(): Promise<Record<string, InfraDeploymentEntry>>;
  restore(serviceId: string): Promise<void>;
  setMonitor(serviceId: string, target: MonitorTarget): Promise<void>;
  removeMonitor(serviceId: string): Promise<void>;
  getAllMonitors(): Promise<MonitorTarget[]>;
  updateMonitorStatus(serviceId: string, status: string, checkedAt: string): Promise<void>;
}

// --- 4. IngestAdapter ---
export interface IngestAdapter {
  emit(
    eventKey: string,
    payload: Record<string, unknown>,
    addressContext: Record<string, string>,
  ): Promise<{ ok: boolean; error?: string }>;
}

// --- 5. CoordinateAdapter ---
export interface CoordinateAdapter {
  resolveSvcRef(serviceId: string, env: string, region: string, namespace?: string): string | null;
  encodeDeployEvent(svcRef: string | null, action: string, actor?: string): Record<string, string>;
  encodeHealthEvent(svcRef: string | null, status: string): Record<string, string>;
}

// --- 6. GateAdapter ---
export interface GateAdapter {
  evaluate(checks: GateCheckResult[]): GateVerdict;
}

// --- Adapters 묶음 ---
export interface Adapters {
  registry: RegistryAdapter;
  serviceProfile: ServiceProfileAdapter;
  infraProfile: InfraProfileAdapter;
  ingest: IngestAdapter;
  coordinate: CoordinateAdapter;
  gate: GateAdapter;
}

// --- Provider 인터페이스 ---
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface DeployProvider {
  readonly name: string;
  getProgram(config: ResolvedConfig, serviceId: string): unknown; // PulumiFn
  destroy(stackName: string): Promise<void>;
  validate(config: ResolvedConfig): Promise<ValidationResult>;
}
