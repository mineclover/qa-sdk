import type { EventRecord } from "./record.js";

// ── Owner ──────────────────────────────────────────────

export type OwnerType = "tenant" | "workspace" | "user" | "agent";

export interface TransmissionOwner {
  owner_type: OwnerType;
  owner_id: string;
}

// ── Source ──────────────────────────────────────────────

export interface TransmissionSource {
  service_name: string;
  sdk_name: string;
  sdk_version: string;
}

// ── Runtime ────────────────────────────────────────────

export interface TransmissionRuntime {
  platform: string;
  device_ref?: string;
  os_version?: string;
  app_version?: string;
}

// ── Build ──────────────────────────────────────────────

export type BuildEnv = "local" | "dev" | "staging" | "production";

export interface TransmissionBuild {
  env: BuildEnv;
  build_ref?: string;
  release_version?: string;
}

// ── Transmission Envelope ──────────────────────────────

export interface TransmissionEnvelope {
  transmission_id: string;
  sent_at: string;
  owner: TransmissionOwner;
  source: TransmissionSource;
  runtime: TransmissionRuntime;
  build: TransmissionBuild;
  /** 엔벨로프 전체에 적용되는 인프라 주소 컨텍스트. 레코드의 address_context가 override */
  infra_context?: Record<string, string>;
  /** 배포 시점의 entry snapshot ID (envelope 전략 snapshotSupply용) */
  entry_snapshot?: string;
  records: EventRecord[];
}
