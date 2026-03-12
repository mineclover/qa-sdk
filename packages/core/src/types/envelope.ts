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
  records: EventRecord[];
}
